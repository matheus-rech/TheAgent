/**
 * TheAgent - Hybrid Medical Research Data Extraction Agent
 *
 * A modular agent combining 6 specialized capabilities:
 * 1. Full-PDF Deep Extractor
 * 2. Table & Figure Extractor
 * 3. Imaging Metrics Extractor
 * 4. Outcome Harmonizer
 * 5. IPD Reconstructor
 * 6. Multi-Source Fuser
 */

import type {
  ExtractionOptions,
  ProcessingResult,
  CerebellumExtractionData,
  ModuleName,
} from './types/index.js';

import { FullPdfExtractor } from './modules/full-pdf-extractor.js';
import { TableFigureExtractor } from './modules/table-figure-extractor.js';
import { ImagingMetricsExtractor } from './modules/imaging-extractor.js';
import { OutcomeHarmonizer } from './modules/outcome-harmonizer.js';
import { IpdReconstructor } from './modules/ipd-reconstructor.js';
import { MultiSourceFuser } from './modules/multi-source-fuser.js';
import { CitationExtractor } from './modules/citation-extractor.js';

export * from './types/index.js';
export { PdfOperations } from './utils/pdf-operations.js';
export { PdfBBoxExtractor } from './utils/pdf-bbox-extractor.js';
export { PdfAnnotator } from './modules/pdf-annotator.js';
export { CitationExtractor, validateDOI, searchPubMed, toVancouverFormat, toBibTeXFormat } from './modules/citation-extractor.js';
export { getDoclingClient, DoclingMcpClient } from './utils/docling-mcp-client.js';
export {
  performStructuredExtraction,
  extractCerebellumStudyData,
  extractMethodsSection,
  extractResultsSection,
  extractCitationsStructured,
  CEREBELLAR_STUDY_EXTRACTION_TOOL,
  METHODS_EXTRACTION_TOOL,
  RESULTS_EXTRACTION_TOOL,
  CITATION_EXTRACTION_TOOL
} from './utils/structured-extraction.js';
export {
  extractCitationSources,
  displayCitationSources,
  formatCitationSources,
  generateCitationHTML,
  generateCitationMarkdown,
  linkDataToCitations,
  createExtractionWithSources,
  type CitationSource,
  type ExtractionWithSources
} from './utils/citation-display.js';
export {
  localizeCitations,
  createAnnotatedPDF,
  createCitationVisualValidation,
  type LocalizedCitation,
  type BoundingBox,
  type HighlightOptions
} from './utils/citation-localizer.js';

/**
 * Main TheAgent class - orchestrates all extraction modules
 */
export class TheAgent {
  private fullPdfExtractor: FullPdfExtractor;
  private tableExtractor: TableFigureExtractor;
  private imagingExtractor: ImagingMetricsExtractor;
  private outcomeHarmonizer: OutcomeHarmonizer;
  private ipdReconstructor: IpdReconstructor;
  private multiSourceFuser: MultiSourceFuser;
  private citationExtractor: CitationExtractor;

  private options: ExtractionOptions;

  constructor(options: ExtractionOptions = {}) {
    this.options = {
      model: options.model || 'claude-sonnet-4-5-20250929',
      maxTokens: options.maxTokens || 4096,
      temperature: options.temperature || 0.0,
      verbose: options.verbose || false,
      modules: options.modules || ['full-pdf', 'tables', 'imaging', 'harmonizer', 'ipd', 'citations', 'fuser'],
    };

    // Initialize all modules
    this.fullPdfExtractor = new FullPdfExtractor(this.isModuleEnabled('full-pdf'));
    this.tableExtractor = new TableFigureExtractor(this.isModuleEnabled('tables'));
    this.imagingExtractor = new ImagingMetricsExtractor(this.isModuleEnabled('imaging'));
    this.outcomeHarmonizer = new OutcomeHarmonizer(this.isModuleEnabled('harmonizer'));
    this.ipdReconstructor = new IpdReconstructor(this.isModuleEnabled('ipd'));
    this.citationExtractor = new CitationExtractor(this.isModuleEnabled('citations'));
    this.multiSourceFuser = new MultiSourceFuser(this.isModuleEnabled('fuser'));

    this.log('TheAgent initialized with modules:', this.options.modules);
  }

  /**
   * Process a single PDF paper
   *
   * This is the main entry point for processing a single research paper.
   * It orchestrates all enabled modules in the optimal order.
   *
   * @param pdfPath - Path to the PDF file
   * @param sourceMeta - Optional metadata about the source
   * @returns Complete extraction result
   */
  async processPaper(
    pdfPath: string,
    sourceMeta?: {
      type?: 'main-paper' | 'supplement' | 'erratum' | 'protocol' | 'registry';
      url?: string;
    }
  ): Promise<ProcessingResult> {
    const startTime = Date.now();
    const modulesExecuted: ModuleName[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    try {
      this.log(`Processing paper: ${pdfPath}${sourceMeta?.type ? ` (${sourceMeta.type})` : ''}`);

      // Initialize extraction data
      const extractionData: Partial<CerebellumExtractionData> = {};

      // Step 1: Full-PDF extraction (provides context for other modules)
      if (this.fullPdfExtractor.enabled) {
        this.log('Running Full-PDF Deep Extractor...');
        try {
          const fullPdfResult = await this.fullPdfExtractor.process({ pdfPath }, this.options);
          modulesExecuted.push('full-pdf');

          // Store results
          extractionData.methods = fullPdfResult.methods;
          extractionData.results = fullPdfResult.results;
          extractionData.discussion = fullPdfResult.discussion;

          this.log(`Extracted ${fullPdfResult.page_count} pages with ${fullPdfResult.sections_found.length} sections`);
        } catch (error) {
          errors.push(`Full-PDF extraction failed: ${error}`);
        }
      }

      // Step 2: Table & Figure extraction
      if (this.tableExtractor.enabled) {
        this.log('Running Table & Figure Extractor...');
        try {
          const tableResult = await this.tableExtractor.process({ pdfPath }, this.options);
          modulesExecuted.push('tables');

          extractionData.tables = tableResult.tables;
          this.log(`Extracted ${tableResult.tables.length} tables using ${tableResult.extraction_method}`);
        } catch (error) {
          errors.push(`Table extraction failed: ${error}`);
        }
      }

      // Step 3: Imaging metrics extraction
      if (this.imagingExtractor.enabled && extractionData.methods?.extracted_text) {
        this.log('Running Imaging Metrics Extractor...');
        try {
          const imagingResult = await this.imagingExtractor.process(
            {
              fullText: extractionData.methods.extracted_text,
              tables: extractionData.tables,
            },
            this.options
          );
          modulesExecuted.push('imaging');

          extractionData.imaging = imagingResult.metrics;
          this.log(`Extracted imaging metrics with ${imagingResult.confidence} confidence`);

          if (imagingResult.confidence < 0.5) {
            warnings.push('Low confidence in imaging metrics extraction');
          }
        } catch (error) {
          errors.push(`Imaging extraction failed: ${error}`);
        }
      }

      // Step 4: Outcome harmonization
      if (this.outcomeHarmonizer.enabled && extractionData.results) {
        this.log('Running Outcome Harmonizer...');
        try {
          const outcomeResult = await this.outcomeHarmonizer.process(
            {
              outcomes: {
                mortality: extractionData.outcomes?.mortality,
                mRS_favorable: extractionData.outcomes?.mRS_favorable,
              },
            },
            this.options
          );
          modulesExecuted.push('harmonizer');

          extractionData.harmonized_outcomes = outcomeResult.harmonized;
          this.log(`Harmonized outcomes to ${outcomeResult.harmonized.timepoints.length} standard timepoints`);

          if (outcomeResult.harmonized.confidence === 'low') {
            warnings.push('Low confidence in outcome harmonization');
          }
        } catch (error) {
          errors.push(`Outcome harmonization failed: ${error}`);
        }
      }

      // Step 5: IPD reconstruction
      if (this.ipdReconstructor.enabled && extractionData.figures) {
        this.log('Running IPD Reconstructor...');
        try {
          const ipdResult = await this.ipdReconstructor.process(
            {
              kaplanMeierFigures: extractionData.figures?.filter((f) => f.type === 'kaplan-meier'),
            },
            this.options
          );
          modulesExecuted.push('ipd');

          extractionData.ipd = ipdResult.patients;
          this.log(`Reconstructed ${ipdResult.patients.length} patient records using ${ipdResult.reconstruction_method}`);

          warnings.push(...ipdResult.warnings);
        } catch (error) {
          errors.push(`IPD reconstruction failed: ${error}`);
        }
      }

      // Step 6: Citation extraction
      if (this.citationExtractor.enabled) {
        this.log('Running Citation Extractor...');
        try {
          const citationResult = await this.citationExtractor.process(
            {
              pdfPath: pdfPath,
              validateDOIs: true,
              validatePubMed: true,
              outputFormat: 'vancouver', // Medical papers use Vancouver style
            },
            this.options
          );
          modulesExecuted.push('citations');

          extractionData.citations = citationResult.citations as any; // Type will match CitationData[]
          extractionData.citations_metadata = {
            total_extracted: citationResult.total_extracted,
            valid_citations: citationResult.valid_citations,
            average_quality: citationResult.average_quality,
            duplicates_removed: citationResult.duplicates_detected,
          };

          this.log(`Extracted ${citationResult.valid_citations} valid citations (avg quality: ${citationResult.average_quality.toFixed(2)})`);

          if (citationResult.average_quality < 0.75) {
            warnings.push('Low average citation quality - manual review recommended');
          }
          if (citationResult.duplicates_detected > 0) {
            this.log(`Removed ${citationResult.duplicates_detected} duplicate citations`);
          }
        } catch (error) {
          errors.push(`Citation extraction failed: ${error}`);
        }
      }

      const executionTime = Date.now() - startTime;

      this.log(`Processing complete in ${executionTime}ms`);
      this.log(`Modules executed: ${modulesExecuted.join(', ')}`);

      if (warnings.length > 0) {
        this.log(`Warnings: ${warnings.length}`);
      }

      if (errors.length > 0) {
        this.log(`Errors: ${errors.length}`);
      }

      return {
        success: errors.length === 0,
        data: extractionData as CerebellumExtractionData,
        modules_executed: modulesExecuted,
        execution_time_ms: executionTime,
        warnings,
        errors,
      };
    } catch (error) {
      throw new Error(`TheAgent processing failed: ${error}`);
    }
  }

  /**
   * Process multiple sources and fuse them together
   *
   * Use this when you have:
   * - Main paper + supplementary materials
   * - Main paper + erratum
   * - Main paper + protocol/registry data
   *
   * @param sources - Array of {pdfPath, type} for each source
   * @returns Fused extraction result
   */
  async processMultiSource(
    sources: Array<{
      pdfPath: string;
      type: 'main-paper' | 'supplement' | 'erratum' | 'protocol' | 'registry';
      url?: string;
    }>
  ): Promise<ProcessingResult> {
    this.log(`Processing ${sources.length} sources for multi-source fusion...`);

    const startTime = Date.now();
    const allModulesExecuted: Set<ModuleName> = new Set();
    const allWarnings: string[] = [];
    const allErrors: string[] = [];

    // Process each source individually
    const processedSources = [];

    for (const source of sources) {
      this.log(`Processing source: ${source.type} - ${source.pdfPath}`);

      try {
        const result = await this.processPaper(source.pdfPath, source);

        processedSources.push({
          type: source.type,
          data: result.data,
          url: source.url,
          file_path: source.pdfPath,
          extraction_date: new Date().toISOString(),
        });

        // Accumulate modules executed
        result.modules_executed.forEach((m) => allModulesExecuted.add(m));
        allWarnings.push(...result.warnings);
        allErrors.push(...result.errors);
      } catch (error) {
        allErrors.push(`Failed to process ${source.type}: ${error}`);
      }
    }

    // Fuse all sources together
    if (this.multiSourceFuser.enabled && processedSources.length > 1) {
      this.log('Fusing data from all sources...');

      try {
        const fusionResult = await this.multiSourceFuser.process(
          { sources: processedSources },
          this.options
        );

        allModulesExecuted.add('fuser');

        this.log(`Fusion complete with ${fusionResult.conflicts.length} conflicts resolved`);

        const executionTime = Date.now() - startTime;

        return {
          success: allErrors.length === 0,
          data: fusionResult.combined_data as CerebellumExtractionData,
          modules_executed: Array.from(allModulesExecuted),
          execution_time_ms: executionTime,
          warnings: allWarnings,
          errors: allErrors,
        };
      } catch (error) {
        allErrors.push(`Multi-source fusion failed: ${error}`);
      }
    }

    // If fusion fails or is disabled, return the first source's data
    const executionTime = Date.now() - startTime;

    return {
      success: allErrors.length === 0,
      data: processedSources[0].data as CerebellumExtractionData,
      modules_executed: Array.from(allModulesExecuted),
      execution_time_ms: executionTime,
      warnings: allWarnings,
      errors: allErrors,
    };
  }

  /**
   * Check if a module is enabled
   */
  private isModuleEnabled(module: ModuleName): boolean {
    return this.options.modules?.includes(module) ?? true;
  }

  /**
   * Log helper
   */
  private log(...args: any[]): void {
    if (this.options.verbose) {
      console.log('[TheAgent]', ...args);
    }
  }
}

// Default export
export default TheAgent;
