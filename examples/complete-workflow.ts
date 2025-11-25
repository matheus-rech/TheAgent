/**
 * Complete Workflow Example
 * Demonstrates all TheAgent capabilities including PDF operations
 */

import { TheAgent, PdfOperations } from '../src/index.js';
import type { ModuleName } from '../src/types/index.js';

async function completeWorkflowExample() {
  console.log('🧠 TheAgent Complete Workflow Example\n');

  // ========================================
  // Part 1: PDF Operations (from /pdf skill)
  // ========================================

  console.log('Part 1: PDF Operations');
  console.log('======================\n');

  // 1.1 Extract metadata
  console.log('1.1 Extracting PDF metadata...');
  const metadata = await PdfOperations.getMetadata('paper.pdf');
  console.log('   Title:', metadata.title);
  console.log('   Author:', metadata.author);
  console.log('   Pages:', metadata.pageCount);
  console.log();

  // 1.2 Extract text from specific pages
  console.log('1.2 Extracting text from page 1...');
  const abstractText = await PdfOperations.extractText('paper.pdf');
  console.log('   Extracted', abstractText.length, 'characters');
  console.log();

  // 1.3 Merge supplementary materials
  console.log('1.3 Merging main paper with supplement...');
  await PdfOperations.mergePdfs({
    files: ['paper.pdf', 'supplement.pdf'],
    outputPath: 'merged_paper.pdf',
  });
  console.log('   ✅ Merged PDF created');
  console.log();

  // 1.4 Split PDF into sections (if needed)
  console.log('1.4 Splitting PDF into individual pages...');
  const splitFiles = await PdfOperations.splitPdf({
    inputPath: 'paper.pdf',
    outputPrefix: 'page',
  });
  console.log('   ✅ Split into', splitFiles.length, 'files');
  console.log();

  // 1.5 Extract specific pages
  console.log('1.5 Extracting methods section (pages 5-8)...');
  await PdfOperations.extractPages('paper.pdf', 'methods_section.pdf', [4, 5, 6, 7]); // 0-indexed
  console.log('   ✅ Methods section extracted');
  console.log();

  // 1.6 Rotate pages (if scanned incorrectly)
  console.log('1.6 Rotating supplement pages...');
  await PdfOperations.rotatePdf('supplement.pdf', 'supplement_rotated.pdf', 90);
  console.log('   ✅ Pages rotated 90°');
  console.log();

  // ========================================
  // Part 2: Medical Data Extraction
  // ========================================

  console.log('\nPart 2: Medical Data Extraction');
  console.log('===============================\n');

  // 2.1 Initialize TheAgent with specific modules
  console.log('2.1 Initializing TheAgent...');
  const agent = new TheAgent({
    modules: ['full-pdf', 'tables', 'imaging', 'harmonizer', 'ipd', 'fuser'],
    verbose: true,
  });
  console.log('   ✅ Agent initialized with 6 modules');
  console.log();

  // 2.2 Process single paper
  console.log('2.2 Processing main paper...');
  const result = await agent.processPaper('paper.pdf');

  console.log('   📊 Results:');
  console.log('   - Study:', result.data.authors, result.data.year);
  console.log('   - Title:', result.data.title?.slice(0, 60) + '...');
  console.log('   - Sample size:', result.data.population.sample_size);
  console.log('   - Tables extracted:', result.data.tables?.length || 0);
  console.log('   - Imaging metrics:', result.data.imaging ? 'Yes' : 'No');
  console.log();

  // 2.3 Process multiple sources and fuse
  console.log('2.3 Processing multiple sources with fusion...');
  const fusedResult = await agent.processMultiSource([
    { pdfPath: 'paper.pdf', type: 'main-paper' },
    { pdfPath: 'supplement.pdf', type: 'supplement' },
    { pdfPath: 'erratum.pdf', type: 'erratum' },
  ]);

  console.log('   📊 Fusion Results:');
  console.log('   - Sources processed:', fusedResult.data.sources?.length || 0);
  console.log('   - Conflicts resolved:', fusedResult.warnings.filter((w) => w.includes('conflict')).length);
  console.log('   - Final dataset completeness:', calculateCompleteness(fusedResult.data) + '%');
  console.log();

  // ========================================
  // Part 3: Advanced Capabilities
  // ========================================

  console.log('\nPart 3: Advanced Analysis');
  console.log('=========================\n');

  // 3.1 Outcome harmonization
  if (fusedResult.data.harmonized_outcomes) {
    console.log('3.1 Harmonized Outcomes:');
    fusedResult.data.harmonized_outcomes.timepoints.forEach((tp) => {
      console.log(`   - ${tp.days}-day:`);
      if (tp.mortality !== undefined) console.log(`     Mortality: ${(tp.mortality * 100).toFixed(1)}%`);
      if (tp.mRS_0_2 !== undefined) console.log(`     mRS 0-2: ${(tp.mRS_0_2 * 100).toFixed(1)}%`);
    });
    console.log(`   Confidence: ${fusedResult.data.harmonized_outcomes.confidence}`);
    console.log();
  }

  // 3.2 IPD reconstruction
  if (fusedResult.data.ipd && fusedResult.data.ipd.length > 0) {
    console.log('3.2 Individual Patient Data:');
    console.log(`   - Total patients: ${fusedResult.data.ipd.length}`);
    console.log(`   - Reconstruction method: ${fusedResult.data.ipd[0].reconstruction_method}`);

    const meanAge = fusedResult.data.ipd.filter((p) => p.age).reduce((sum, p) => sum + (p.age || 0), 0) / fusedResult.data.ipd.filter((p) => p.age).length;

    console.log(`   - Mean age: ${meanAge.toFixed(1)} years`);

    const mortality = fusedResult.data.ipd.filter((p) => p.survival_days !== undefined).length / fusedResult.data.ipd.length;

    console.log(`   - Mortality: ${(mortality * 100).toFixed(1)}%`);
    console.log();
  }

  // 3.3 Imaging metrics
  if (fusedResult.data.imaging) {
    console.log('3.3 Neuroimaging Metrics:');
    if (fusedResult.data.imaging.infarct_volume_ml) {
      console.log(`   - Infarct volume: ${fusedResult.data.imaging.infarct_volume_ml} mL`);
    }
    if (fusedResult.data.imaging.edema_volume_ml) {
      console.log(`   - Edema volume: ${fusedResult.data.imaging.edema_volume_ml} mL`);
    }
    if (fusedResult.data.imaging.midline_shift_mm) {
      console.log(`   - Midline shift: ${fusedResult.data.imaging.midline_shift_mm} mm`);
    }
    if (fusedResult.data.imaging.imaging_modality) {
      console.log(`   - Imaging modality: ${fusedResult.data.imaging.imaging_modality}`);
    }
    console.log();
  }

  // ========================================
  // Part 4: Export & Integration
  // ========================================

  console.log('\nPart 4: Export & Integration');
  console.log('============================\n');

  // 4.1 Export to JSON
  console.log('4.1 Exporting to JSON...');
  const { writeFileSync } = await import('fs');
  const outputFile = `${fusedResult.data.study_id || 'extraction'}_complete.json`;
  writeFileSync(outputFile, JSON.stringify(fusedResult.data, null, 2));
  console.log(`   ✅ Saved to ${outputFile}`);
  console.log();

  // 4.2 Export to CSV (for meta-analysis)
  console.log('4.2 Exporting key outcomes to CSV...');
  const csvData = generateCsvExport(fusedResult.data);
  writeFileSync('outcomes.csv', csvData);
  console.log('   ✅ Saved to outcomes.csv');
  console.log();

  // 4.3 Integration with cerebellar-extraction Firebase
  console.log('4.3 Firebase Integration:');
  console.log('   To sync with your web app:');
  console.log('   1. Import Firebase Admin SDK');
  console.log('   2. Upload to: artifacts/cerebellar-extraction/users/{userId}/data/');
  console.log('   3. TheAgent results will appear in your web app!');
  console.log();

  // ========================================
  // Summary
  // ========================================

  console.log('\n✅ Complete Workflow Finished!');
  console.log('================================\n');
  console.log('TheAgent processed:');
  console.log(`  - ${fusedResult.modules_executed.length} modules executed`);
  console.log(`  - ${fusedResult.execution_time_ms}ms total time`);
  console.log(`  - ${fusedResult.warnings.length} warnings`);
  console.log(`  - ${fusedResult.errors.length} errors`);
  console.log();
  console.log('Output files:');
  console.log(`  - ${outputFile} (complete structured data)`);
  console.log('  - outcomes.csv (for meta-analysis)');
  console.log('  - merged_paper.pdf (combined sources)');
  console.log();
}

/**
 * Calculate dataset completeness percentage
 */
function calculateCompleteness(data: any): number {
  const requiredFields = [
    'study_id',
    'authors',
    'year',
    'title',
    'population.sample_size',
    'intervention.procedure',
    'outcomes.mortality',
    'study_design',
  ];

  let filled = 0;
  requiredFields.forEach((field) => {
    const value = field.split('.').reduce((obj, key) => obj?.[key], data);
    if (value && value !== '') filled++;
  });

  return Math.round((filled / requiredFields.length) * 100);
}

/**
 * Generate CSV export for meta-analysis
 */
function generateCsvExport(data: any): string {
  const headers = [
    'study_id',
    'authors',
    'year',
    'design',
    'sample_size',
    'intervention',
    'mortality',
    'mrs_favorable',
    'follow_up_days',
  ];

  const row = [
    data.study_id || '',
    data.authors || '',
    data.year || '',
    data.study_design || '',
    data.population?.sample_size || '',
    data.intervention?.procedure || '',
    data.outcomes?.mortality || '',
    data.outcomes?.mRS_favorable || '',
    data.timing?.follow_up_duration || '',
  ];

  return headers.join(',') + '\n' + row.join(',');
}

// Run the example
completeWorkflowExample().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
