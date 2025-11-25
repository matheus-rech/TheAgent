/**
 * Imaging Metrics Extractor Module
 * Extracts quantitative neuroimaging data from cerebellar stroke studies
 *
 * Enhanced with Claude Agent SDK for context-aware extraction
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { BaseModule } from './base.js';
import { AGENT_CONFIGS } from '../agents/config.js';
import type { ExtractionOptions, ImagingExtractionResult, ImagingMetrics } from '../types/index.js';

interface ImagingInput {
  fullText: string;
  tables?: Array<{ headers: string[]; rows: string[][] }>;
}

export class ImagingMetricsExtractor extends BaseModule<ImagingInput, ImagingExtractionResult> {
  readonly name = 'Imaging Metrics Extractor';
  readonly description = 'Extracts quantitative neuroimaging data specific to cerebellar stroke';

  // Common imaging metrics in cerebellar stroke literature
  private readonly IMAGING_PATTERNS = {
    infarct_volume: /(?:infarct|lesion)\s+volume.*?(\d+\.?\d*)\s*(ml|cm3)/gi,
    edema_volume: /edema\s+volume.*?(\d+\.?\d*)\s*(ml|cm3)/gi,
    midline_shift: /midline\s+shift.*?(\d+\.?\d*)\s*mm/gi,
    fourth_ventricle: /(fourth ventricle|4th ventricle|IVth ventricle)/gi,
    hydrocephalus: /hydrocephalus/gi,
  };

  async process(input: ImagingInput, options?: ExtractionOptions): Promise<ImagingExtractionResult> {
    this.validate();
    this.log('Extracting imaging metrics...', options?.verbose);

    try {
      const metrics = await this.extractMetrics(input, options);
      const confidence = this.calculateConfidence(metrics);

      // Determine extraction method based on what was actually used
      const hasPatternMatches = Object.keys(metrics.extracted_values || {}).length > 0;
      const extraction_method = hasPatternMatches
        ? 'hybrid-pattern-matching-with-agent-sdk'
        : 'pattern-matching-legacy';

      return {
        metrics,
        confidence,
        extraction_method,
      };
    } catch (error) {
      this.logError(`Imaging extraction failed: ${error}`);
      throw error;
    }
  }

  /**
   * Refine pattern-matched values using Claude Agent SDK
   *
   * This method provides context-aware extraction for ambiguous imaging data:
   * - Distinguishes between means, medians, and individual values
   * - Handles statistical reporting formats (mean ± SD, median [IQR])
   * - Resolves conflicts when multiple values are found
   * - Extracts missing metrics from narrative descriptions
   *
   * @param fullText - Complete paper text
   * @param patternMatches - Candidate values from regex patterns
   * @param options - Extraction options
   * @returns Refined imaging metrics with higher confidence
   */
  private async refineWithAgent(
    fullText: string,
    patternMatches: Record<string, string>,
    options?: ExtractionOptions
  ): Promise<ImagingMetrics> {
    try {
      // Construct focused prompt for imaging extraction
      const prompt = `Extract neuroimaging metrics from the following cerebellar stroke study text.

**Pattern Matching Found:**
${Object.entries(patternMatches)
  .map(([metric, value]) => `- ${metric}: ${value}`)
  .join('\n')}

**Full Text Context:**
${fullText.slice(0, 8000)}

**Extraction Requirements:**
1. Infarct volume (mL or cm³) - prefer baseline/admission values
2. Edema volume (mL or cm³) if reported separately
3. Midline shift (mm) - quantitative measurement
4. Hydrocephalus - presence (true/false)
5. Fourth ventricle compression - presence (true/false)
6. Imaging timepoint - when scans were performed (baseline, 24h, follow-up)
7. Imaging modality - CT, MRI, DWI, etc.

**Statistical Format Handling:**
- "Median infarct volume 25 mL (IQR 18-35)" → extract 25 as primary value
- "Mean volume 30 ± 12 mL" → extract 30 as primary value
- For ranges, prefer the representative value (median or mean)

**Return JSON format:**
{
  "infarct_volume_ml": number | null,
  "edema_volume_ml": number | null,
  "midline_shift_mm": number | null,
  "hydrocephalus": boolean | null,
  "fourth_ventricle_compression": boolean | null,
  "imaging_timepoint": string | null,
  "imaging_modality": string | null,
  "extracted_values": {
    "infarct_volume": "original text mention",
    "edema_volume": "original text mention",
    ...
  }
}`;

      this.log('Refining imaging metrics with Agent SDK...', options?.verbose);

      // Use the specialized imaging extractor agent
      const agentConfig = AGENT_CONFIGS.imagingExtractor;

      // Query returns an async iterator, need to collect the response
      const queryResult = query({
        prompt,
        options: {
          model: options?.model || agentConfig.model,
          systemPrompt: agentConfig.systemPrompt,
        },
      });

      // Collect all response chunks
      let responseText = '';
      for await (const message of queryResult) {
        if (message.type === 'assistant') {
          // Access content from the message.message property (APIAssistantMessage)
          for (const block of message.message.content) {
            if (block.type === 'text') {
              responseText += block.text;
            }
          }
        }
      }

      // Parse agent response
      const refinedMetrics = this.parseAgentResponse(responseText);

      this.log(`Agent SDK refined ${Object.keys(refinedMetrics).length} imaging metrics`, options?.verbose);

      return refinedMetrics;
    } catch (error) {
      this.logError(`Agent refinement failed: ${error}`);
      // Fallback: Return empty metrics on agent failure
      return { extracted_values: patternMatches };
    }
  }

  /**
   * Parse Agent SDK response into ImagingMetrics structure
   *
   * Handles various response formats and validates data types
   */
  private parseAgentResponse(response: string): ImagingMetrics {
    try {
      // Try to extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || response.match(/(\{[\s\S]*\})/);

      if (!jsonMatch) {
        this.logError('Agent response did not contain valid JSON');
        return { extracted_values: {} };
      }

      const parsed = JSON.parse(jsonMatch[1]);

      // Validate and type-cast fields
      return {
        infarct_volume_ml: this.parseNumeric(parsed.infarct_volume_ml),
        edema_volume_ml: this.parseNumeric(parsed.edema_volume_ml),
        midline_shift_mm: this.parseNumeric(parsed.midline_shift_mm),
        hydrocephalus: this.parseBoolean(parsed.hydrocephalus),
        fourth_ventricle_compression: this.parseBoolean(parsed.fourth_ventricle_compression),
        imaging_timepoint: parsed.imaging_timepoint || undefined,
        imaging_modality: parsed.imaging_modality || undefined,
        extracted_values: parsed.extracted_values || {},
      };
    } catch (error) {
      this.logError(`Failed to parse agent response: ${error}`);
      return { extracted_values: {} };
    }
  }

  /**
   * Safely parse numeric values (handles null, undefined, strings)
   */
  private parseNumeric(value: any): number | undefined {
    if (value === null || value === undefined) return undefined;
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return !isNaN(num) && isFinite(num) ? num : undefined;
  }

  /**
   * Safely parse boolean values (handles null, undefined, strings)
   */
  private parseBoolean(value: any): boolean | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (lower === 'true' || lower === 'yes' || lower === '1') return true;
      if (lower === 'false' || lower === 'no' || lower === '0') return false;
    }
    return undefined;
  }

  /**
   * Extract imaging metrics from text and tables
   *
   * ENHANCED with Agent SDK integration:
   *
   * This function now follows a two-stage approach:
   * 1. **Pattern Matching**: Use regex patterns to find candidate values (fast, deterministic)
   * 2. **Agent Refinement**: Use Claude Agent SDK to validate and enhance extraction (context-aware)
   *
   * Benefits of hybrid approach:
   * - Pattern matching provides fast initial extraction
   * - Agent SDK resolves ambiguities (median vs mean, multiple timepoints)
   * - Handles complex statistical formats (mean ± SD, median [IQR])
   * - Extracts missing metrics from narrative descriptions
   * - Higher confidence and accuracy (92% target)
   *
   * Migration strategy:
   * - Existing pattern matching logic preserved (backward compatible)
   * - Agent SDK enhancement optional (gracefully degrades on failure)
   * - Pattern matches serve as candidates for agent refinement
   */
  private async extractMetrics(input: ImagingInput, options?: ExtractionOptions): Promise<ImagingMetrics> {
    const extracted_values: Record<string, string> = {};

    // Step 1: Pattern-based extraction (fast, deterministic)
    for (const [metric, pattern] of Object.entries(this.IMAGING_PATTERNS)) {
      const matches = [...input.fullText.matchAll(pattern)];
      if (matches.length > 0) {
        this.log(`Found ${matches.length} mentions of ${metric}`, options?.verbose);

        // Store all matches for review
        extracted_values[metric] = matches.map((m) => m[0]).join('; ');
      }
    }

    // Step 2: NEW - Refine with Agent SDK if patterns found candidates
    if (Object.keys(extracted_values).length > 0) {
      this.log('Pattern matching found candidates, refining with Agent SDK...', options?.verbose);

      // Agent SDK provides context-aware extraction
      const refined = await this.refineWithAgent(input.fullText, extracted_values, options);

      // Agent refinement takes precedence over simple pattern matching
      return refined;
    }

    // Fallback: Legacy pattern-based extraction (backward compatible)
    this.log('No pattern matches found, using legacy extraction...', options?.verbose);

    // Parse numeric values (legacy fallback)
    const infarctVolumeMatch = input.fullText.match(/infarct\s+volume.*?(\d+\.?\d*)/i);
    const infarctVolume = infarctVolumeMatch ? parseFloat(infarctVolumeMatch[1]) : undefined;

    const edemaVolumeMatch = input.fullText.match(/edema\s+volume.*?(\d+\.?\d*)/i);
    const edemaVolume = edemaVolumeMatch ? parseFloat(edemaVolumeMatch[1]) : undefined;

    const midlineShiftMatch = input.fullText.match(/midline\s+shift.*?(\d+\.?\d*)/i);
    const midlineShift = midlineShiftMatch ? parseFloat(midlineShiftMatch[1]) : undefined;

    // Boolean flags (legacy fallback)
    const hasHydrocephalus = /hydrocephalus/i.test(input.fullText);
    const hasFourthVentricleCompression = /(fourth ventricle|4th ventricle).*?compres/i.test(input.fullText);

    return {
      infarct_volume_ml: infarctVolume,
      edema_volume_ml: edemaVolume,
      midline_shift_mm: midlineShift,
      hydrocephalus: hasHydrocephalus || undefined,
      fourth_ventricle_compression: hasFourthVentricleCompression || undefined,
      imaging_timepoint: this.extractImagingTimepoint(input.fullText),
      imaging_modality: this.extractImagingModality(input.fullText),
      extracted_values,
    };
  }

  /**
   * Determine the imaging timepoint (baseline, 24h, etc.)
   */
  private extractImagingTimepoint(text: string): string | undefined {
    if (/admission|baseline|initial/i.test(text)) return 'baseline';
    if (/24\s*h|24-h|24\s*hour/i.test(text)) return '24-hour';
    if (/follow-?up/i.test(text)) return 'follow-up';
    return undefined;
  }

  /**
   * Identify imaging modality (CT, MRI, etc.)
   */
  private extractImagingModality(text: string): string | undefined {
    if (/\bCT\b|computed tomography/i.test(text)) return 'CT';
    if (/\bMRI\b|magnetic resonance/i.test(text)) return 'MRI';
    if (/\bDWI\b|diffusion-weighted/i.test(text)) return 'DWI-MRI';
    return undefined;
  }

  /**
   * Calculate confidence score based on how many metrics were found
   */
  private calculateConfidence(metrics: ImagingMetrics): number {
    let score = 0;
    const weights = {
      infarct_volume_ml: 0.3,
      edema_volume_ml: 0.2,
      midline_shift_mm: 0.2,
      imaging_modality: 0.15,
      imaging_timepoint: 0.15,
    };

    for (const [key, weight] of Object.entries(weights)) {
      if (metrics[key as keyof ImagingMetrics] !== undefined) {
        score += weight;
      }
    }

    return Math.min(score, 1.0);
  }
}
