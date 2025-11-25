/**
 * Citation Localizer
 *
 * Finds exact bounding box locations for cited text in PDFs using text search.
 * Connects Claude's native citations (page + text) with precise PDF coordinates.
 *
 * Pipeline:
 * 1. Extract with citations → Get page number + cited text
 * 2. Text search in PDF → Find exact bounding box coordinates
 * 3. Create visual annotations → Highlight or annotate cited regions
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, readFileSync, existsSync } from 'fs';

import type { CitationSource } from './citation-display.js';

const execAsync = promisify(exec);

/**
 * Bounding box in PDF coordinates
 * Format: [left, top, right, bottom] in points (1/72 inch)
 */
export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  page: number;
}

/**
 * Citation with precise PDF location
 */
export interface LocalizedCitation extends CitationSource {
  /** Bounding boxes for the cited text (may be multiple if text spans lines) */
  boundingBoxes: BoundingBox[];
  /** Search confidence (0.0-1.0) */
  locationConfidence: number;
}

/**
 * Text search result with location
 */
interface TextLocation {
  text: string;
  page: number;
  boundingBoxes: BoundingBox[];
  confidence: number;
}

/**
 * Localize citations by finding their exact positions in the PDF
 *
 * Uses pdftotext with -bbox-layout option to extract text with coordinates,
 * then searches for the cited text to find precise bounding boxes.
 *
 * @param pdfPath - Path to PDF file
 * @param citations - Array of citation sources from Claude
 * @returns Citations with precise bounding box locations
 *
 * @example
 * ```typescript
 * // Get citations from Claude
 * const sources = extractCitationSources(response);
 *
 * // Find exact locations in PDF
 * const localized = await localizeCitations('paper.pdf', sources);
 *
 * // Now you have precise bounding boxes for each citation
 * localized.forEach(citation => {
 *   console.log(`Citation on page ${citation.page}:`);
 *   citation.boundingBoxes.forEach(box => {
 *     console.log(`  Box: [${box.left}, ${box.top}, ${box.right}, ${box.bottom}]`);
 *   });
 * });
 * ```
 */
export async function localizeCitations(
  pdfPath: string,
  citations: CitationSource[]
): Promise<LocalizedCitation[]> {
  console.log(`[CitationLocalizer] Localizing ${citations.length} citations in PDF...`);

  // Extract PDF text with bounding boxes
  const textWithBoxes = await extractTextWithBoundingBoxes(pdfPath);

  const localized: LocalizedCitation[] = [];

  for (const citation of citations) {
    if (!citation.pageNumber || !citation.citedText) {
      console.warn(`[CitationLocalizer] Skipping citation ${citation.index} - missing page or text`);
      continue;
    }

    try {
      // Search for cited text on the specified page
      const location = await findTextLocation(
        textWithBoxes,
        citation.citedText,
        citation.pageNumber
      );

      if (location) {
        localized.push({
          ...citation,
          boundingBoxes: location.boundingBoxes,
          locationConfidence: location.confidence
        });
        console.log(`[CitationLocalizer] ✓ Found citation ${citation.index} with ${location.boundingBoxes.length} boxes`);
      } else {
        console.warn(`[CitationLocalizer] ✗ Could not find citation ${citation.index} on page ${citation.pageNumber}`);
        // Add with empty bounding boxes
        localized.push({
          ...citation,
          boundingBoxes: [],
          locationConfidence: 0
        });
      }
    } catch (error) {
      console.error(`[CitationLocalizer] Error localizing citation ${citation.index}:`, error);
      localized.push({
        ...citation,
        boundingBoxes: [],
        locationConfidence: 0
      });
    }
  }

  console.log(`[CitationLocalizer] Successfully localized ${localized.filter(c => c.boundingBoxes.length > 0).length}/${citations.length} citations`);

  return localized;
}

/**
 * Extract text with bounding boxes using pdftotext -bbox-layout
 *
 * This gives us XML with precise coordinates for every word in the PDF.
 *
 * @param pdfPath - Path to PDF file
 * @returns Text content with bounding box information
 */
async function extractTextWithBoundingBoxes(pdfPath: string): Promise<string> {
  const xmlPath = pdfPath.replace(/\.pdf$/i, '_bbox.xml');

  try {
    // Use pdftotext with -bbox-layout to get XML with coordinates
    await execAsync(`pdftotext -bbox-layout "${pdfPath}" "${xmlPath}"`);

    if (!existsSync(xmlPath)) {
      throw new Error('pdftotext did not generate XML file');
    }

    const xml = readFileSync(xmlPath, 'utf-8');
    return xml;
  } catch (error) {
    throw new Error(`Failed to extract text with bounding boxes: ${error}`);
  }
}

/**
 * Find text location in the extracted bounding box data
 *
 * Uses fuzzy matching to handle minor variations in whitespace/formatting.
 *
 * @param xmlContent - XML content from pdftotext -bbox-layout
 * @param searchText - Text to search for
 * @param targetPage - Page number to search (1-indexed)
 * @returns Location with bounding boxes, or null if not found
 */
async function findTextLocation(
  xmlContent: string,
  searchText: string,
  targetPage: number
): Promise<TextLocation | null> {
  const xml2js = await import('xml2js');
  const parser = new xml2js.Parser();

  try {
    const result = await parser.parseStringPromise(xmlContent);

    if (!result || !result.pdf || !result.pdf.page) {
      return null;
    }

    // Find the target page
    const pages = Array.isArray(result.pdf.page) ? result.pdf.page : [result.pdf.page];
    const page = pages[targetPage - 1]; // Convert to 0-indexed

    if (!page) {
      return null;
    }

    // Extract all text blocks from the page
    const textBlocks = extractTextBlocks(page);

    // Search for the cited text (with fuzzy matching)
    const normalized = normalizeText(searchText);
    const words = normalized.split(/\s+/);

    // Try to find a sequence of words that matches
    for (let i = 0; i < textBlocks.length; i++) {
      const blockText = normalizeText(textBlocks[i].text);

      // Check if this block contains enough of the search text
      const matchedWords = words.filter(word => blockText.includes(word));
      const matchRatio = matchedWords.length / words.length;

      if (matchRatio >= 0.7) { // 70% of words must match
        // Found a match! Collect bounding boxes
        const boundingBoxes = collectBoundingBoxes(textBlocks, i, words.length);

        return {
          text: searchText,
          page: targetPage,
          boundingBoxes,
          confidence: matchRatio
        };
      }
    }

    return null;
  } catch (error) {
    console.error('[CitationLocalizer] XML parsing error:', error);
    return null;
  }
}

/**
 * Extract text blocks with their bounding boxes from page XML
 */
function extractTextBlocks(pageXml: any): Array<{ text: string; bbox: BoundingBox }> {
  const blocks: Array<{ text: string; bbox: BoundingBox }> = [];

  // Handle different possible structures in pdftotext XML
  if (pageXml.block) {
    const blockArray = Array.isArray(pageXml.block) ? pageXml.block : [pageXml.block];

    for (const block of blockArray) {
      if (block.line) {
        const lines = Array.isArray(block.line) ? block.line : [block.line];

        for (const line of lines) {
          if (line.word) {
            const words = Array.isArray(line.word) ? line.word : [line.word];

            for (const word of words) {
              if (word.$ && word._) {
                blocks.push({
                  text: word._,
                  bbox: {
                    left: parseFloat(word.$.xMin),
                    top: parseFloat(word.$.yMin),
                    right: parseFloat(word.$.xMax),
                    bottom: parseFloat(word.$.yMax),
                    page: 0 // Will be set by caller
                  }
                });
              }
            }
          }
        }
      }
    }
  }

  return blocks;
}

/**
 * Collect bounding boxes for a sequence of words
 */
function collectBoundingBoxes(
  blocks: Array<{ text: string; bbox: BoundingBox }>,
  startIndex: number,
  wordCount: number
): BoundingBox[] {
  const boxes: BoundingBox[] = [];
  const endIndex = Math.min(startIndex + wordCount, blocks.length);

  for (let i = startIndex; i < endIndex; i++) {
    boxes.push(blocks[i].bbox);
  }

  // Merge adjacent boxes on the same line
  return mergeBoundingBoxes(boxes);
}

/**
 * Merge adjacent bounding boxes into larger regions
 */
function mergeBoundingBoxes(boxes: BoundingBox[]): BoundingBox[] {
  if (boxes.length === 0) return [];

  const merged: BoundingBox[] = [];
  let current = { ...boxes[0] };

  for (let i = 1; i < boxes.length; i++) {
    const box = boxes[i];

    // Check if boxes are on the same line (within 5 points vertically)
    const sameLine = Math.abs(box.top - current.top) < 5;

    // Check if boxes are close horizontally (within 10 points)
    const closeHorizontally = box.left - current.right < 10;

    if (sameLine && closeHorizontally) {
      // Merge into current box
      current.right = Math.max(current.right, box.right);
      current.bottom = Math.max(current.bottom, box.bottom);
      current.top = Math.min(current.top, box.top);
    } else {
      // Start a new box
      merged.push(current);
      current = { ...box };
    }
  }

  merged.push(current);
  return merged;
}

/**
 * Normalize text for fuzzy matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '')
    .trim();
}

/**
 * Highlight options for annotating PDFs
 */
export interface HighlightOptions {
  /** Highlight color in RGB hex (e.g., "FFFF00" for yellow) */
  color?: string;
  /** Opacity (0.0-1.0) */
  opacity?: number;
  /** Add margin notes with citation info */
  addMarginNotes?: boolean;
  /** Border width for bounding boxes */
  borderWidth?: number;
  /** Style: 'highlight' (transparent overlay) or 'box' (border only) */
  style?: 'highlight' | 'box';
}

/**
 * Create annotated PDF with highlighted citations
 *
 * Uses pdf-lib to add visual annotations showing exactly where cited text is located.
 *
 * @param pdfPath - Input PDF path
 * @param outputPath - Output PDF path
 * @param localizedCitations - Citations with bounding boxes
 * @param options - Highlight styling options
 *
 * @example
 * ```typescript
 * // Localize citations
 * const localized = await localizeCitations('paper.pdf', sources);
 *
 * // Create annotated PDF with yellow highlights
 * await createAnnotatedPDF(
 *   'paper.pdf',
 *   'paper_annotated.pdf',
 *   localized,
 *   { color: 'FFFF00', opacity: 0.3, style: 'highlight' }
 * );
 * ```
 */
export async function createAnnotatedPDF(
  pdfPath: string,
  outputPath: string,
  localizedCitations: LocalizedCitation[],
  options: HighlightOptions = {}
): Promise<void> {
  const {
    color = 'FFFF00', // Yellow
    opacity = 0.3,
    addMarginNotes = true,
    borderWidth = 2,
    style = 'highlight'
  } = options;

  console.log(`[CitationLocalizer] Creating annotated PDF with ${localizedCitations.length} citations...`);

  const pdfLib = await import('pdf-lib');
  const { PDFDocument, rgb } = pdfLib;

  // Load PDF
  const existingPdfBytes = readFileSync(pdfPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);
  const pages = pdfDoc.getPages();

  // Add annotations for each citation
  for (const citation of localizedCitations) {
    if (citation.boundingBoxes.length === 0) continue;

    const pageIndex = citation.pageNumber! - 1;
    const page = pages[pageIndex];
    const { height } = page.getSize();

    // Convert color hex to RGB
    const r = parseInt(color.slice(0, 2), 16) / 255;
    const g = parseInt(color.slice(2, 4), 16) / 255;
    const b = parseInt(color.slice(4, 6), 16) / 255;

    // Draw each bounding box
    for (const box of citation.boundingBoxes) {
      // PDF coordinates: origin at bottom-left, y increases upward
      const x = box.left;
      const y = height - box.bottom; // Flip Y coordinate
      const width = box.right - box.left;
      const boxHeight = box.bottom - box.top;

      if (style === 'highlight') {
        // Draw semi-transparent highlight
        page.drawRectangle({
          x,
          y,
          width,
          height: boxHeight,
          color: rgb(r, g, b),
          opacity
        });
      } else {
        // Draw border only
        page.drawRectangle({
          x,
          y,
          width,
          height: boxHeight,
          borderColor: rgb(r, g, b),
          borderWidth,
          opacity: 1
        });
      }
    }

    // Add margin note if requested
    if (addMarginNotes && citation.boundingBoxes.length > 0) {
      const firstBox = citation.boundingBoxes[0];
      const noteX = page.getSize().width - 150; // 150 points from right edge
      const noteY = height - firstBox.top - 10;

      page.drawText(`[${citation.index}]`, {
        x: noteX,
        y: noteY,
        size: 10,
        color: rgb(r, g, b)
      });
    }
  }

  // Save annotated PDF
  const pdfBytes = await pdfDoc.save();
  writeFileSync(outputPath, pdfBytes);

  console.log(`[CitationLocalizer] ✓ Created annotated PDF: ${outputPath}`);
}

/**
 * Complete pipeline: Extract → Localize → Annotate
 *
 * One-shot function that does everything.
 *
 * @param pdfPath - Input PDF
 * @param citations - Citation sources from Claude
 * @param outputPath - Output annotated PDF
 * @param options - Highlight options
 * @returns Localized citations with bounding boxes
 */
export async function createCitationVisualValidation(
  pdfPath: string,
  citations: CitationSource[],
  outputPath: string,
  options: HighlightOptions = {}
): Promise<LocalizedCitation[]> {
  console.log('\n🎯 Citation Visual Validation Pipeline');
  console.log('━'.repeat(80));

  // Step 1: Localize citations
  console.log('\nStep 1: Finding exact locations in PDF...');
  const localized = await localizeCitations(pdfPath, citations);

  const foundCount = localized.filter(c => c.boundingBoxes.length > 0).length;
  console.log(`✓ Located ${foundCount}/${citations.length} citations`);

  // Step 2: Create annotated PDF
  console.log('\nStep 2: Creating annotated PDF...');
  await createAnnotatedPDF(pdfPath, outputPath, localized, options);

  console.log('\n━'.repeat(80));
  console.log(`✅ Visual validation complete!`);
  console.log(`   Input:  ${pdfPath}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Located: ${foundCount}/${citations.length} citations`);

  return localized;
}
