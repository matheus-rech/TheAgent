/**
 * Citation Visual Validation Example
 *
 * Demonstrates the complete pipeline from extraction to visual PDF validation:
 * 1. Extract data with citations enabled
 * 2. Display citation sources (REQUIRED for transparency)
 * 3. Localize citations with precise bounding boxes
 * 4. Create annotated PDF with visual highlights
 *
 * This combines three powerful features:
 * - Claude's native citations (page + text)
 * - Text search with bounding boxes (exact coordinates)
 * - Visual annotations (highlights or boxes)
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import {
  extractCerebellumStudyData,
  extractCitationSources,
  displayCitationSources,
  localizeCitations,
  createAnnotatedPDF,
  createCitationVisualValidation,
  type CitationSource,
  type LocalizedCitation
} from '../src/index.js';

/**
 * Example 1: Complete visual validation pipeline
 *
 * This is the most common workflow - extract data, show sources, create annotated PDF.
 */
async function completeVisualValidationPipeline() {
  console.log('🎯 Complete Visual Validation Pipeline\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Read PDF
  const pdfPath = 'cerebellar_stroke_paper.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  // Step 1: Extract with citations enabled
  console.log('Step 1: Extracting data with citations enabled...');
  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true,
    verbose: true
  });

  console.log('\n📊 Extracted Data:');
  console.log(`Sample Size: ${result.data.sample_size} patients`);
  console.log(`Mortality Rate: ${result.data.mortality_rate}%`);
  console.log(`Mean Age: ${result.data.mean_age} years`);

  // Step 2: REQUIRED - Display sources
  console.log('\nStep 2: Displaying citation sources (REQUIRED)...');
  const sources = extractCitationSources(result.rawResponse);
  displayCitationSources(sources, 'Extraction Sources');

  // Step 3: Create visual validation PDF (one-shot)
  console.log('\nStep 3: Creating annotated PDF with visual highlights...');
  const localizedCitations = await createCitationVisualValidation(
    pdfPath,
    sources,
    'paper_validated.pdf',
    {
      color: 'FFFF00', // Yellow highlights
      opacity: 0.3,
      style: 'highlight',
      addMarginNotes: true
    }
  );

  console.log(`\n✅ Created annotated PDF: paper_validated.pdf`);
  console.log(`   Successfully localized ${localizedCitations.filter(c => c.boundingBoxes.length > 0).length}/${sources.length} citations`);

  return { sources, localizedCitations };
}

/**
 * Example 2: Manual pipeline with multiple visualization options
 *
 * Shows how to use each step separately and create different annotation styles.
 */
async function manualPipelineWithMultipleStyles() {
  console.log('\n\n🔧 Manual Pipeline with Multiple Visualization Styles\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const pdfPath = 'cerebellar_stroke_paper.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  // Extract with citations
  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true
  });

  const sources = extractCitationSources(result.rawResponse);

  // Step 1: Localize citations (get bounding boxes)
  console.log('Step 1: Localizing citations in PDF...');
  const localized = await localizeCitations(pdfPath, sources);

  console.log(`✓ Located ${localized.filter(c => c.boundingBoxes.length > 0).length}/${sources.length} citations`);

  // Step 2: Create PDF with yellow highlights
  console.log('\nStep 2: Creating PDF with yellow highlights...');
  await createAnnotatedPDF(
    pdfPath,
    'paper_highlights.pdf',
    localized,
    {
      color: 'FFFF00', // Yellow
      opacity: 0.3,
      style: 'highlight',
      addMarginNotes: true
    }
  );
  console.log('✓ Created: paper_highlights.pdf');

  // Step 3: Create PDF with red border boxes
  console.log('\nStep 3: Creating PDF with red border boxes...');
  await createAnnotatedPDF(
    pdfPath,
    'paper_boxes.pdf',
    localized,
    {
      color: 'FF0000', // Red
      style: 'box',
      borderWidth: 2,
      addMarginNotes: true
    }
  );
  console.log('✓ Created: paper_boxes.pdf');

  // Step 4: Create PDF with green highlights (no margin notes)
  console.log('\nStep 4: Creating PDF with green highlights (no margin notes)...');
  await createAnnotatedPDF(
    pdfPath,
    'paper_green.pdf',
    localized,
    {
      color: '00FF00', // Green
      opacity: 0.2,
      style: 'highlight',
      addMarginNotes: false
    }
  );
  console.log('✓ Created: paper_green.pdf');

  return localized;
}

/**
 * Example 3: Inspect localized citations with confidence scores
 *
 * Shows how to check which citations were successfully localized.
 */
async function inspectLocalizedCitations() {
  console.log('\n\n🔍 Inspect Localized Citations with Confidence\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const pdfPath = 'cerebellar_stroke_paper.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  // Extract with citations
  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true
  });

  const sources = extractCitationSources(result.rawResponse);

  // Localize citations
  const localized = await localizeCitations(pdfPath, sources);

  // Inspect each citation
  console.log('Citation Localization Results:');
  console.log('━'.repeat(80));

  for (const citation of localized) {
    console.log(`\n[${citation.index}] ${citation.documentTitle || 'Unknown'}`);
    console.log(`    Page: ${citation.pageNumber}`);
    console.log(`    Text: "${citation.citedText.slice(0, 60)}..."`);
    console.log(`    Bounding Boxes: ${citation.boundingBoxes.length}`);
    console.log(`    Confidence: ${(citation.locationConfidence * 100).toFixed(1)}%`);

    if (citation.boundingBoxes.length > 0) {
      console.log('    ✅ Successfully localized');
      citation.boundingBoxes.forEach((box, idx) => {
        console.log(`       Box ${idx + 1}: [${box.left.toFixed(1)}, ${box.top.toFixed(1)}, ${box.right.toFixed(1)}, ${box.bottom.toFixed(1)}]`);
      });
    } else {
      console.log('    ⚠️  Could not localize - citation text not found in PDF');
    }
  }

  console.log('\n' + '━'.repeat(80));

  // Summary statistics
  const successfullyLocalized = localized.filter(c => c.boundingBoxes.length > 0);
  const totalBoxes = localized.reduce((sum, c) => sum + c.boundingBoxes.length, 0);
  const avgConfidence = localized.reduce((sum, c) => sum + c.locationConfidence, 0) / localized.length;

  console.log('\n📊 Summary Statistics:');
  console.log(`   Total Citations: ${localized.length}`);
  console.log(`   Successfully Localized: ${successfullyLocalized.length} (${(successfullyLocalized.length / localized.length * 100).toFixed(1)}%)`);
  console.log(`   Total Bounding Boxes: ${totalBoxes}`);
  console.log(`   Average Confidence: ${(avgConfidence * 100).toFixed(1)}%`);

  return localized;
}

/**
 * Example 4: Custom citation filtering before visualization
 *
 * Shows how to filter citations (e.g., only high-confidence ones) before creating annotations.
 */
async function customCitationFiltering() {
  console.log('\n\n🎨 Custom Citation Filtering Example\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const pdfPath = 'cerebellar_stroke_paper.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  // Extract with citations
  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true
  });

  const sources = extractCitationSources(result.rawResponse);

  // Localize all citations
  const localized = await localizeCitations(pdfPath, sources);

  // Filter: Only citations with high confidence (>= 0.8)
  const highConfidence = localized.filter(c => c.locationConfidence >= 0.8);
  console.log(`Filtered to ${highConfidence.length}/${localized.length} high-confidence citations (>= 80%)`);

  // Create annotated PDF with only high-confidence citations
  await createAnnotatedPDF(
    pdfPath,
    'paper_high_confidence.pdf',
    highConfidence,
    {
      color: 'FFFF00',
      opacity: 0.3,
      style: 'highlight',
      addMarginNotes: true
    }
  );
  console.log('✓ Created: paper_high_confidence.pdf (only high-confidence citations)');

  // Filter: Only citations for specific fields (e.g., mortality_rate, sample_size)
  const criticalDataCitations = localized.filter(c =>
    c.citedText.toLowerCase().includes('mortality') ||
    c.citedText.toLowerCase().includes('patient') ||
    c.citedText.toLowerCase().includes('sample')
  );
  console.log(`Filtered to ${criticalDataCitations.length} citations for critical data fields`);

  // Create annotated PDF with only critical data citations
  await createAnnotatedPDF(
    pdfPath,
    'paper_critical_data.pdf',
    criticalDataCitations,
    {
      color: 'FF0000', // Red for critical data
      opacity: 0.4,
      style: 'highlight',
      addMarginNotes: true
    }
  );
  console.log('✓ Created: paper_critical_data.pdf (only critical data citations)');

  return { highConfidence, criticalDataCitations };
}

/**
 * Example 5: Integration with field-level attribution
 *
 * Shows how to create separate annotated PDFs for each extracted field.
 */
async function fieldLevelVisualValidation() {
  console.log('\n\n🗂️  Field-Level Visual Validation Example\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  const pdfPath = 'cerebellar_stroke_paper.pdf';
  const pdfBuffer = readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  // Extract with citations
  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true
  });

  const sources = extractCitationSources(result.rawResponse);

  // Localize all citations
  const localized = await localizeCitations(pdfPath, sources);

  // Map fields to their sources
  const fieldSources: Record<string, LocalizedCitation[]> = {};

  for (const [field, value] of Object.entries(result.data)) {
    const valueStr = String(value).toLowerCase();
    const matchingSources = localized.filter(c =>
      c.citedText.toLowerCase().includes(valueStr)
    );

    if (matchingSources.length > 0) {
      fieldSources[field] = matchingSources;
    }
  }

  console.log('Creating separate annotated PDFs for each field:');

  // Create annotated PDF for each field with citations
  for (const [field, citations] of Object.entries(fieldSources)) {
    await createAnnotatedPDF(
      pdfPath,
      `paper_field_${field}.pdf`,
      citations,
      {
        color: 'FFFF00',
        opacity: 0.3,
        style: 'highlight',
        addMarginNotes: true
      }
    );
    console.log(`  ✓ ${field}: ${citations.length} citations → paper_field_${field}.pdf`);
  }

  console.log(`\n✅ Created ${Object.keys(fieldSources).length} field-specific annotated PDFs`);

  return fieldSources;
}

/**
 * Example 6: Workflow comparison - Google Vertex AI vs Claude
 *
 * Shows the parallel patterns between Google's grounding and Claude's citations.
 */
function workflowComparison() {
  console.log('\n\n📊 Workflow Comparison: Google Vertex AI vs Claude\n');
  console.log('━'.repeat(80));

  console.log('\n🔵 Google Vertex AI Grounding Pattern:');
  console.log(`
// Get model response
const text = result.response.text();

// Get grounding metadata
const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;

// REQUIRED - display sources
const groundingChunks = groundingMetadata?.groundingChunks;
for (const chunk of groundingChunks) {
  const title = chunk.web?.title;  // "uefa.com"
  const uri = chunk.web?.uri;      // "https://..."
  // Show sources in UI
}
  `);

  console.log('\n🟣 Claude Native Citations Pattern:');
  console.log(`
// Get model response
const result = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true
});

// Get citation metadata
const sources = extractCitationSources(result.rawResponse);

// REQUIRED - display sources
displayCitationSources(sources);

// BONUS: Create visual validation PDF
const localized = await createCitationVisualValidation(
  'paper.pdf',
  sources,
  'paper_validated.pdf',
  { color: 'FFFF00', style: 'highlight' }
);
  `);

  console.log('\n━'.repeat(80));
  console.log('\n✅ Both patterns enforce source transparency!');
  console.log('   - Google: groundingChunks with web URIs');
  console.log('   - Claude: citation sources with PDF page numbers + bounding boxes');
}

// Main execution
async function main() {
  try {
    // Show workflow comparison
    workflowComparison();

    // Run examples (uncomment to execute)
    console.log('\n\n🚀 Running Examples...\n');

    // Example 1: Complete pipeline (recommended starting point)
    await completeVisualValidationPipeline();

    // Example 2: Manual pipeline with multiple styles
    // await manualPipelineWithMultipleStyles();

    // Example 3: Inspect localized citations
    // await inspectLocalizedCitations();

    // Example 4: Custom filtering
    // await customCitationFiltering();

    // Example 5: Field-level validation
    // await fieldLevelVisualValidation();

    console.log('\n\n✅ Examples complete!');
    console.log('\nTo run other examples, uncomment them in the main() function.');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  completeVisualValidationPipeline,
  manualPipelineWithMultipleStyles,
  inspectLocalizedCitations,
  customCitationFiltering,
  fieldLevelVisualValidation,
  workflowComparison
};
