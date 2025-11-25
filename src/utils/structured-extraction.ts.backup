/**
 * Structured JSON Extraction Utility
 *
 * Uses Claude's tool use pattern for higher accuracy structured data extraction.
 * Based on: https://github.com/anthropics/claude-cookbooks/blob/main/tool_use/extracting_structured_json.ipynb
 *
 * Key Benefits:
 * - Higher accuracy than prompt-based JSON extraction
 * - Explicit schema validation via tool input_schema
 * - Type safety with precise field definitions
 * - Guaranteed structured output via tool_choice
 *
 * REQUIRED: Always display citation sources when using citations to ensure transparency.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { extractCitationSources, displayCitationSources } from './citation-display.js';

/**
 * Cerebellar Stroke Study Data Extraction Tool
 *
 * Defines precise schema for extracting structured data from medical research papers.
 * Each field has explicit type, description, and constraints.
 */
export const CEREBELLAR_STUDY_EXTRACTION_TOOL: Tool = {
  name: 'extract_cerebellar_study_data',
  description: 'Extract comprehensive structured data from a cerebellar stroke research paper with high accuracy',
  input_schema: {
    type: 'object',
    properties: {
      // Study Identification
      study_id: {
        type: 'string',
        description: 'Unique study identifier (first author + year, e.g., "Smith2023")'
      },
      title: {
        type: 'string',
        description: 'Full title of the research paper'
      },
      authors: {
        type: 'string',
        description: 'All authors in format "Last1 First1, Last2 First2, ..."'
      },
      publication_year: {
        type: 'number',
        description: 'Year of publication (e.g., 2023)'
      },
      journal: {
        type: 'string',
        description: 'Journal name where the study was published'
      },

      // Study Design
      study_type: {
        type: 'string',
        description: 'Type of study: "RCT", "cohort", "case-control", "case series", or "other"',
        enum: ['RCT', 'cohort', 'case-control', 'case series', 'other']
      },
      sample_size: {
        type: 'number',
        description: 'Total number of patients enrolled in the study (must be positive integer)'
      },

      // Demographics
      mean_age: {
        type: 'number',
        description: 'Mean age of patients in years (e.g., 65.4). Use null if not reported.'
      },
      male_percentage: {
        type: 'number',
        description: 'Percentage of male patients (0-100). Use null if not reported.'
      },

      // Intervention
      intervention_procedure: {
        type: 'string',
        description: 'Primary intervention procedure (e.g., "suboccipital decompressive craniectomy", "medical management")'
      },
      control_group: {
        type: 'string',
        description: 'Control or comparison group intervention. Use null if no control group.'
      },

      // Outcomes
      mortality_rate: {
        type: 'number',
        description: 'Overall mortality rate as percentage (0-100). Use null if not reported.'
      },
      mortality_intervention: {
        type: 'number',
        description: 'Mortality rate in intervention group as percentage (0-100). Use null if not reported.'
      },
      mortality_control: {
        type: 'number',
        description: 'Mortality rate in control group as percentage (0-100). Use null if not reported.'
      },

      mRS_favorable_outcome: {
        type: 'number',
        description: 'Percentage of patients with favorable mRS outcome (mRS 0-2) at follow-up (0-100). Use null if not reported.'
      },

      // Follow-up
      follow_up_duration: {
        type: 'string',
        description: 'Follow-up duration (e.g., "90 days", "6 months", "1 year"). Use null if not reported.'
      },

      // Quality Assessment
      newcastle_ottawa_scale: {
        type: 'number',
        description: 'Newcastle-Ottawa Scale score (0-9) if applicable. Use null if not assessed.'
      },

      // Confidence
      extraction_confidence: {
        type: 'number',
        description: 'Confidence in extraction accuracy (0.0-1.0 scale). Use 1.0 for explicitly stated data, lower for inferred data.'
      }
    },
    required: [
      'study_id',
      'title',
      'authors',
      'publication_year',
      'study_type',
      'sample_size',
      'intervention_procedure',
      'extraction_confidence'
    ]
  }
};

/**
 * Methods Section Extraction Tool
 */
export const METHODS_EXTRACTION_TOOL: Tool = {
  name: 'extract_methods_section',
  description: 'Extract detailed methodology information from research paper methods section',
  input_schema: {
    type: 'object',
    properties: {
      study_design: {
        type: 'string',
        description: 'Study design type (RCT, prospective cohort, retrospective cohort, case series, etc.)'
      },
      setting: {
        type: 'string',
        description: 'Study setting (single center, multicenter, hospital name, country)'
      },
      time_period: {
        type: 'string',
        description: 'Study enrollment period (e.g., "January 2020 to December 2022")'
      },
      inclusion_criteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of inclusion criteria for patient enrollment'
      },
      exclusion_criteria: {
        type: 'array',
        items: { type: 'string' },
        description: 'List of exclusion criteria'
      },
      intervention_details: {
        type: 'string',
        description: 'Detailed description of the intervention procedure'
      },
      outcome_measures: {
        type: 'array',
        items: { type: 'string' },
        description: 'Primary and secondary outcome measures'
      },
      statistical_methods: {
        type: 'string',
        description: 'Statistical analysis methods used'
      }
    },
    required: ['study_design', 'setting', 'outcome_measures']
  }
};

/**
 * Results Section Extraction Tool
 */
export const RESULTS_EXTRACTION_TOOL: Tool = {
  name: 'extract_results_section',
  description: 'Extract quantitative results and statistical findings from research paper',
  input_schema: {
    type: 'object',
    properties: {
      primary_outcome: {
        type: 'object',
        properties: {
          measure: { type: 'string', description: 'Primary outcome measure name' },
          intervention_result: { type: 'string', description: 'Result in intervention group' },
          control_result: { type: 'string', description: 'Result in control group if applicable' },
          p_value: { type: 'number', description: 'P-value for statistical significance' },
          confidence_interval: { type: 'string', description: '95% CI or other confidence interval' }
        },
        required: ['measure']
      },
      secondary_outcomes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            measure: { type: 'string' },
            result: { type: 'string' },
            p_value: { type: 'number' }
          }
        },
        description: 'Secondary outcome results'
      },
      adverse_events: {
        type: 'array',
        items: { type: 'string' },
        description: 'Reported adverse events or complications'
      },
      subgroup_analyses: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            subgroup: { type: 'string', description: 'Subgroup definition' },
            finding: { type: 'string', description: 'Key finding for this subgroup' }
          }
        },
        description: 'Subgroup analysis results if performed'
      }
    },
    required: ['primary_outcome']
  }
};

/**
 * Citation Extraction Tool (for Reference Extraction module)
 */
export const CITATION_EXTRACTION_TOOL: Tool = {
  name: 'extract_citations',
  description: 'Extract and structure individual citations from reference section',
  input_schema: {
    type: 'object',
    properties: {
      citations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            citation_number: {
              type: 'number',
              description: 'Sequential number in reference list'
            },
            authors: {
              type: 'string',
              description: 'All authors in format "Last1 FM, Last2 FM, ..." or "Last1 et al."'
            },
            title: {
              type: 'string',
              description: 'Full title of the cited work'
            },
            journal: {
              type: 'string',
              description: 'Journal name or publication venue'
            },
            year: {
              type: 'string',
              description: 'Publication year (e.g., "2023")'
            },
            volume: {
              type: 'string',
              description: 'Volume number. Use null if not present.'
            },
            issue: {
              type: 'string',
              description: 'Issue number. Use null if not present.'
            },
            pages: {
              type: 'string',
              description: 'Page range (e.g., "123-130"). Use null if not present.'
            },
            doi: {
              type: 'string',
              description: 'Digital Object Identifier (just the identifier, not full URL). Use null if not present.'
            },
            raw_text: {
              type: 'string',
              description: 'Original citation text as it appears in the paper'
            }
          },
          required: ['citation_number', 'authors', 'year', 'raw_text']
        },
        description: 'Array of all citations extracted from the reference section'
      }
    },
    required: ['citations']
  }
};

/**
 * Structured Extraction Options
 */
export interface StructuredExtractionOptions {
  /** Anthropic API client instance */
  client: Anthropic;
  /** Claude model to use */
  model?: string;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Document content (PDF as base64 or text) */
  documentContent: string | { type: 'base64'; media_type: 'application/pdf'; data: string };
  /** Extraction prompt/query */
  prompt: string;
  /** Tool definition to use for extraction */
  tool: Tool;
  /** Enable native citations */
  enableCitations?: boolean;
  /** Verbose logging */
  verbose?: boolean;
}

/**
 * Perform structured extraction using tool use pattern
 *
 * @param options - Extraction configuration
 * @returns Extracted structured data from tool input
 *
 * @example
 * ```typescript
 * const result = await performStructuredExtraction({
 *   client: anthropicClient,
 *   documentContent: pdfBase64,
 *   prompt: 'Extract all study data from this cerebellar stroke research paper',
 *   tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
 *   enableCitations: true
 * });
 * ```
 */
export async function performStructuredExtraction<T = any>(
  options: StructuredExtractionOptions
): Promise<{
  data: T;
  citations?: any[];
  rawResponse: Anthropic.Messages.Message;
  /** REQUIRED: Display these sources to show where data came from */
  displaySources?: () => void;
}> {
  const {
    client,
    model = 'claude-sonnet-4-5-20250929',
    maxTokens = 4096,
    documentContent,
    prompt,
    tool,
    enableCitations = false,
    verbose = false
  } = options;

  if (verbose) {
    console.log(`[StructuredExtraction] Using tool: ${tool.name}`);
    console.log(`[StructuredExtraction] Model: ${model}`);
  }

  // Build message content
  const messageContent: any[] = [];

  // Add document if provided as PDF
  if (typeof documentContent === 'object') {
    messageContent.push({
      type: 'document',
      source: documentContent,
      citations: enableCitations ? { enabled: true } : undefined
    });
  }

  // Add text prompt
  messageContent.push({
    type: 'text',
    text: typeof documentContent === 'string'
      ? `${documentContent}\n\n${prompt}`
      : prompt
  });

  // Call Claude API with tool definition
  const response = await client.messages.create({
    model: model,
    max_tokens: maxTokens,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name }, // Force tool invocation
    messages: [{
      role: 'user',
      content: messageContent
    }]
  });

  if (verbose) {
    console.log(`[StructuredExtraction] Response received with ${response.content.length} content blocks`);
  }

  // Extract tool use result
  let extractedData: any = null;
  const citations: any[] = [];

  for (const block of response.content) {
    if (block.type === 'tool_use' && block.name === tool.name) {
      extractedData = block.input;
      if (verbose) {
        console.log(`[StructuredExtraction] Extracted data from tool_use block`);
      }
    } else if ((block as any).type === 'citations') {
      citations.push(...(block as any).citations);
      if (verbose) {
        console.log(`[StructuredExtraction] Collected ${(block as any).citations.length} citations`);
      }
    }
  }

  if (!extractedData) {
    throw new Error(`No tool_use block found with name "${tool.name}" in response`);
  }

  // REQUIRED: Create displaySources function for transparency
  const displaySources = enableCitations && citations.length > 0
    ? () => {
      const sources = extractCitationSources(response);
      displayCitationSources(sources, 'Extraction Sources');
    }
    : undefined;

  return {
    data: extractedData as T,
    citations: citations.length > 0 ? citations : undefined,
    rawResponse: response,
    displaySources
  };
}

/**
 * Extract cerebellar study data using structured tool pattern
 */
export async function extractCerebellumStudyData(
  client: Anthropic,
  pdfBase64: string,
  options?: {
    enableCitations?: boolean;
    verbose?: boolean;
  }
): Promise<{
  data: any;
  citations?: any[];
}> {
  const result = await performStructuredExtraction({
    client,
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
    enableCitations: options?.enableCitations ?? false,
    verbose: options?.verbose ?? false
  });

  return {
    data: result.data,
    citations: result.citations
  };
}

/**
 * Extract methods section using structured tool pattern
 */
export async function extractMethodsSection(
  client: Anthropic,
  methodsText: string,
  options?: { verbose?: boolean }
): Promise<any> {
  const result = await performStructuredExtraction({
    client,
    documentContent: methodsText,
    prompt: 'Extract all methodological details from this Methods section text.',
    tool: METHODS_EXTRACTION_TOOL,
    verbose: options?.verbose ?? false
  });

  return result.data;
}

/**
 * Extract results section using structured tool pattern
 */
export async function extractResultsSection(
  client: Anthropic,
  resultsText: string,
  options?: { verbose?: boolean }
): Promise<any> {
  const result = await performStructuredExtraction({
    client,
    documentContent: resultsText,
    prompt: 'Extract all quantitative results and statistical findings from this Results section text.',
    tool: RESULTS_EXTRACTION_TOOL,
    verbose: options?.verbose ?? false
  });

  return result.data;
}

/**
 * Extract citations using structured tool pattern
 */
export async function extractCitationsStructured(
  client: Anthropic,
  referencesText: string,
  options?: { verbose?: boolean }
): Promise<any[]> {
  const result = await performStructuredExtraction({
    client,
    documentContent: referencesText,
    prompt: `Parse all citations from this reference section text.

Instructions:
- Extract each citation as a separate entry
- Maintain citation numbering from the original text
- Extract all available fields (authors, title, journal, year, volume, issue, pages, DOI)
- Use null for missing fields
- Preserve exact formatting in raw_text field`,
    tool: CITATION_EXTRACTION_TOOL,
    verbose: options?.verbose ?? false
  });

  return result.data.citations;
}
