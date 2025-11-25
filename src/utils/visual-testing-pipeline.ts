/**
 * Visual Testing Pipeline - Automated Agent Testing with Screenshots
 *
 * Complete end-to-end testing pipeline that:
 * 1. Runs all extraction modules on a PDF
 * 2. Generates screenshots for every extraction step
 * 3. Creates comprehensive HTML validation report
 * 4. Returns all results for programmatic testing
 *
 * Usage:
 * ```typescript
 * const result = await runVisualTestingPipeline('paper.pdf');
 * console.log(`Report: ${result.reportPath}`);
 * ```
 */

import { existsSync, mkdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { ProcessingResult } from '../types/index.js';
import {
  extractTableScreenshots,
  extractFigureScreenshots,
  extractImagingScreenshots,
  createPageScreenshots,
  TableScreenshot,
  FigureScreenshot,
} from './visual-extractor.js';
import {
  generateVisualValidationHTML,
  VisualValidationReport,
} from './visual-report.js';
import {
  localizeCitations,
  createAnnotatedPDF,
  LocalizedCitation,
} from './citation-localizer.js';
// Citation sources extracted from extraction result data

/**
 * Options for visual testing pipeline
 */
export interface VisualTestingOptions {
  /** Output directory for screenshots and reports (default: ./visual-tests/<pdf-name>) */
  outputDir?: string;

  /** Modules to run (default: all modules) */
  modules?: string[];

  /** Generate HTML report (default: true) */
  generateReport?: boolean;

  /** Generate annotated PDF with citation highlights (default: true) */
  generateAnnotatedPDF?: boolean;

  /** Create full-page screenshots (default: true, max 10 pages) */
  createPageScreenshots?: boolean;

  /** Maximum pages for full-page screenshots (default: 10) */
  maxPages?: number;

  /** Verbose logging (default: false) */
  verbose?: boolean;

  /** DPI for screenshots (default: 300) */
  screenshotDPI?: number;
}

/**
 * Result from visual testing pipeline
 */
export interface VisualTestingResult {
  /** Extraction result from TheAgent */
  extractionResult: ProcessingResult;

  /** Visual validation report data */
  report: VisualValidationReport;

  /** Path to HTML report */
  reportPath: string;

  /** Path to annotated PDF (with citation highlights) */
  annotatedPdfPath?: string;

  /** Directory containing all screenshots */
  screenshotDir: string;

  /** Screenshot counts */
  screenshots: {
    tables: number;
    figures: number;
    imaging: number;
    citations: number;
    pages: number;
    total: number;
  };

  /** Test summary */
  summary: {
    pdfFilename: string;
    modulesExecuted: string[];
    totalTables: number;
    totalFigures: number;
    totalCitations: number;
    warnings: number;
    errors: number;
    executionTimeMs: number;
  };
}

/**
 * Run complete visual testing pipeline
 *
 * This is the main automated testing function that orchestrates all steps:
 * - PDF extraction with all modules
 * - Screenshot generation for tables, figures, imaging, citations
 * - HTML report generation
 * - Citation provenance highlighting
 *
 * @param pdfPath - Path to PDF file to test
 * @param options - Testing options
 * @returns Complete test results with paths and statistics
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await runVisualTestingPipeline('paper.pdf');
 * console.log(`Report: ${result.reportPath}`);
 * console.log(`Screenshots: ${result.screenshots.total}`);
 *
 * // Custom options
 * const result = await runVisualTestingPipeline('paper.pdf', {
 *   outputDir: './my-tests',
 *   modules: ['full-pdf', 'tables', 'imaging'],
 *   verbose: true,
 * });
 * ```
 */
export async function runVisualTestingPipeline(
  pdfPath: string,
  options: VisualTestingOptions = {}
): Promise<VisualTestingResult> {
  const startTime = Date.now();

  // Validate PDF exists
  if (!existsSync(pdfPath)) {
    throw new Error(`PDF file not found: ${pdfPath}`);
  }

  // Setup options with defaults
  const {
    modules = ['full-pdf', 'tables', 'imaging', 'harmonizer', 'ipd'],
    generateReport = true,
    generateAnnotatedPDF = true,
    createPageScreenshots: createPages = true,
    maxPages = 10,
    verbose = false,
  } = options;

  const pdfFilename = basename(pdfPath);
  const pdfBasename = pdfFilename.replace(/\.pdf$/i, '');

  // Create output directory
  const outputDir =
    options.outputDir || join(dirname(pdfPath), 'visual-tests', pdfBasename);

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const screenshotDir = join(outputDir, 'screenshots');
  if (!existsSync(screenshotDir)) {
    mkdirSync(screenshotDir, { recursive: true });
  }

  if (verbose) {
    console.log('\n🧪 Visual Testing Pipeline');
    console.log('━'.repeat(80));
    console.log(`PDF: ${pdfFilename}`);
    console.log(`Output: ${outputDir}`);
    console.log(`Modules: ${modules.join(', ')}`);
    console.log('━'.repeat(80));
  }

  // Step 1: Run extraction with TheAgent
  if (verbose) console.log('\n📄 Step 1: Running extraction...');

  // Import TheAgent dynamically to avoid circular dependencies
  const { TheAgent } = await import('../index.js');

  const agent = new TheAgent({
    modules: modules as any,
    verbose,
  });

  const extractionResult = await agent.processPaper(pdfPath);

  if (verbose) {
    console.log(
      `✓ Extraction complete (${extractionResult.modules_executed.length} modules)`
    );
  }

  // Step 2: Generate table screenshots
  if (verbose) console.log('\n📊 Step 2: Generating table screenshots...');

  const tableScreenshots: TableScreenshot[] = [];

  if (extractionResult.data.tables && extractionResult.data.tables.length > 0) {
    try {
      const screenshots = await extractTableScreenshots(
        pdfPath,
        extractionResult.data.tables.map((table, index) => ({
          name: table.title || `Table ${table.table_number || index + 1}`,
          page: table.page || 1,
          boundingBox: undefined, // Bounding box not available in TableData type
          data: table,
          confidence: table.extracted_type === 'docling' ? 0.95 : table.extracted_type === 'vision' ? 0.80 : 0.70,
        })),
        join(screenshotDir, 'tables')
      );
      tableScreenshots.push(...screenshots);

      if (verbose) console.log(`✓ Created ${screenshots.length} table screenshots`);
    } catch (error) {
      console.error('Failed to generate table screenshots:', error);
    }
  } else {
    if (verbose) console.log('ℹ No tables found');
  }

  // Step 3: Generate figure screenshots
  if (verbose) console.log('\n🖼️  Step 3: Generating figure screenshots...');

  const figureScreenshots: FigureScreenshot[] = [];

  if (extractionResult.data.figures && extractionResult.data.figures.length > 0) {
    try {
      const screenshots = await extractFigureScreenshots(
        pdfPath,
        extractionResult.data.figures.map((figure, index) => ({
          name: figure.title || `Figure ${figure.figure_number || index + 1}`,
          type: figure.type || 'other',
          page: figure.page || 1,
          boundingBox: undefined, // Bounding box not available in FigureData type
          data: figure,
          annotations: figure.data_points, // Use data_points as annotations
        })),
        join(screenshotDir, 'figures')
      );
      figureScreenshots.push(...screenshots);

      if (verbose) console.log(`✓ Created ${screenshots.length} figure screenshots`);
    } catch (error) {
      console.error('Failed to generate figure screenshots:', error);
    }
  } else {
    if (verbose) console.log('ℹ No figures found');
  }

  // Step 4: Generate imaging metric screenshots
  if (verbose)
    console.log('\n🧠 Step 4: Generating imaging metric screenshots...');

  const imagingScreenshots: Array<{
    field: string;
    screenshotPath: string;
    value: any;
  }> = [];

  if (extractionResult.data.imaging) {
    try {
      const screenshots = await extractImagingScreenshots(
        pdfPath,
        extractionResult.data.imaging,
        join(screenshotDir, 'imaging')
      );
      imagingScreenshots.push(...screenshots);

      if (verbose) console.log(`✓ Created ${screenshots.length} imaging screenshots`);
    } catch (error) {
      console.error('Failed to generate imaging screenshots:', error);
    }
  } else {
    if (verbose) console.log('ℹ No imaging data found');
  }

  // Step 5: Localize citations and create annotated PDF
  if (verbose) console.log('\n📚 Step 5: Localizing citations...');

  let localizedCitations: LocalizedCitation[] = [];
  let annotatedPdfPath: string | undefined;

  // Check if extraction result has citations
  // Citations are stored in extractionResult.data.citations as CitationData[]
  // We need to convert them to CitationSource[] format for localization
  const citationData = extractionResult.data.citations || [];

  // Convert CitationData to CitationSource format for localization
  // Use raw_text as citedText since that's what appears in the PDF
  const citationSources = citationData.map((citation, index) => ({
    index: index + 1,
    type: 'page_location' as const,
    citedText: citation.raw_text || `${citation.authors}. ${citation.title}`,
    documentTitle: citation.title,
    pageNumber: undefined, // Will be found during localization
  }));

  if (citationSources.length > 0) {
    try {
      localizedCitations = await localizeCitations(pdfPath, citationSources);

      if (verbose) {
        const foundCount = localizedCitations.filter(
          (c) => c.boundingBoxes && c.boundingBoxes.length > 0
        ).length;
        console.log(`✓ Localized ${foundCount}/${citationSources.length} citations`);
      }

      // Create annotated PDF with citation highlights
      if (generateAnnotatedPDF) {
        annotatedPdfPath = join(outputDir, `${pdfBasename}_annotated.pdf`);

        await createAnnotatedPDF(pdfPath, annotatedPdfPath, localizedCitations, {
          color: 'FFFF00', // Yellow
          opacity: 0.3,
          style: 'highlight',
          addMarginNotes: true,
        });

        if (verbose) console.log(`✓ Created annotated PDF: ${annotatedPdfPath}`);
      }
    } catch (error) {
      console.error('Failed to localize citations:', error);
    }
  } else {
    if (verbose) console.log('ℹ No citations found');
  }

  // Step 6: Create full-page screenshots
  if (verbose) console.log('\n📄 Step 6: Creating page screenshots...');

  let pageScreenshots: string[] = [];

  if (createPages) {
    try {
      pageScreenshots = await createPageScreenshots(
        pdfPath,
        join(screenshotDir, 'pages'),
        maxPages
      );

      if (verbose) console.log(`✓ Created ${pageScreenshots.length} page screenshots`);
    } catch (error) {
      console.error('Failed to create page screenshots:', error);
    }
  }

  // Step 7: Generate HTML validation report
  if (verbose) console.log('\n📊 Step 7: Generating HTML report...');

  let reportPath = '';

  if (generateReport) {
    const report: VisualValidationReport = {
      pdfFilename,
      extractionResult,
      tableScreenshots,
      figureScreenshots,
      citations: localizedCitations,
      imagingScreenshots,
      pageScreenshots,
      timestamp: new Date(),
    };

    reportPath = join(outputDir, `${pdfBasename}_validation_report.html`);

    generateVisualValidationHTML(report, reportPath);

    if (verbose) console.log(`✓ Created HTML report: ${reportPath}`);
  }

  // Calculate statistics
  const executionTimeMs = Date.now() - startTime;

  const totalScreenshots =
    tableScreenshots.length +
    figureScreenshots.length +
    imagingScreenshots.length +
    localizedCitations.filter((c) => c.boundingBoxes && c.boundingBoxes.length > 0)
      .length +
    pageScreenshots.length;

  const result: VisualTestingResult = {
    extractionResult,
    report: {
      pdfFilename,
      extractionResult,
      tableScreenshots,
      figureScreenshots,
      citations: localizedCitations,
      imagingScreenshots,
      pageScreenshots,
      timestamp: new Date(),
    },
    reportPath,
    annotatedPdfPath,
    screenshotDir,
    screenshots: {
      tables: tableScreenshots.length,
      figures: figureScreenshots.length,
      imaging: imagingScreenshots.length,
      citations: localizedCitations.filter(
        (c) => c.boundingBoxes && c.boundingBoxes.length > 0
      ).length,
      pages: pageScreenshots.length,
      total: totalScreenshots,
    },
    summary: {
      pdfFilename,
      modulesExecuted: extractionResult.modules_executed,
      totalTables: extractionResult.data.tables?.length || 0,
      totalFigures: extractionResult.data.figures?.length || 0,
      totalCitations: citationSources.length,
      warnings: extractionResult.warnings.length,
      errors: extractionResult.errors.length,
      executionTimeMs,
    },
  };

  // Print summary
  if (verbose) {
    console.log('\n' + '━'.repeat(80));
    console.log('✅ Visual Testing Complete!');
    console.log('━'.repeat(80));
    console.log(`📄 PDF: ${pdfFilename}`);
    console.log(`⏱️  Execution Time: ${(executionTimeMs / 1000).toFixed(2)}s`);
    console.log(`📊 Modules: ${extractionResult.modules_executed.length}`);
    console.log(`📸 Screenshots: ${totalScreenshots} total`);
    console.log(`   - Tables: ${tableScreenshots.length}`);
    console.log(`   - Figures: ${figureScreenshots.length}`);
    console.log(`   - Imaging: ${imagingScreenshots.length}`);
    console.log(
      `   - Citations: ${localizedCitations.filter((c) => c.boundingBoxes && c.boundingBoxes.length > 0).length}`
    );
    console.log(`   - Pages: ${pageScreenshots.length}`);
    console.log(`📁 Output: ${outputDir}`);
    if (reportPath) console.log(`📊 Report: ${reportPath}`);
    if (annotatedPdfPath) console.log(`📝 Annotated PDF: ${annotatedPdfPath}`);
    console.log('━'.repeat(80) + '\n');
  }

  return result;
}

/**
 * Quick test function for development
 *
 * Runs visual testing with verbose output and opens report in browser
 */
export async function quickTest(pdfPath: string): Promise<void> {
  const result = await runVisualTestingPipeline(pdfPath, {
    verbose: true,
    generateReport: true,
    generateAnnotatedPDF: true,
  });

  console.log('\n✅ Test complete!');
  console.log(`Report: ${result.reportPath}`);
  console.log(`\nOpen in browser:`);
  console.log(`  open "${result.reportPath}"`);
}
