/**
 * Full-PDF Deep Extractor Module
 * Extracts data from ALL pages of a PDF, not just the abstract
 *
 * Now uses structured extraction with tool use pattern for higher accuracy.
 * Based on: https://github.com/anthropics/claude-cookbooks/blob/main/tool_use/extracting_structured_json.ipynb
 */

import { BaseModule } from './base.js';
import type { ExtractionOptions, FullPdfResult, MethodsData, ResultsData, DiscussionData } from '../types/index.js';
import pdf from 'pdf-parse';
import { readFileSync } from 'fs';
import {
  extractMethodsSectionWithAgent,
  extractResultsSectionWithAgent,
  extractCerebellumStudyData as _extractCerebellumStudyData
} from '../utils/structured-extraction.js';

interface FullPdfInput {
  pdfPath: string;
}

export class FullPdfExtractor extends BaseModule<FullPdfInput, FullPdfResult> {
  readonly name = 'Full-PDF Deep Extractor';
  readonly description = 'Extracts structured data from all sections of a medical research paper';

  async process(input: FullPdfInput, options?: ExtractionOptions): Promise<FullPdfResult> {
    this.validate();
    this.log('Starting full PDF extraction...', options?.verbose);

    try {
      // Read PDF file
      const dataBuffer = readFileSync(input.pdfPath);
      const pdfData = await pdf(dataBuffer);

      this.log(`Extracted ${pdfData.numpages} pages`, options?.verbose);

      const fullText = pdfData.text;

      // Extract sections using heuristics
      const sections = this.identifySections(fullText);
      this.log(`Found sections: ${sections.sectionsFound.join(', ')}`, options?.verbose);

      // Extract structured data from each section
      const methods = await this.extractMethods(sections.methods, options);
      const results = await this.extractResults(sections.results, options);
      const discussion = await this.extractDiscussion(sections.discussion, options);

      return {
        page_count: pdfData.numpages,
        sections_found: sections.sectionsFound,
        methods,
        results,
        discussion,
        full_text_length: fullText.length,
      };
    } catch (error) {
      this.logError(`Failed to extract PDF: ${error}`);
      throw error;
    }
  }

  /**
   * Identify major sections in the full text using heuristics and headings
   */
  private identifySections(fullText: string): {
    sectionsFound: string[];
    abstract?: string;
    introduction?: string;
    methods?: string;
    results?: string;
    discussion?: string;
    conclusion?: string;
  } {
    const sections: any = {
      sectionsFound: [],
    };

    // Common section heading patterns (case-insensitive)
    const patterns = {
      abstract: /\bABSTRACT\b/i,
      introduction: /\bINTRODUCTION\b/i,
      methods: /\b(METHODS?|MATERIALS AND METHODS|PATIENTS AND METHODS)\b/i,
      results: /\bRESULTS?\b/i,
      discussion: /\bDISCUSSION\b/i,
      conclusion: /\bCONCLUSION\b/i,
    };

    // Extract each section
    for (const [sectionName, pattern] of Object.entries(patterns)) {
      const match = fullText.match(pattern);
      if (match) {
        sections.sectionsFound.push(sectionName);
        const startIndex = match.index!;

        // Find the next section heading or end of document
        const remainingText = fullText.slice(startIndex);
        const nextSectionMatch = remainingText.slice(match[0].length).match(/\b[A-Z][A-Z\s]{2,}\b/);
        const endIndex = nextSectionMatch
          ? startIndex + match[0].length + nextSectionMatch.index!
          : fullText.length;

        sections[sectionName] = fullText.slice(startIndex, endIndex).trim();
      }
    }

    return sections;
  }

  /**
   * Extract structured methods data using Claude with structured tool pattern
   *
   * Uses tool-based extraction for higher accuracy than prompt-based JSON.
   * Defines explicit schema with type constraints and descriptions.
   */
  private async extractMethods(methodsText?: string, options?: ExtractionOptions): Promise<MethodsData | undefined> {
    if (!methodsText) return undefined;

    try {
      const extracted = await extractMethodsSectionWithAgent(methodsText, {
        verbose: options?.verbose
      });

      this.log('Methods section extracted via structured tool pattern (Agent SDK)', options?.verbose);

      return {
        study_type: extracted.study_design || 'Not reported',
        setting: extracted.setting || 'Not reported',
        participants: extracted.inclusion_criteria?.join('; ') || 'Not reported',
        interventions: extracted.intervention_details || 'Not reported',
        outcomes_measured: extracted.outcome_measures || [],
        statistical_analysis: extracted.statistical_methods || 'Not reported',
        extracted_text: methodsText.slice(0, 1000),
      };
    } catch (error) {
      this.logError(`Failed to extract methods: ${error}`);
      // Fallback to basic extraction
      return {
        study_type: 'Extraction failed',
        setting: 'Extraction failed',
        participants: 'Extraction failed',
        interventions: 'Extraction failed',
        outcomes_measured: [],
        statistical_analysis: 'Extraction failed',
        extracted_text: methodsText.slice(0, 1000),
      };
    }
  }

  /**
   * Extract structured results data using Claude with structured tool pattern
   *
   * Uses tool-based extraction to parse numeric results and statistical findings.
   * Tool schema ensures proper type constraints for p-values and confidence intervals.
   */
  private async extractResults(resultsText?: string, options?: ExtractionOptions): Promise<ResultsData | undefined> {
    if (!resultsText) return undefined;

    try {
      const extracted = await extractResultsSectionWithAgent(resultsText, {
        verbose: options?.verbose
      });

      this.log('Results section extracted via structured tool pattern (Agent SDK)', options?.verbose);

      // Map structured tool output to ResultsData interface
      const primaryOutcome = extracted.primary_outcome;
      const primaryOutcomeStr = primaryOutcome
        ? `${primaryOutcome.measure}: ${primaryOutcome.intervention_result}${
            primaryOutcome.control_result ? ` vs ${primaryOutcome.control_result}` : ''
          } (p=${primaryOutcome.p_value || 'NR'}${
            primaryOutcome.confidence_interval ? `, 95% CI: ${primaryOutcome.confidence_interval}` : ''
          })`
        : 'Not reported';

      const secondaryOutcomes = extracted.secondary_outcomes?.map(
        (outcome: any) => `${outcome.measure}: ${outcome.result} (p=${outcome.p_value || 'NR'})`
      ) || [];

      return {
        primary_outcome_data: primaryOutcomeStr,
        secondary_outcomes: secondaryOutcomes,
        adverse_events: extracted.adverse_events?.join('; ') || 'Not reported',
        extracted_text: resultsText.slice(0, 1000),
      };
    } catch (error) {
      this.logError(`Failed to extract results: ${error}`);
      return {
        primary_outcome_data: 'Extraction failed',
        secondary_outcomes: [],
        adverse_events: 'Extraction failed',
        extracted_text: resultsText.slice(0, 1000),
      };
    }
  }

  /**
   * Extract discussion section data
   *
   * Note: Currently uses simple text extraction. Could be enhanced with
   * a dedicated discussion extraction tool if needed for your use case.
   */
  private async extractDiscussion(discussionText?: string, _options?: ExtractionOptions): Promise<DiscussionData | undefined> {
    if (!discussionText) return undefined;

    // Basic heuristic extraction (could be enhanced with structured tool)
    const sentences = discussionText.split(/\.\s+/);
    const key_findings = sentences
      .filter(s => s.toLowerCase().includes('found') || s.toLowerCase().includes('showed'))
      .slice(0, 3);

    const limitations = sentences
      .filter(s => s.toLowerCase().includes('limitation') || s.toLowerCase().includes('limited by'))
      .slice(0, 3);

    const implications = sentences
      .filter(s => s.toLowerCase().includes('implication') || s.toLowerCase().includes('suggest'))
      .slice(0, 2)
      .join('. ');

    return {
      key_findings,
      limitations,
      clinical_implications: implications || 'Not explicitly stated',
      extracted_text: discussionText.slice(0, 1000),
    };
  }
}
