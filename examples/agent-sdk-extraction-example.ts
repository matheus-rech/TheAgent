/**
 * Example: Using Agent SDK for Structured Extraction
 *
 * This example demonstrates how to use the new Agent SDK-based
 * extraction functions instead of the legacy direct API approach.
 */

import { readFileSync } from 'fs';
import {
  performStructuredExtractionWithAgent,
  extractMethodsSectionWithAgent,
  extractResultsSectionWithAgent,
  extractCitationsStructuredWithAgent,
  CEREBELLAR_STUDY_EXTRACTION_TOOL,
  METHODS_EXTRACTION_TOOL,
  RESULTS_EXTRACTION_TOOL,
  CITATION_EXTRACTION_TOOL
} from '../src/utils/structured-extraction.js';

/**
 * Example 1: Extract full cerebellar study data from PDF
 */
async function extractFullStudyData() {
  console.log('Example 1: Full Study Data Extraction');
  console.log('=====================================\n');

  // Load PDF as base64
  const pdfBuffer = readFileSync('path/to/cerebellar-study.pdf');
  const pdfBase64 = pdfBuffer.toString('base64');

  // Extract using Agent SDK
  const result = await performStructuredExtractionWithAgent({
    documentContent: {
      type: 'base64',
      media_type: 'application/pdf',
      data: pdfBase64
    },
    prompt: `Carefully extract all available data from this cerebellar stroke research paper.

Instructions:
- Extract only explicitly stated information
- Use null for missing fields
- Set extraction_confidence based on data clarity (1.0 = explicit, 0.8 = clear inference, 0.6 = unclear)
- For percentages, use numeric values 0-100
- For mortality rates, report the primary endpoint mortality if multiple time points exist
- If citations are enabled, use them to verify extracted data`,
    tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
    enableCitations: true,
    verbose: true,
    agentOptions: {
      model: 'claude-sonnet-4-5-20250929',
      maxTurns: 1
    }
  });

  console.log('Extracted Study Data:', JSON.stringify(result.data, null, 2));
  console.log('\nCitations Found:', result.citations?.length || 0);

  // REQUIRED: Display citation sources for transparency
  if (result.displaySources) {
    result.displaySources();
  }

  console.log('\nSDK Messages Received:', result.rawMessages.length);
  console.log('Message Types:', result.rawMessages.map(m => m.type));
}

/**
 * Example 2: Extract methods section from text
 */
async function extractMethods() {
  console.log('\nExample 2: Methods Section Extraction');
  console.log('=====================================\n');

  const methodsText = `
    Study Design: This was a multicenter, retrospective cohort study.

    Setting: Conducted at 5 tertiary care hospitals in the United States.

    Time Period: January 2018 to December 2022

    Inclusion Criteria:
    - Age 18 years or older
    - CT or MRI confirmed cerebellar infarction
    - Presenting within 48 hours of symptom onset

    Exclusion Criteria:
    - Previous cerebellar surgery
    - Malignant cerebellar infarction requiring decompression

    Intervention: Suboccipital decompressive craniectomy performed within 72 hours

    Outcome Measures:
    - Primary: 90-day mortality
    - Secondary: Modified Rankin Scale at discharge, length of stay

    Statistical Methods: Chi-square test for categorical variables, t-test for continuous variables, p<0.05 significant
  `;

  const result = await extractMethodsSectionWithAgent(methodsText, {
    verbose: true,
    agentOptions: {
      maxTurns: 1
    }
  });

  console.log('Extracted Methods:', JSON.stringify(result, null, 2));
}

/**
 * Example 3: Extract results section
 */
async function extractResults() {
  console.log('\nExample 3: Results Section Extraction');
  console.log('====================================\n');

  const resultsText = `
    Primary Outcome: The 90-day mortality rate was 15.2% (23/151) in the intervention group
    compared to 28.4% (42/148) in the control group (p = 0.003, 95% CI: 0.45-0.82).

    Secondary Outcomes:
    - Favorable mRS (0-2) at discharge: 42.3% vs 31.1% (p = 0.047)
    - Mean length of stay: 18.5 ± 6.2 days vs 22.3 ± 8.1 days (p = 0.012)

    Adverse Events:
    - Surgical site infection: 5 patients (3.3%)
    - CSF leak: 3 patients (2.0%)
    - Re-operation for bleeding: 2 patients (1.3%)

    Subgroup Analysis:
    - Age <65 years: Mortality benefit more pronounced (OR 0.35, 95% CI: 0.18-0.67)
    - Age ≥65 years: No significant difference (OR 0.72, 95% CI: 0.41-1.26)
  `;

  const result = await extractResultsSectionWithAgent(resultsText, {
    verbose: true
  });

  console.log('Extracted Results:', JSON.stringify(result, null, 2));
}

/**
 * Example 4: Extract citations from reference section
 */
async function extractCitations() {
  console.log('\nExample 4: Citations Extraction');
  console.log('================================\n');

  const referencesText = `
    References

    1. Jauss M, Krieger D, Hornig C, Schramm J, Busse O. Surgical and medical management of patients with massive cerebellar infarctions: results of the German-Austrian Cerebellar Infarction Study. J Neurol. 1999;246(4):257-64. doi: 10.1007/s004150050345

    2. Pfefferkorn T, Eppinger U, Linn J, Birnbaum T, Herzog J, Straube A, et al. Long-term outcome after suboccipital decompressive craniectomy for malignant cerebellar infarction. Stroke. 2009;40(9):3045-50. doi: 10.1161/STROKEAHA.109.550731

    3. Koh MG, Phan TG, Atkinson JL, Wijdicks EF. Neuroimaging in deteriorating patients with cerebellar infarcts and mass effect. Stroke. 2000;31(9):2062-7.
  `;

  const citations = await extractCitationsStructuredWithAgent(referencesText, {
    verbose: true
  });

  console.log('Extracted Citations:', JSON.stringify(citations, null, 2));
  console.log(`\nTotal Citations: ${citations.length}`);
}

/**
 * Example 5: Advanced usage with custom Agent SDK options
 */
async function advancedExtraction() {
  console.log('\nExample 5: Advanced Agent SDK Configuration');
  console.log('===========================================\n');

  const methodsText = 'Study design and methodology text here...';

  const result = await extractMethodsSectionWithAgent(methodsText, {
    verbose: true,
    agentOptions: {
      model: 'claude-sonnet-4-5-20250929',
      maxTurns: 1,
      maxBudgetUsd: 0.50, // Limit spending
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: 'Focus on extracting precise statistical methods and study design details.'
      },
      // Add MCP servers if needed
      // mcpServers: {
      //   docling: {
      //     command: 'uvx',
      //     args: ['--from=docling-mcp', 'docling-mcp-server', '--transport', 'stdio'],
      //     env: {}
      //   }
      // },
      // Add hooks for monitoring
      // hooks: {
      //   PreToolUse: [{
      //     matcher: 'extract_methods_section',
      //     hooks: [async (input) => {
      //       console.log('About to extract methods:', input);
      //       return { continue: true };
      //     }]
      //   }],
      //   PostToolUse: [{
      //     matcher: 'extract_methods_section',
      //     hooks: [async (input) => {
      //       console.log('Extraction complete:', input);
      //       return {};
      //     }]
      //   }]
      // }
    }
  });

  console.log('Result:', JSON.stringify(result, null, 2));
}

/**
 * Example 6: Error handling
 */
async function errorHandling() {
  console.log('\nExample 6: Error Handling');
  console.log('=========================\n');

  try {
    const result = await performStructuredExtractionWithAgent({
      documentContent: 'Invalid content',
      prompt: 'Extract data',
      tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
      verbose: true,
      agentOptions: {
        maxTurns: 1,
        maxBudgetUsd: 0.10 // Very low budget to trigger potential errors
      }
    });

    console.log('Success:', result.data);
  } catch (error) {
    console.error('Extraction failed:', error);

    if (error instanceof Error) {
      if (error.message.includes('No tool_use block found')) {
        console.error('Tool was not invoked - check prompt and tool definition');
      } else if (error.message.includes('budget')) {
        console.error('Budget exceeded - increase maxBudgetUsd');
      }
    }
  }
}

/**
 * Run all examples
 */
async function main() {
  console.log('Agent SDK Structured Extraction Examples');
  console.log('=========================================\n');

  try {
    // Uncomment examples you want to run:

    // await extractFullStudyData();
    await extractMethods();
    await extractResults();
    await extractCitations();
    await advancedExtraction();
    await errorHandling();

  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  extractFullStudyData,
  extractMethods,
  extractResults,
  extractCitations,
  advancedExtraction,
  errorHandling
};
