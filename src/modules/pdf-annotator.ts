/**
 * PDF Annotator Module
 * Creates annotated PDFs highlighting where extracted data came from
 */

import { BaseModule } from './base.js';
import type { ExtractionOptions, CerebellumExtractionData } from '../types/index.js';
import { PdfBBoxExtractor, type TextWithBBox } from '../utils/pdf-bbox-extractor.js';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

interface AnnotatorInput {
  pdfPath: string;
  extractedData: CerebellumExtractionData;
  outputPath: string;
}

interface AnnotatorResult {
  outputPath: string;
  annotationsAdded: number;
  highlightedFields: string[];
}

interface HighlightConfig {
  color: { r: number; g: number; b: number };
  opacity: number;
  label?: string;
}

/**
 * PDF Annotator - Creates visual validation PDFs
 *
 * This module takes extraction results and creates an annotated PDF
 * showing exactly where each piece of data was extracted from.
 *
 * Use cases:
 * - Validate extraction accuracy
 * - Transparent systematic reviews
 * - Training and quality control
 * - Auditing AI extractions
 */
export class PdfAnnotator extends BaseModule<AnnotatorInput, AnnotatorResult> {
  readonly name = 'PDF Annotator';
  readonly description = 'Creates annotated PDFs highlighting extraction sources';

  // Color scheme for different field types
  private readonly FIELD_COLORS: Record<string, HighlightConfig> = {
    study_id: { color: { r: 0.2, g: 0.6, b: 1.0 }, opacity: 0.3, label: 'Study ID' },
    authors: { color: { r: 0.2, g: 0.6, b: 1.0 }, opacity: 0.3, label: 'Authors' },
    title: { color: { r: 0.2, g: 0.6, b: 1.0 }, opacity: 0.3, label: 'Title' },

    population: { color: { r: 0.4, g: 0.8, b: 0.4 }, opacity: 0.3, label: 'Population' },
    intervention: { color: { r: 1.0, g: 0.6, b: 0.2 }, opacity: 0.3, label: 'Intervention' },
    outcomes: { color: { r: 0.9, g: 0.3, b: 0.3 }, opacity: 0.3, label: 'Outcomes' },

    imaging: { color: { r: 0.6, g: 0.3, b: 0.9 }, opacity: 0.3, label: 'Imaging' },
    methods: { color: { r: 0.3, g: 0.9, b: 0.9 }, opacity: 0.3, label: 'Methods' },
    results: { color: { r: 0.9, g: 0.9, b: 0.3 }, opacity: 0.3, label: 'Results' },

    default: { color: { r: 0.5, g: 0.5, b: 0.5 }, opacity: 0.2, label: 'Other' },
  };

  async process(input: AnnotatorInput, options?: ExtractionOptions): Promise<AnnotatorResult> {
    this.validate();
    this.log('Creating annotated PDF...', options?.verbose);

    try {
      // Step 1: Extract text with bounding boxes
      this.log('Extracting text coordinates...', options?.verbose);
      const { words, pages } = await PdfBBoxExtractor.extractWithBBoxes(input.pdfPath);
      this.log(`Found ${words.length} words across ${pages.length} pages`, options?.verbose);

      // Step 2: Find bounding boxes for extracted data
      const annotations = await this.findDataBBoxes(input.extractedData, words, options);
      this.log(`Created ${annotations.length} annotations`, options?.verbose);

      // Step 3: Create annotated PDF
      const result = await this.createAnnotatedPdf(
        input.pdfPath,
        input.outputPath,
        annotations,
        options
      );

      return {
        outputPath: input.outputPath,
        annotationsAdded: result.annotationsAdded,
        highlightedFields: result.highlightedFields,
      };
    } catch (error) {
      this.logError(`Annotation failed: ${error}`);
      throw error;
    }
  }

  /**
   * Find bounding boxes for all extracted data values
   *
   * TODO: Implement smart matching strategies
   *
   * This is where you decide how to match extracted text to PDF locations:
   * 1. Exact string match (fastest, but may miss variations)
   * 2. Fuzzy match (handles typos, OCR errors)
   * 3. Semantic match (using embeddings to find similar text)
   * 4. Claude-assisted (ask Claude to locate the text)
   *
   * Trade-offs:
   * - Exact match: Fast but brittle
   * - Fuzzy: More robust but slower
   * - Semantic: Best accuracy but requires embeddings
   * - Claude: Most accurate but API costs
   */
  private async findDataBBoxes(
    data: CerebellumExtractionData,
    words: TextWithBBox[],
    options?: ExtractionOptions
  ): Promise<Array<{ text: string; bbox: TextWithBBox; fieldType: string }>> {
    const annotations: Array<{ text: string; bbox: TextWithBBox; fieldType: string }> = [];

    // Extract fields to search for
    const fieldsToSearch = this.extractSearchableFields(data);

    for (const { field, value, fieldType } of fieldsToSearch) {
      if (!value || typeof value !== 'string' || value.length < 3) continue;

      this.log(`Searching for "${value}" (${field})`, options?.verbose);

      // Find bounding boxes for this value
      /*
      const _matches = await PdfBBoxExtractor.findTextBBoxes(
        '', // Already have words, don't need PDF path
        value,
        false // case-insensitive
      );
      */

      // For now, use a simple in-memory search
      // TODO: Replace with actual PdfBBoxExtractor.findTextBBoxes implementation
      const manualMatches = this.searchInWords(words, value);

      for (const match of manualMatches) {
        annotations.push({
          text: value,
          bbox: match,
          fieldType,
        });
      }
    }

    return annotations;
  }

  /**
   * Simple in-memory word search
   */
  private searchInWords(words: TextWithBBox[], searchText: string): TextWithBBox[] {
    const matches: TextWithBBox[] = [];
    const searchLower = searchText.toLowerCase();

    // Search for the text as a phrase
    for (let i = 0; i < words.length; i++) {
      // Build phrases from current position
      let phraseText = '';
      let phraseWords: TextWithBBox[] = [];

      for (let j = i; j < Math.min(i + 20, words.length); j++) {
        phraseText += (phraseText ? ' ' : '') + words[j].text;
        phraseWords.push(words[j]);

        // Check if we found the search text
        if (phraseText.toLowerCase().includes(searchLower)) {
          // Combine bounding boxes
          const minX = Math.min(...phraseWords.map((w) => w.bbox.x));
          const minY = Math.min(...phraseWords.map((w) => w.bbox.y));
          const maxX = Math.max(...phraseWords.map((w) => w.bbox.x + w.bbox.width));
          const maxY = Math.max(...phraseWords.map((w) => w.bbox.y + w.bbox.height));

          matches.push({
            text: phraseText,
            bbox: {
              x: minX,
              y: minY,
              width: maxX - minX,
              height: maxY - minY,
            },
            page: phraseWords[0].page,
          });

          break;
        }
      }
    }

    return matches;
  }

  /**
   * Extract all searchable field values from extraction data
   */
  private extractSearchableFields(
    data: CerebellumExtractionData
  ): Array<{ field: string; value: any; fieldType: string }> {
    const fields: Array<{ field: string; value: any; fieldType: string }> = [];

    // Study identification
    if (data.study_id) fields.push({ field: 'study_id', value: data.study_id, fieldType: 'study_id' });
    if (data.authors) fields.push({ field: 'authors', value: data.authors, fieldType: 'authors' });
    if (data.title) fields.push({ field: 'title', value: data.title, fieldType: 'title' });

    // Population data
    if (data.population?.sample_size)
      fields.push({ field: 'sample_size', value: data.population.sample_size, fieldType: 'population' });

    // Intervention data
    if (data.intervention?.procedure)
      fields.push({ field: 'procedure', value: data.intervention.procedure, fieldType: 'intervention' });

    // Outcomes
    if (data.outcomes?.mortality)
      fields.push({ field: 'mortality', value: data.outcomes.mortality, fieldType: 'outcomes' });
    if (data.outcomes?.mRS_favorable)
      fields.push({ field: 'mRS_favorable', value: data.outcomes.mRS_favorable, fieldType: 'outcomes' });

    // Imaging metrics
    if (data.imaging?.infarct_volume_ml)
      fields.push({
        field: 'infarct_volume',
        value: data.imaging.infarct_volume_ml.toString(),
        fieldType: 'imaging',
      });

    return fields;
  }

  /**
   * Create annotated PDF with highlights
   */
  private async createAnnotatedPdf(
    inputPath: string,
    outputPath: string,
    annotations: Array<{ text: string; bbox: TextWithBBox; fieldType: string }>,
    _options?: ExtractionOptions
  ): Promise<{ annotationsAdded: number; highlightedFields: string[] }> {
    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const highlightedFields = new Set<string>();
    let annotationsAdded = 0;

    // Group annotations by page
    const annotationsByPage = new Map<number, typeof annotations>();
    for (const annotation of annotations) {
      const page = annotation.bbox.page;
      if (!annotationsByPage.has(page)) {
        annotationsByPage.set(page, []);
      }
      annotationsByPage.get(page)!.push(annotation);
    }

    // Add highlights to each page
    for (const [pageNum, pageAnnotations] of annotationsByPage) {
      const page = pdfDoc.getPage(pageNum - 1); // 0-indexed
      const { height } = page.getSize();

      for (const annotation of pageAnnotations) {
        const config =
          this.FIELD_COLORS[annotation.fieldType] || this.FIELD_COLORS.default;

        // PDF coordinates: (0,0) is bottom-left
        // Our bbox coordinates: (0,0) is top-left
        // Need to flip Y axis
        const pdfY = height - annotation.bbox.bbox.y - annotation.bbox.bbox.height;

        // Draw semi-transparent rectangle
        page.drawRectangle({
          x: annotation.bbox.bbox.x,
          y: pdfY,
          width: annotation.bbox.bbox.width,
          height: annotation.bbox.bbox.height,
          color: rgb(config.color.r, config.color.g, config.color.b),
          opacity: config.opacity,
        });

        annotationsAdded++;
        highlightedFields.add(annotation.fieldType);
      }
    }

    // Add legend on first page
    await this.addLegend(pdfDoc, Array.from(highlightedFields));

    // Save
    const annotatedBytes = await pdfDoc.save();
    writeFileSync(outputPath, annotatedBytes);

    return {
      annotationsAdded,
      highlightedFields: Array.from(highlightedFields),
    };
  }

  /**
   * Add color legend to first page
   */
  private async addLegend(pdfDoc: PDFDocument, highlightedFields: string[]): Promise<void> {
    const page = pdfDoc.getPage(0);
    const { width, height } = page.getSize();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const legendX = width - 150;
    let legendY = height - 50;

    // Title
    page.drawText('Extraction Legend:', {
      x: legendX,
      y: legendY,
      size: 10,
      font,
      color: rgb(0, 0, 0),
    });

    legendY -= 15;

    // Draw each highlighted field type
    for (const fieldType of highlightedFields) {
      const config = this.FIELD_COLORS[fieldType] || this.FIELD_COLORS.default;

      // Color box
      page.drawRectangle({
        x: legendX,
        y: legendY - 8,
        width: 12,
        height: 12,
        color: rgb(config.color.r, config.color.g, config.color.b),
        opacity: config.opacity,
      });

      // Label
      page.drawText(config.label || fieldType, {
        x: legendX + 18,
        y: legendY - 6,
        size: 8,
        font,
        color: rgb(0, 0, 0),
      });

      legendY -= 15;
    }
  }
}
