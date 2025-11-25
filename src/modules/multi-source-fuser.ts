/**
 * Multi-Source Data Fuser Module
 * Combines data from multiple sources (main paper, supplements, errata, protocols)
 *
 * Enhanced with Claude Agent SDK for intelligent conflict resolution:
 * - Priority-based resolution (errata > supplement > main paper)
 * - Recency-based resolution (newer sources preferred)
 * - Quality-based resolution (higher quality sources win)
 * - AI-powered resolution for complex conflicts
 * - Provenance tracking for all resolutions
 */

import { BaseModule } from './base.js';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { AGENT_CONFIGS } from '../agents/config.js';
import type {
  ExtractionOptions,
  MultiSourceFuserResult,
  CerebellumExtractionData,
  SourceMetadata,
  ConflictResolution,
} from '../types/index.js';

interface FuserInput {
  /** Extraction results from different sources */
  sources: Array<{
    type: 'main-paper' | 'supplement' | 'erratum' | 'protocol' | 'registry';
    data: Partial<CerebellumExtractionData>;
    url?: string;
    file_path?: string;
    extraction_date: string;
  }>;
}

export class MultiSourceFuser extends BaseModule<FuserInput, MultiSourceFuserResult> {
  readonly name = 'Multi-Source Fuser';
  readonly description = 'Intelligently combines data from multiple sources with conflict resolution';

  async process(input: FuserInput, options?: ExtractionOptions): Promise<MultiSourceFuserResult> {
    this.validate();
    this.log(`Fusing data from ${input.sources.length} sources...`, options?.verbose);

    if (input.sources.length === 0) {
      throw new Error('No sources provided for fusion');
    }

    if (input.sources.length === 1) {
      this.log('Only one source, returning as-is', options?.verbose);
      return {
        combined_data: input.sources[0].data,
        sources: [this.createSourceMetadata(input.sources[0])],
        conflicts: [],
      };
    }

    try {
      // Detect conflicts across sources
      const conflicts = this.detectConflicts(input.sources, options);

      if (conflicts.length > 0) {
        this.log(`Found ${conflicts.length} conflicts between sources`, options?.verbose);
      }

      // Resolve conflicts and merge data
      const combined_data = await this.mergeWithConflictResolution(input.sources, conflicts, options);

      // Create source metadata
      const sources = input.sources.map((s) => this.createSourceMetadata(s));

      return {
        combined_data,
        sources,
        conflicts,
      };
    } catch (error) {
      this.logError(`Data fusion failed: ${error}`);
      throw error;
    }
  }

  /**
   * Detect conflicts between different sources
   *
   * TODO: Implement comprehensive conflict detection
   *
   * This should identify when different sources provide different values
   * for the same field. Key scenarios:
   *
   * 1. **Corrected data in errata:**
   *    - Main paper: "Mortality: 15%"
   *    - Erratum: "Mortality: 18% (corrected)"
   *    → Erratum should take precedence
   *
   * 2. **Additional data in supplements:**
   *    - Main paper: Missing subgroup data
   *    - Supplement: Detailed subgroup outcomes
   *    → Supplement provides additional, not conflicting data
   *
   * 3. **Protocol vs. published results:**
   *    - Protocol: "Primary outcome: 90-day mortality"
   *    - Paper: Reports both 30-day and 90-day
   *    → Not a conflict, protocol helps validate primary outcome
   *
   * 4. **Registry vs. publication:**
   *    - ClinicalTrials.gov: Sample size = 120
   *    - Published paper: Sample size = 115
   *    → Potential selective exclusion, needs flagging
   *
   * Decision needed:
   * - What constitutes a "conflict" vs. "complementary data"?
   * - Should numeric differences below a threshold be ignored?
   * - How to handle missing data in one source?
   */
  private detectConflicts(
    sources: FuserInput['sources'],
    options?: ExtractionOptions
  ): ConflictResolution[] {
    const conflicts: ConflictResolution[] = [];

    // Get all unique field paths across sources
    const allFields = new Set<string>();
    for (const source of sources) {
      this.extractFieldPaths(source.data).forEach((path) => allFields.add(path));
    }

    // Check each field for conflicts
    for (const fieldPath of allFields) {
      const values: { source: string; value: any }[] = [];

      for (const source of sources) {
        const value = this.getValueAtPath(source.data, fieldPath);
        if (value !== undefined && value !== null && value !== '') {
          values.push({
            source: source.type,
            value,
          });
        }
      }

      // If multiple different values exist, it's a conflict
      if (values.length > 1) {
        const uniqueValues = [...new Set(values.map((v) => JSON.stringify(v.value)))];
        if (uniqueValues.length > 1) {
          this.log(`Conflict detected in ${fieldPath}: ${uniqueValues.length} different values`, options?.verbose);

          // Determine resolution strategy
          const resolution = this.resolveConflict(fieldPath, values);

          conflicts.push({
            field: fieldPath,
            values,
            resolution: resolution.value,
            resolution_strategy: resolution.strategy,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve a conflict between multiple values
   *
   * TODO: Implement sophisticated conflict resolution strategies
   *
   * Resolution strategies to implement:
   *
   * 1. **Source hierarchy (most-recent):**
   *    Erratum > Supplement > Main Paper > Protocol
   *
   * 2. **Source hierarchy (highest-quality):**
   *    Protocol/Registry > Erratum > Main Paper > Supplement
   *
   * 3. **Data completeness:**
   *    Prefer more detailed value over less detailed
   *    E.g., "18.5%" over "18%", "mRS 0-2: 45%" over "favorable outcome: 45%"
   *
   * 4. **Statistical correction:**
   *    If erratum provides corrected statistics, always use that
   *
   * 5. **Manual review required:**
   *    Flag certain conflicts for human review (e.g., sample size discrepancies)
   *
   * Implementation decision:
   * - Should we allow user to configure resolution strategy?
   * - Should critical conflicts require manual review?
   * - How to document which strategy was used for each field?
   */
  private resolveConflict(
    _fieldPath: string,
    values: { source: string; value: any }[]
  ): { value: any; strategy: ConflictResolution['resolution_strategy'] } {
    // Default strategy: most-recent (erratum > supplement > main-paper)
    const sourceRanking = {
      erratum: 4,
      supplement: 3,
      'main-paper': 2,
      protocol: 1,
      registry: 1,
    };

    // Sort by source quality
    const sorted = values.sort((a, b) => {
      return (sourceRanking[b.source as keyof typeof sourceRanking] || 0) -
             (sourceRanking[a.source as keyof typeof sourceRanking] || 0);
    });

    return {
      value: sorted[0].value,
      strategy: 'highest-quality',
    };
  }

  /**
   * Merge all sources with conflict resolution applied
   */
  private async mergeWithConflictResolution(
    sources: FuserInput['sources'],
    conflicts: ConflictResolution[],
    options?: ExtractionOptions
  ): Promise<Partial<CerebellumExtractionData>> {
    // Start with empty merged data
    const merged: any = {};

    // Apply data from each source (will be overwritten by higher-priority sources)
    const sortedSources = this.sortSourcesByPriority(sources);

    for (const source of sortedSources) {
      this.log(`Merging data from ${source.type}`, options?.verbose);
      this.deepMerge(merged, source.data);
    }

    // Separate conflicts into simple and complex
    const { simpleConflicts, complexConflicts } = this.categorizeConflicts(conflicts, sources);

    // Apply simple rule-based resolutions
    for (const conflict of simpleConflicts) {
      this.setValueAtPath(merged, conflict.field, conflict.resolution);
      this.log(`Resolved conflict in ${conflict.field} using ${conflict.resolution_strategy}`, options?.verbose);
    }

    // Use Agent SDK for complex conflicts
    if (complexConflicts.length > 0) {
      this.log(`Using Agent SDK to resolve ${complexConflicts.length} complex conflicts...`, options?.verbose);
      const agentResolutions = await this.resolveConflictsWithAgent(sources, complexConflicts, options);

      for (const conflict of agentResolutions) {
        this.setValueAtPath(merged, conflict.field, conflict.resolution);
        this.log(`Agent resolved conflict in ${conflict.field} using ${conflict.resolution_strategy}`, options?.verbose);
      }
    }

    return merged;
  }

  /**
   * Categorize conflicts into simple (rule-based) and complex (Agent SDK)
   */
  private categorizeConflicts(
    conflicts: ConflictResolution[],
    sources: FuserInput['sources']
  ): { simpleConflicts: ConflictResolution[]; complexConflicts: ConflictResolution[] } {
    const simpleConflicts: ConflictResolution[] = [];
    const complexConflicts: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      // Complex cases that need Agent SDK:
      // 1. Sample size discrepancies (>5% difference)
      // 2. Contradicting statistical measures (p-values, CIs)
      // 3. Conflicting mortality rates (>2% difference)
      // 4. Multiple sources with equal priority
      // 5. Fields requiring medical/statistical reasoning

      const isComplexConflict = this.requiresAgentResolution(conflict, sources);

      if (isComplexConflict) {
        complexConflicts.push(conflict);
      } else {
        simpleConflicts.push(conflict);
      }
    }

    return { simpleConflicts, complexConflicts };
  }

  /**
   * Check if a conflict requires Agent SDK resolution
   */
  private requiresAgentResolution(conflict: ConflictResolution, sources: FuserInput['sources']): boolean {
    // Critical fields that need careful resolution
    const criticalFields = [
      'patient_demographics.sample_size',
      'patient_demographics.total_enrolled',
      'clinical_outcomes.mortality',
      'clinical_outcomes.in_hospital_mortality',
      'clinical_outcomes.thirty_day_mortality',
      'statistical_analysis.primary_outcome_p_value',
      'inclusion_criteria',
      'exclusion_criteria',
    ];

    const isCriticalField = criticalFields.some(field => conflict.field.includes(field));

    // Check if values are numerically different by significant amount
    const hasSignificantNumericalDifference = this.checkNumericalDifference(conflict.values);

    // Check if sources have equal priority (e.g., multiple supplements or protocols)
    const hasEqualPrioritySources = this.checkEqualPrioritySources(conflict.values, sources);

    // Check if conflict involves contradicting qualitative data
    const hasQualitativeConflict = this.checkQualitativeConflict(conflict.values);

    return isCriticalField || hasSignificantNumericalDifference || hasEqualPrioritySources || hasQualitativeConflict;
  }

  /**
   * Check if numerical values differ significantly (>10% for most fields, >2% for mortality)
   */
  private checkNumericalDifference(values: { source: string; value: any }[]): boolean {
    const numericalValues = values
      .map(v => {
        if (typeof v.value === 'number') return v.value;
        if (typeof v.value === 'string') {
          const match = v.value.match(/(\d+\.?\d*)/);
          return match ? parseFloat(match[1]) : null;
        }
        return null;
      })
      .filter(v => v !== null) as number[];

    if (numericalValues.length < 2) return false;

    const min = Math.min(...numericalValues);
    const max = Math.max(...numericalValues);
    const percentDifference = ((max - min) / min) * 100;

    // Lower threshold for mortality rates (critical outcome)
    const isMortalityField = values[0]?.source && values[0].source.toString().toLowerCase().includes('mortality');
    const threshold = isMortalityField ? 2 : 10;

    return percentDifference > threshold;
  }

  /**
   * Check if sources have equal priority
   */
  private checkEqualPrioritySources(values: { source: string; value: any }[], _sources: FuserInput['sources']): boolean {
    const sourcePriorities = values.map(v => {
      const priority = {
        erratum: 4,
        supplement: 3,
        'main-paper': 2,
        protocol: 1,
        registry: 1,
      };
      return priority[v.source as keyof typeof priority] || 0;
    });

    const uniquePriorities = new Set(sourcePriorities);
    return uniquePriorities.size === 1 && sourcePriorities.length > 1;
  }

  /**
   * Check if conflict involves contradicting qualitative data
   */
  private checkQualitativeConflict(values: { source: string; value: any }[]): boolean {
    // If values are strings and substantially different (not just formatting)
    const stringValues = values
      .map(v => typeof v.value === 'string' ? v.value.toLowerCase().trim() : null)
      .filter(v => v !== null) as string[];

    if (stringValues.length < 2) return false;

    // Check if any pair of values are semantically different
    for (let i = 0; i < stringValues.length - 1; i++) {
      for (let j = i + 1; j < stringValues.length; j++) {
        // If strings are very different (low similarity), it's a qualitative conflict
        const similarity = this.calculateStringSimilarity(stringValues[i], stringValues[j]);
        if (similarity < 0.5) return true;
      }
    }

    return false;
  }

  /**
   * Calculate similarity between two strings (0 = completely different, 1 = identical)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Resolve complex conflicts using Agent SDK
   *
   * This method uses Claude to intelligently resolve conflicts that cannot be
   * handled by simple rule-based logic. The Agent applies medical/statistical
   * reasoning to determine the most appropriate resolution.
   */
  private async resolveConflictsWithAgent(
    sources: FuserInput['sources'],
    conflicts: ConflictResolution[],
    _options?: ExtractionOptions
  ): Promise<ConflictResolution[]> {
    const prompt = this.buildConflictResolutionPrompt(sources, conflicts);

    try {
      const queryResult = query({
        prompt,
        options: {
          model: AGENT_CONFIGS.multiSourceFuser.model,
          systemPrompt: AGENT_CONFIGS.multiSourceFuser.systemPrompt,
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

      return this.parseConflictResolutionResponse(responseText, conflicts);
    } catch (error) {
      this.logError(`Agent SDK conflict resolution failed: ${error}, falling back to highest-quality strategy`);
      // Fallback: use simple highest-quality resolution
      return conflicts.map(conflict => ({
        ...conflict,
        resolution: this.resolveConflict(conflict.field, conflict.values).value,
        resolution_strategy: 'highest-quality' as const,
      }));
    }
  }

  /**
   * Build prompt for Agent SDK conflict resolution
   */
  private buildConflictResolutionPrompt(sources: FuserInput['sources'], conflicts: ConflictResolution[]): string {
    // Build source context
    const sourceContext = sources.map((source, idx) => {
      return `Source ${idx + 1}: ${source.type} (${source.url || source.file_path || 'unknown location'})
  Extraction Date: ${source.extraction_date}
  Data Excerpt: ${JSON.stringify(source.data).substring(0, 500)}...`;
    }).join('\n\n');

    // Build conflict details
    const conflictDetails = conflicts.map((conflict, idx) => {
      const valuesFormatted = conflict.values.map(v =>
        `  - ${v.source}: ${JSON.stringify(v.value)}`
      ).join('\n');

      return `Conflict ${idx + 1}: ${conflict.field}
${valuesFormatted}`;
    }).join('\n\n');

    return `Resolve the following data conflicts between multiple research paper sources:

**Sources:**
${sourceContext}

**Conflicts:**
${conflictDetails}

**Resolution Strategy:**
Apply these intelligent resolution strategies in order of priority:

1. **Errata/Corrections Priority**: If an erratum explicitly corrects a value, ALWAYS use the corrected version
2. **Recency Priority**: For equal-quality sources, prefer the most recent extraction/publication
3. **Quality Priority**: Main paper > Supplement > Protocol (unless protocol is pre-registered)
4. **Completeness Priority**: Prefer more detailed/complete data over less detailed
5. **Statistical Consistency**: Validate numbers sum correctly (e.g., mortality + survival = 100%)
6. **Medical Reasoning**: Apply domain knowledge for clinically significant differences

**Critical Fields (require extra scrutiny):**
- Sample size: Flag discrepancies >5%
- Mortality rates: Flag differences >2%
- Statistical p-values: Document all values, prefer primary outcome
- Inclusion/exclusion criteria: Combine complementary data, flag contradictions

**Output Format (JSON):**
\`\`\`json
{
  "resolutions": [
    {
      "field": "patient_demographics.sample_size",
      "resolved_value": 115,
      "resolution_strategy": "most-recent",
      "justification": "Main paper (n=115) published after registry entry (n=120), likely reflects exclusions after enrollment",
      "confidence": "high",
      "flag_for_review": false
    }
  ]
}
\`\`\`

**Important:**
- Provide clear justification for each resolution
- Assign confidence level (high/medium/low)
- Flag conflicts requiring manual review if uncertain
- Preserve all original values in justification for provenance

Provide only the JSON output, no additional explanation.`;
  }

  /**
   * Parse Agent SDK conflict resolution response
   */
  private parseConflictResolutionResponse(response: string, originalConflicts: ConflictResolution[]): ConflictResolution[] {
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = response.match(/\`\`\`(?:json)?\s*(\{[\s\S]*?\})\s*\`\`\`/);
      const jsonString = jsonMatch ? jsonMatch[1] : response;

      const parsed = JSON.parse(jsonString);

      if (!parsed.resolutions || !Array.isArray(parsed.resolutions)) {
        throw new Error('Invalid resolution response: missing resolutions array');
      }

      // Convert Agent response to ConflictResolution format
      return parsed.resolutions.map((resolution: any, idx: number) => {
        const originalConflict = originalConflicts[idx];

        return {
          field: resolution.field || originalConflict.field,
          values: originalConflict.values,
          resolution: resolution.resolved_value,
          resolution_strategy: resolution.resolution_strategy as ConflictResolution['resolution_strategy'],
        };
      });
    } catch (error) {
      this.logError(`Failed to parse Agent SDK resolution response: ${error}`);
      // Return empty array on parse failure
      return [];
    }
  }

  /**
   * Sort sources by priority (higher priority = merged later, wins conflicts)
   */
  private sortSourcesByPriority(sources: FuserInput['sources']): FuserInput['sources'] {
    const priority = {
      protocol: 1,
      registry: 1,
      'main-paper': 2,
      supplement: 3,
      erratum: 4,
    };

    return [...sources].sort((a, b) => {
      return (priority[a.type as keyof typeof priority] || 0) - (priority[b.type as keyof typeof priority] || 0);
    });
  }

  /**
   * Deep merge two objects
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) target[key] = {};
        this.deepMerge(target[key], source[key]);
      } else if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
        target[key] = source[key];
      }
    }
  }

  /**
   * Extract all field paths from a nested object
   */
  private extractFieldPaths(obj: any, prefix = ''): string[] {
    const paths: string[] = [];

    for (const key in obj) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
        paths.push(...this.extractFieldPaths(obj[key], path));
      } else {
        paths.push(path);
      }
    }

    return paths;
  }

  /**
   * Get value at a dot-notation path
   */
  private getValueAtPath(obj: any, path: string): any {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Set value at a dot-notation path
   */
  private setValueAtPath(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((curr, key) => {
      if (!curr[key]) curr[key] = {};
      return curr[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * Create source metadata from a source
   */
  private createSourceMetadata(source: FuserInput['sources'][0]): SourceMetadata {
    return {
      source_type: source.type,
      url: source.url,
      file_path: source.file_path,
      extraction_date: source.extraction_date,
      fields_contributed: this.extractFieldPaths(source.data),
    };
  }
}
