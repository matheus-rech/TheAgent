/**
 * Visual Testing Pipeline Example
 *
 * This example demonstrates how to use the visual testing pipeline
 * to validate TheAgent's extraction with screenshots and HTML reports.
 *
 * Prerequisites:
 * 1. Install dependencies: npm install
 * 2. Set ANTHROPIC_API_KEY in .env
 * 3. Install Docling MCP: uvx --from=docling-mcp docling-mcp-server --help
 * 4. Download test paper (see instructions below)
 *
 * Usage:
 * ```bash
 * # Run with TypeScript
 * npx tsx examples/visual-testing-example.ts
 *
 * # Or use the CLI directly
 * npm run cli -- visual-test test_papers/beez2019.pdf --verbose
 * ```
 */

import { runVisualTestingPipeline } from '../src/utils/visual-testing-pipeline.js';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main() {
  console.log('🧪 Visual Testing Pipeline Example\n');
  console.log('━'.repeat(80));

  // Example 1: Test with Beez et al. (2019) paper
  const testPapersDir = join(__dirname, '..', 'test_papers');
  const beezPaper = join(testPapersDir, 'beez2019.pdf');

  if (!existsSync(beezPaper)) {
    console.log('📥 Test paper not found. Please download it first:\n');
    console.log('  mkdir -p test_papers');
    console.log('  cd test_papers');
    console.log(
      '  wget -O beez2019.pdf "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf"'
    );
    console.log('\nOr use curl:');
    console.log(
      '  curl -L "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf" -o test_papers/beez2019.pdf'
    );
    console.log('\nThen run this example again.\n');
    process.exit(1);
  }

  console.log('📄 Testing with: Beez et al. (2019)');
  console.log('   Title: Decompressive craniectomy for acute ischemic stroke');
  console.log('   Journal: Critical Care');
  console.log('   DOI: 10.1186/s13054-019-2490-x\n');
  console.log('━'.repeat(80) + '\n');

  try {
    // Run visual testing pipeline
    const result = await runVisualTestingPipeline(beezPaper, {
      // Output directory (default: ./visual-tests/<pdf-name>)
      outputDir: join(testPapersDir, 'visual-tests', 'beez2019'),

      // Modules to test
      modules: ['full-pdf', 'tables', 'imaging', 'harmonizer'],

      // Generate HTML report
      generateReport: true,

      // Generate annotated PDF with citation highlights
      generateAnnotatedPDF: true,

      // Create full-page screenshots
      createPageScreenshots: true,

      // Maximum pages for screenshots
      maxPages: 10,

      // Verbose logging
      verbose: true,

      // Screenshot resolution
      screenshotDPI: 300,
    });

    // Display results summary
    console.log('\n' + '━'.repeat(80));
    console.log('📊 Test Results Summary');
    console.log('━'.repeat(80));

    console.log(`\n✅ Success!`);
    console.log(`   - Modules: ${result.summary.modulesExecuted.join(', ')}`);
    console.log(
      `   - Execution Time: ${(result.summary.executionTimeMs / 1000).toFixed(2)}s`
    );

    console.log(`\n📸 Screenshots Generated: ${result.screenshots.total}`);
    console.log(`   - Tables: ${result.screenshots.tables}`);
    console.log(`   - Figures: ${result.screenshots.figures}`);
    console.log(`   - Imaging: ${result.screenshots.imaging}`);
    console.log(`   - Citations: ${result.screenshots.citations}`);
    console.log(`   - Pages: ${result.screenshots.pages}`);

    console.log(`\n📊 Extraction Quality:`);
    console.log(`   - Tables Extracted: ${result.summary.totalTables}`);
    console.log(`   - Figures Found: ${result.summary.totalFigures}`);
    console.log(`   - Citations: ${result.summary.totalCitations}`);
    console.log(`   - Warnings: ${result.summary.warnings}`);
    console.log(`   - Errors: ${result.summary.errors}`);

    console.log(`\n📁 Output Files:`);
    console.log(`   - Screenshots: ${result.screenshotDir}`);
    if (result.reportPath) {
      console.log(`   - HTML Report: ${result.reportPath}`);
    }
    if (result.annotatedPdfPath) {
      console.log(`   - Annotated PDF: ${result.annotatedPdfPath}`);
    }

    console.log('\n━'.repeat(80));
    console.log('🎯 Next Steps:');
    console.log('━'.repeat(80));

    if (result.reportPath) {
      console.log('\n1. Open HTML report in browser:');
      console.log(`   open "${result.reportPath}"`);
    }

    if (result.annotatedPdfPath) {
      console.log('\n2. Review annotated PDF with citation highlights:');
      console.log(`   open "${result.annotatedPdfPath}"`);
    }

    console.log('\n3. Browse screenshot directory:');
    console.log(`   open "${result.screenshotDir}"`);

    console.log('\n4. Validate extraction quality:');
    console.log('   - Check table screenshots match extracted JSON');
    console.log('   - Verify citation provenance (yellow highlights)');
    console.log('   - Review imaging metric source regions');
    console.log('   - Confirm figure annotations are accurate\n');

    console.log('━'.repeat(80) + '\n');
  } catch (error) {
    console.error('\n❌ Error running visual testing pipeline:', error);
    process.exit(1);
  }
}

// Run example
main().catch(console.error);
