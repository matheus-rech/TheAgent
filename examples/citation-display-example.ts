/**
 * Citation Display Example
 *
 * Demonstrates how to properly display citation sources following the
 * "REQUIRED - display sources" pattern from Google's Vertex AI grounding.
 *
 * This example shows Claude's native citations working the same way.
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import {
  extractCerebellumStudyData,
  extractCitationSources,
  displayCitationSources,
  createExtractionWithSources,
  type CitationSource
} from '../src/index.js';

/**
 * Example: Extract study data with REQUIRED source display
 *
 * This follows the same pattern as Google's Vertex AI grounding metadata.
 */
async function extractWithRequiredSourceDisplay() {
  console.log('🧠 Cerebellar Study Data Extraction with Source Display\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Read PDF
  const pdfBuffer = readFileSync('cerebellar_stroke_paper.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');

  // Perform extraction with citations enabled
  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true,  // ✓ Enable grounding to source
    verbose: true
  });

  console.log('\n📊 Extracted Study Data:');
  console.log('━'.repeat(80));
  console.log(`Study ID: ${result.data.study_id}`);
  console.log(`Sample Size: ${result.data.sample_size} patients`);
  console.log(`Mortality Rate: ${result.data.mortality_rate}%`);
  console.log(`Mean Age: ${result.data.mean_age} years`);
  console.log(`Study Type: ${result.data.study_type}`);
  console.log(`Extraction Confidence: ${result.data.extraction_confidence}`);

  // REQUIRED - display sources (parallel to Google's pattern)
  if (result.displaySources) {
    result.displaySources();  // ✓ Show users where data came from
  } else {
    console.log('\n⚠️  No citation sources available (citations not enabled)');
  }

  return result;
}

/**
 * Example: Manual source extraction and display
 *
 * Shows the low-level API similar to Google's groundingMetadata pattern.
 */
async function manualSourceExtraction() {
  console.log('\n\n🔍 Manual Source Extraction Example\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const pdfBuffer = readFileSync('cerebellar_stroke_paper.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');

  // Call Claude API with citations enabled
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64
          },
          title: 'Cerebellar Stroke Study',
          citations: { enabled: true }  // ✓ Enable citations
        },
        {
          type: 'text',
          text: 'Extract the mortality rate and sample size. Use citations to back up your answer.'
        }
      ]
    }]
  });

  // Get the text response (parallel to: result.response.text())
  const textBlock = response.content.find(b => b.type === 'text');
  const text = textBlock?.type === 'text' ? textBlock.text : '';
  console.log('📄 Model Response:');
  console.log(text);

  // REQUIRED - extract citation sources (parallel to: groundingMetadata.groundingChunks)
  const sources = extractCitationSources(response);

  // REQUIRED - display sources
  if (sources.length > 0) {
    displayCitationSources(sources, 'Grounding Sources');
  } else {
    console.log('\n⚠️  No sources cited');
  }

  return { text, sources };
}

/**
 * Example: HTML generation for web UIs
 */
async function generateHTMLSources() {
  console.log('\n\n🌐 HTML Source Display Example\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const pdfBuffer = readFileSync('cerebellar_stroke_paper.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');

  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true
  });

  // Generate HTML for web display
  const { generateCitationHTML } = await import('../src/index.js');
  const sources = extractCitationSources(result.rawResponse);
  const html = generateCitationHTML(sources);

  console.log('Generated HTML:');
  console.log(html);

  // Could save to file for web app
  // writeFileSync('sources.html', html);

  return html;
}

/**
 * Example: Field-level source attribution
 */
async function fieldLevelAttribution() {
  console.log('\n\n🎯 Field-Level Source Attribution Example\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const pdfBuffer = readFileSync('cerebellar_stroke_paper.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');

  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true
  });

  // Create extraction with full source information
  const { linkDataToCitations } = await import('../src/index.js');
  const fieldSources = linkDataToCitations(result.data, result.rawResponse);

  console.log('📊 Field-Level Sources:');
  console.log('━'.repeat(80));

  // Show source for each extracted field
  for (const [field, value] of Object.entries(result.data)) {
    console.log(`\n${field}: ${value}`);

    if (fieldSources[field] && fieldSources[field].length > 0) {
      const source = fieldSources[field][0];
      console.log(`  └─ Source: Page ${source.pageNumber}`);
      console.log(`     "${source.citedText.slice(0, 80)}..."`);
    } else {
      console.log(`  └─ No direct source citation`);
    }
  }

  return fieldSources;
}

/**
 * Example: Complete workflow with all features
 */
async function completeWorkflowExample() {
  console.log('\n\n🚀 Complete Workflow Example\n');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const pdfBuffer = readFileSync('cerebellar_stroke_paper.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');

  // Step 1: Extract with citations
  console.log('Step 1: Extracting data with citations enabled...');
  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true,
    verbose: true
  });

  // Step 2: Display extracted data
  console.log('\n📊 Extracted Data:');
  console.log(JSON.stringify(result.data, null, 2));

  // Step 3: REQUIRED - display sources
  console.log('\nStep 3: Displaying sources (REQUIRED)...');
  if (result.displaySources) {
    result.displaySources();
  }

  // Step 4: Create enhanced result with full source tracking
  console.log('\nStep 4: Creating enhanced result with source tracking...');
  const enhancedResult = createExtractionWithSources(
    result.data,
    result.rawResponse
  );

  // Step 5: Display formatted sources
  console.log('\n📚 Formatted Sources:');
  enhancedResult.formattedSources.forEach((source, i) => {
    console.log(`${i + 1}. ${source}`);
  });

  // Step 6: Show field-to-source mapping
  console.log('\n🔗 Field-to-Source Mapping:');
  for (const [field, sources] of Object.entries(enhancedResult.fieldSources || {})) {
    console.log(`${field}: ${sources.length} source(s)`);
  }

  return enhancedResult;
}

/**
 * Comparison: Google Vertex AI vs Claude Native Citations
 */
function comparisonExample() {
  console.log('\n\n📊 API Pattern Comparison\n');
  console.log('━'.repeat(80));

  console.log('\n🔵 Google Vertex AI Pattern:');
  console.log(`
// Get model response
const text = result.response.text();

// Get grounding metadata
const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;

// REQUIRED - display sources
const groundingChunks = groundingMetadata?.groundingChunks;
for (const chunk of groundingChunks) {
  const title = chunk.web?.title;
  const uri = chunk.web?.uri;
  // Show sources in UI
}
  `);

  console.log('\n🟣 Claude Native Citations Pattern:');
  console.log(`
// Get model response
const textBlock = response.content.find(b => b.type === 'text');
const text = textBlock?.text;

// Get citation metadata
const sources = extractCitationSources(response);

// REQUIRED - display sources
for (const source of sources) {
  const pageNumber = source.pageNumber;
  const citedText = source.citedText;
  // Show sources in UI
}
  `);

  console.log('\n✅ Both patterns enforce source transparency!');
  console.log('   - Google: groundingChunks with web URIs');
  console.log('   - Claude: citation sources with PDF page numbers');
}

// Main execution
async function main() {
  try {
    // Show API comparison
    comparisonExample();

    // Run examples (uncomment to execute)
    // await extractWithRequiredSourceDisplay();
    // await manualSourceExtraction();
    // await generateHTMLSources();
    // await fieldLevelAttribution();
    // await completeWorkflowExample();

    console.log('\n✅ Examples complete!');
    console.log('\nTo run individual examples, uncomment them in the main() function.');
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
  extractWithRequiredSourceDisplay,
  manualSourceExtraction,
  generateHTMLSources,
  fieldLevelAttribution,
  completeWorkflowExample,
  comparisonExample
};
