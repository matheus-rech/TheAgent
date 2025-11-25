/**
 * Outcome Harmonizer Module
 * Standardizes heterogeneous outcome definitions across studies
 *
 * Enhanced with Claude Agent SDK for intelligent outcome standardization:
 * - Timepoint mapping (30/90/180/365 days)
 * - mRS definition conversion (0-2 vs 0-3)
 * - Scale harmonization (GOS ↔ mRS)
 * - Missing data handling
 * - Confidence scoring
 */

import { BaseModule } from './base.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { AGENT_CONFIGS } from '../agents/config.js';
import type { ExtractionOptions, OutcomeHarmonizerResult, HarmonizedOutcomes } from '../types/index.js';

interface HarmonizerInput {
  /** Raw outcome data from the study */
  outcomes: {
    mortality?: string;
    mRS_favorable?: string;
    mRS_distribution?: string;
    follow_up_duration?: string;
  };
  /** Full text for context */
  fullText?: string;
}

export class OutcomeHarmonizer extends BaseModule<HarmonizerInput, OutcomeHarmonizerResult> {
  readonly name = 'Outcome Harmonizer';
  readonly description = 'Standardizes outcome measures across different timepoints and definitions';

  // Standard timepoints for harmonization (in days)
  private readonly STANDARD_TIMEPOINTS = [30, 90, 180, 365];

  // mRS dichotomization schemes
  // @ts-expect-error - Reserved for future dichotomization logic
  private readonly _MRS_DEFINITIONS = {
    favorable_0_2: [0, 1, 2],
    favorable_0_3: [0, 1, 2, 3],
    unfavorable_4_6: [4, 5, 6],
  };

  async process(input: HarmonizerInput, options?: ExtractionOptions): Promise<OutcomeHarmonizerResult> {
    this.validate();
    this.log('Harmonizing outcomes...', options?.verbose);

    try {
      const originalOutcomes = this.identifyOriginalOutcomes(input);
      const harmonized = await this.harmonizeToStandardTimepoints(input, options);
      const transformations = this.documentTransformations(input, harmonized);

      return {
        harmonized,
        original_outcomes: originalOutcomes,
        transformations,
      };
    } catch (error) {
      this.logError(`Harmonization failed: ${error}`);
      throw error;
    }
  }

  /**
   * Identify what outcomes are reported in the original study
   */
  private identifyOriginalOutcomes(input: HarmonizerInput): string[] {
    const outcomes: string[] = [];

    if (input.outcomes.mortality) outcomes.push('mortality');
    if (input.outcomes.mRS_favorable) outcomes.push('mRS favorable outcome');
    if (input.outcomes.mRS_distribution) outcomes.push('mRS distribution');

    return outcomes;
  }

  /**
   * Harmonize outcomes to standard timepoints using Agent SDK
   *
   * Enhanced with Claude Agent SDK for intelligent harmonization:
   * 1. Timepoint mapping: 3-month → 90-day, 1-year → 365-day
   * 2. mRS definition conversion: 0-2 → 0-3 using distribution
   * 3. Scale harmonization: GOS ↔ mRS mapping
   * 4. Missing data handling with confidence scoring
   *
   * Falls back to simple parsing for straightforward cases.
   */
  private async harmonizeToStandardTimepoints(
    input: HarmonizerInput,
    options?: ExtractionOptions
  ): Promise<HarmonizedOutcomes> {
    // Determine if we need Agent SDK for complex harmonization
    const needsAgentHarmonization = this.requiresComplexHarmonization(input);

    if (needsAgentHarmonization) {
      this.log('Using Agent SDK for complex outcome harmonization...', options?.verbose);
      return await this.harmonizeWithAgent(input, options);
    }

    // Simple harmonization for straightforward cases
    this.log('Using simple parsing for straightforward outcomes...', options?.verbose);
    return await this.harmonizeSimple(input, options);
  }

  /**
   * Check if outcomes require complex Agent SDK harmonization
   */
  private requiresComplexHarmonization(input: HarmonizerInput): boolean {
    const outcomes = input.outcomes;

    // Complex cases that need Agent SDK:
    // 1. Multiple timepoints mentioned
    // 2. Non-standard outcome scales (GOS, Barthel, custom)
    // 3. Complex mRS distributions needing conversion
    // 4. Missing data requiring imputation
    // 5. Unclear timepoint descriptions ("median", "range")

    const hasMultipleTimepoints = outcomes.follow_up_duration?.includes(',') ||
                                   outcomes.follow_up_duration?.includes('and') ||
                                   outcomes.follow_up_duration?.includes('-');

    const hasComplexScales = outcomes.mRS_favorable?.toLowerCase().includes('gos') ||
                              outcomes.mRS_favorable?.toLowerCase().includes('barthel') ||
                              outcomes.mRS_favorable?.toLowerCase().includes('nihss');

    const hasDistribution = !!outcomes.mRS_distribution;

    const hasUnclearTimepoint = (outcomes.follow_up_duration?.toLowerCase().includes('median') ||
                                outcomes.follow_up_duration?.toLowerCase().includes('range') ||
                                outcomes.follow_up_duration?.toLowerCase().includes('variable')) ?? false;

    return hasMultipleTimepoints || hasComplexScales || hasDistribution || hasUnclearTimepoint;
  }

  /**
   * Agent SDK-powered harmonization for complex cases
   */
  private async harmonizeWithAgent(
    input: HarmonizerInput,
    options?: ExtractionOptions
  ): Promise<HarmonizedOutcomes> {
    const prompt = this.buildHarmonizationPrompt(input);

    try {
      const queryResult = query({
        prompt,
        options: {
          model: AGENT_CONFIGS.outcomeHarmonizer.model,
          systemPrompt: AGENT_CONFIGS.outcomeHarmonizer.systemPrompt,
        },
      });

      // Collect response text
      let responseText = '';
      for await (const message of queryResult) {
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'text') {
              responseText += block.text;
            }
          }
        }
      }

      return this.parseHarmonizationResponse(responseText);
    } catch (error) {
      this.logError(`Agent SDK harmonization failed: ${error}, falling back to simple harmonization`);
      return await this.harmonizeSimple(input, options);
    }
  }

  /**
   * Build prompt for Agent SDK harmonization
   */
  private buildHarmonizationPrompt(input: HarmonizerInput): string {
    return `Harmonize the following clinical outcome data to standard timepoints (30, 90, 180, 365 days):

**Original Outcomes:**
- Mortality: ${input.outcomes.mortality || 'Not reported'}
- mRS Favorable Outcome: ${input.outcomes.mRS_favorable || 'Not reported'}
- mRS Distribution: ${input.outcomes.mRS_distribution || 'Not reported'}
- Follow-up Duration: ${input.outcomes.follow_up_duration || 'Not reported'}

**Additional Context:**
${input.fullText ? `Full text excerpt: ${input.fullText.substring(0, 1000)}...` : 'No additional context available'}

**Harmonization Requirements:**
1. Map timepoints to nearest standard (30, 90, 180, 365 days)
2. Convert mRS definitions to both 0-2 (favorable) and 0-3 (favorable) if possible
3. If mRS distribution is provided, calculate both dichotomizations
4. Document all conversions and assumptions
5. Assign confidence level (high/medium/low) based on transformation complexity

**Output Format (JSON):**
\`\`\`json
{
  "timepoints": [
    {
      "days": 90,
      "mortality": 0.15,
      "mRS_0_2": 0.45,
      "mRS_0_3": 0.60,
      "mRS_distribution": [0.10, 0.15, 0.20, 0.15, 0.20, 0.10, 0.10]
    }
  ],
  "conversions_applied": [
    "Mapped 3-month to 90-day timepoint",
    "Converted mRS 0-2 (45%) to mRS 0-3 (60%) using distribution"
  ],
  "confidence": "high"
}
\`\`\`

Provide only the JSON output, no additional explanation.`;
  }

  /**
   * Parse Agent SDK harmonization response
   */
  private parseHarmonizationResponse(response: string): HarmonizedOutcomes {
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = response.match(/\`\`\`(?:json)?\s*(\{[\s\S]*?\})\s*\`\`\`/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonString);

      // Validate structure
      if (!parsed.timepoints || !Array.isArray(parsed.timepoints)) {
        throw new Error('Invalid harmonization response: missing timepoints array');
      }

      return {
        timepoints: parsed.timepoints,
        conversions_applied: parsed.conversions_applied || [],
        confidence: parsed.confidence || 'medium',
      };
    } catch (error) {
      this.logError(`Failed to parse Agent SDK response: ${error}`);
      // Return empty harmonization on parse failure
      return {
        timepoints: [],
        conversions_applied: ['Agent SDK parsing failed'],
        confidence: 'low',
      };
    }
  }

  /**
   * Simple harmonization for straightforward cases (fallback)
   */
  private async harmonizeSimple(
    input: HarmonizerInput,
    options?: ExtractionOptions
  ): Promise<HarmonizedOutcomes> {
    const timepoints = [];
    const conversions_applied: string[] = [];

    // Extract timepoint from follow-up duration
    const timepointDays = this.parseTimepointToDays(input.outcomes.follow_up_duration);

    if (timepointDays) {
      // Map to nearest standard timepoint
      const standardTimepoint = this.mapToStandardTimepoint(timepointDays);
      this.log(`Mapped ${timepointDays} days to standard ${standardTimepoint} days`, options?.verbose);

      // Parse mortality
      const mortality = this.parseMortality(input.outcomes.mortality);

      // Parse mRS outcomes
      const mrsData = this.parseMrsOutcome(input.outcomes.mRS_favorable, input.outcomes.mRS_distribution);

      if (timepointDays !== standardTimepoint) {
        conversions_applied.push(`Mapped ${timepointDays}-day to ${standardTimepoint}-day timepoint`);
      }

      timepoints.push({
        days: standardTimepoint,
        mortality: mortality,
        mRS_0_2: mrsData.mRS_0_2,
        mRS_0_3: mrsData.mRS_0_3,
        mRS_distribution: mrsData.distribution,
      });
    }

    // Determine confidence based on transformations applied
    const confidence = conversions_applied.length === 0 ? 'high' : conversions_applied.length <= 2 ? 'medium' : 'low';

    return {
      timepoints,
      conversions_applied,
      confidence,
    };
  }

  /**
   * Parse timepoint string to days
   * Examples: "90 days", "3 months", "1 year", "median 6 months"
   */
  private parseTimepointToDays(timepoint?: string): number | undefined {
    if (!timepoint) return undefined;

    // Days
    const daysMatch = timepoint.match(/(\d+)\s*d(ay)?s?/i);
    if (daysMatch) return parseInt(daysMatch[1]);

    // Months (assume 30 days/month)
    const monthsMatch = timepoint.match(/(\d+)\s*m(onth)?s?/i);
    if (monthsMatch) return parseInt(monthsMatch[1]) * 30;

    // Years (assume 365 days/year)
    const yearsMatch = timepoint.match(/(\d+)\s*y(ea)?r?s?/i);
    if (yearsMatch) return parseInt(yearsMatch[1]) * 365;

    return undefined;
  }

  /**
   * Map an actual timepoint to the nearest standard timepoint
   */
  private mapToStandardTimepoint(days: number): number {
    return this.STANDARD_TIMEPOINTS.reduce((nearest, standard) => {
      return Math.abs(standard - days) < Math.abs(nearest - days) ? standard : nearest;
    });
  }

  /**
   * Parse mortality percentage from text
   * Examples: "15%", "15/100", "15 of 100 patients died"
   */
  private parseMortality(text?: string): number | undefined {
    if (!text) return undefined;

    // Percentage
    const percentMatch = text.match(/(\d+\.?\d*)%/);
    if (percentMatch) return parseFloat(percentMatch[1]) / 100;

    // Fraction
    const fractionMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (fractionMatch) {
      return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
    }

    return undefined;
  }

  /**
   * Parse mRS outcome data with distribution-based conversion
   *
   * If the study provides full mRS distribution (% at each mRS level 0-6),
   * converts between different favorable outcome definitions:
   * - mRS 0-2 vs mRS 0-3
   * - Calculate expected proportions
   */
  private parseMrsOutcome(
    favorable?: string,
    distribution?: string
  ): {
    mRS_0_2?: number;
    mRS_0_3?: number;
    distribution?: number[];
  } {
    const result: {
      mRS_0_2?: number;
      mRS_0_3?: number;
      distribution?: number[];
    } = {};

    // Parse mRS distribution if provided
    if (distribution) {
      const distributionArray = this.parseDistribution(distribution);
      if (distributionArray && distributionArray.length === 7) {
        result.distribution = distributionArray;

        // Calculate mRS 0-2 (sum of proportions for mRS 0, 1, 2)
        result.mRS_0_2 = distributionArray[0] + distributionArray[1] + distributionArray[2];

        // Calculate mRS 0-3 (sum of proportions for mRS 0, 1, 2, 3)
        result.mRS_0_3 = distributionArray[0] + distributionArray[1] + distributionArray[2] + distributionArray[3];
      }
    }

    // Parse favorable outcome if provided
    if (favorable) {
      const favorableValue = this.parsePercentageOrFraction(favorable);

      if (favorableValue !== undefined) {
        // Determine if this is mRS 0-2 or 0-3
        if (favorable.toLowerCase().includes('0-2') || favorable.toLowerCase().includes('0 to 2')) {
          result.mRS_0_2 = favorableValue;
        } else if (favorable.toLowerCase().includes('0-3') || favorable.toLowerCase().includes('0 to 3')) {
          result.mRS_0_3 = favorableValue;
        } else {
          // Assume mRS 0-2 if not specified
          result.mRS_0_2 = favorableValue;
        }
      }
    }

    return result;
  }

  /**
   * Parse mRS distribution from text
   * Examples:
   * - "10%, 15%, 20%, 15%, 20%, 10%, 10%" (percentages)
   * - "[0.10, 0.15, 0.20, 0.15, 0.20, 0.10, 0.10]" (decimals)
   * - "10/100, 15/100, 20/100, ..." (fractions)
   */
  private parseDistribution(text: string): number[] | undefined {
    // Try to parse as array of decimals
    const arrayMatch = text.match(/\[([\d.,\s]+)\]/);
    if (arrayMatch) {
      const values = arrayMatch[1].split(',').map(s => parseFloat(s.trim()));
      if (values.length === 7 && values.every(v => !isNaN(v))) {
        return values;
      }
    }

    // Try to parse as comma-separated percentages or fractions
    const parts = text.split(/[,;]/).map(s => s.trim());
    if (parts.length === 7) {
      const values = parts.map(part => this.parsePercentageOrFraction(part));
      if (values.every(v => v !== undefined)) {
        return values as number[];
      }
    }

    return undefined;
  }

  /**
   * Parse percentage or fraction from text
   * Examples: "15%", "0.15", "15/100"
   */
  private parsePercentageOrFraction(text: string): number | undefined {
    // Percentage
    const percentMatch = text.match(/(\d+\.?\d*)%/);
    if (percentMatch) {
      return parseFloat(percentMatch[1]) / 100;
    }

    // Decimal (0.0 to 1.0)
    const decimalMatch = text.match(/0\.\d+/);
    if (decimalMatch) {
      return parseFloat(decimalMatch[0]);
    }

    // Fraction
    const fractionMatch = text.match(/(\d+)\s*\/\s*(\d+)/);
    if (fractionMatch) {
      return parseInt(fractionMatch[1]) / parseInt(fractionMatch[2]);
    }

    return undefined;
  }

  /**
   * Document all transformations applied during harmonization
   */
  private documentTransformations(_input: HarmonizerInput, harmonized: HarmonizedOutcomes): string[] {
    return harmonized.conversions_applied;
  }
}
