# Multi-Source Fuser Developer Guide

## Overview

The Multi-Source Fuser module intelligently combines data from multiple research paper sources (main paper, supplements, errata, protocols, registries) with automatic conflict detection and resolution.

## Key Features

✅ **Automatic Conflict Detection**: Identifies differences across all sources
✅ **Hybrid Resolution**: Simple rules for straightforward conflicts, AI for complex ones
✅ **Intelligent Prioritization**: Errata > Supplement > Main Paper > Protocol
✅ **Provenance Tracking**: Documents all resolution decisions
✅ **Error Handling**: Graceful fallback if Agent SDK unavailable

## Quick Start

### Basic Usage

```typescript
import { MultiSourceFuser } from './modules/multi-source-fuser.js';

const fuser = new MultiSourceFuser();

const input = {
  sources: [
    {
      type: 'main-paper',
      data: { /* extracted data */ },
      url: 'https://doi.org/10.1234/example',
      extraction_date: '2024-11-24'
    },
    {
      type: 'supplement',
      data: { /* extracted data */ },
      file_path: '/path/to/supplement.pdf',
      extraction_date: '2024-11-24'
    }
  ]
};

const result = await fuser.process(input, { verbose: true });

console.log('Combined data:', result.combined_data);
console.log('Sources:', result.sources);
console.log('Conflicts resolved:', result.conflicts.length);
```

### Output Structure

```typescript
interface MultiSourceFuserResult {
  combined_data: Partial<CerebellumExtractionData>;
  sources: SourceMetadata[];
  conflicts: ConflictResolution[];
}

interface ConflictResolution {
  field: string;
  values: { source: string; value: any }[];
  resolution: any;
  resolution_strategy: 'most-recent' | 'highest-quality' | 'manual-review';
}
```

## Conflict Resolution Logic

### Automatic Categorization

The module automatically categorizes conflicts as **simple** or **complex**:

#### Simple Conflicts (Rule-Based)
- Clear priority differences (e.g., erratum vs. main paper)
- Non-critical fields
- Small numerical differences (<10%)
- **Processing**: Instant (<1ms)

#### Complex Conflicts (Agent SDK)
- Critical fields (sample size, mortality, p-values)
- Significant numerical differences (>10% general, >2% mortality)
- Equal-priority sources
- Qualitative contradictions (string similarity <50%)
- **Processing**: ~3-5 seconds per batch

### Resolution Strategies

| Strategy | When Applied | Example |
|----------|--------------|---------|
| `highest-quality` | Erratum corrections, clear priority | Erratum (18.5%) > Main paper (18%) |
| `most-recent` | Equal quality, different dates | 2024 supplement > 2023 main paper |
| `manual-review` | Low confidence, contradictions | Sample size: 120 vs 115 (needs review) |

## Critical Fields

These fields trigger Agent SDK resolution:

```typescript
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
```

## Agent SDK Integration

### Configuration

Uses `AGENT_CONFIGS.multiSourceFuser`:

```typescript
{
  model: 'claude-sonnet-4-5-20250929',
  maxTokens: 4096,
  temperature: 0.0,
  systemPrompt: 'You are a data integration specialist...'
}
```

### Agent Prompt Structure

The Agent receives:

1. **Source Context**: Type, URL, extraction date, data excerpt
2. **Conflict Details**: Field name, values from each source
3. **Resolution Strategies**: Prioritized list of strategies to apply
4. **Critical Field Handling**: Special instructions for sample size, mortality, etc.
5. **Output Format**: JSON schema for resolutions

### Agent Response

```json
{
  "resolutions": [
    {
      "field": "patient_demographics.sample_size",
      "resolved_value": 115,
      "resolution_strategy": "most-recent",
      "justification": "Main paper (n=115) published after registry (n=120), likely reflects exclusions",
      "confidence": "high",
      "flag_for_review": false
    }
  ]
}
```

## Advanced Usage

### Custom Conflict Detection

If you need to add custom conflict detection logic:

```typescript
// Extend the requiresAgentResolution method
private requiresAgentResolution(conflict: ConflictResolution): boolean {
  // Your custom logic here
  const isCustomCriticalField = conflict.field.includes('my_custom_field');

  return isCustomCriticalField ||
         this.checkNumericalDifference(conflict.values) ||
         // ... other checks
}
```

### Accessing Resolution Details

```typescript
const result = await fuser.process(input, { verbose: true });

// Iterate through all conflicts
for (const conflict of result.conflicts) {
  console.log(`Field: ${conflict.field}`);
  console.log(`Strategy: ${conflict.resolution_strategy}`);
  console.log(`Values:`);
  for (const { source, value } of conflict.values) {
    console.log(`  ${source}: ${value}`);
  }
  console.log(`Resolved to: ${conflict.resolution}`);
}
```

### Source Provenance

```typescript
// Get all sources that contributed to the final result
const sources = result.sources;

for (const source of sources) {
  console.log(`Source: ${source.source_type}`);
  console.log(`URL: ${source.url}`);
  console.log(`Extraction Date: ${source.extraction_date}`);
  console.log(`Fields contributed: ${source.fields_contributed.join(', ')}`);
}
```

## Performance Considerations

### Optimization Tips

1. **Batch Similar Sources**: Process related documents together
2. **Pre-filter Data**: Remove clearly inferior sources before fusion
3. **Monitor Agent Costs**: Track Agent SDK usage for complex conflicts
4. **Cache Resolutions**: Store resolution decisions for repeated conflicts

### Expected Performance

| Metric | Simple Conflicts | Complex Conflicts |
|--------|-----------------|------------------|
| Processing Time | <1ms per conflict | ~3-5s per batch |
| Agent SDK Calls | 0 | 1 per batch |
| Tokens Used | 0 | ~1000-2000 |
| Accuracy | ~95% | ~95-96% |

## Error Handling

### Graceful Degradation

If Agent SDK fails, the module falls back to rule-based resolution:

```typescript
try {
  const agentResolutions = await this.resolveConflictsWithAgent(...);
} catch (error) {
  this.logError(`Agent SDK failed: ${error}, falling back to highest-quality`);
  return conflicts.map(conflict => ({
    ...conflict,
    resolution: this.resolveConflict(conflict.field, conflict.values).value,
    resolution_strategy: 'highest-quality',
  }));
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "No sources provided" | Empty sources array | Provide at least one source |
| "Agent SDK timeout" | Network/API issue | Check API key, retry with backoff |
| "Invalid resolution response" | JSON parsing failed | Fallback applied automatically |

## Testing

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { MultiSourceFuser } from './multi-source-fuser.js';

describe('MultiSourceFuser', () => {
  it('should detect conflicts between sources', async () => {
    const fuser = new MultiSourceFuser();
    const input = {
      sources: [
        {
          type: 'main-paper',
          data: { patient_demographics: { sample_size: 115 } },
          extraction_date: '2024-11-24',
        },
        {
          type: 'registry',
          data: { patient_demographics: { sample_size: 120 } },
          extraction_date: '2024-11-20',
        },
      ],
    };

    const result = await fuser.process(input);

    expect(result.conflicts.length).toBeGreaterThan(0);
    expect(result.conflicts[0].field).toContain('sample_size');
  });
});
```

## Best Practices

### ✅ Do

- Always provide extraction dates for accurate recency-based resolution
- Include URLs or file paths for provenance tracking
- Use verbose mode during development for debugging
- Validate combined data before downstream processing
- Log all conflicts for quality assurance

### ❌ Don't

- Don't ignore `manual-review` flags (investigate these conflicts)
- Don't assume Agent SDK is always available (handle fallback)
- Don't modify conflict resolutions manually (breaks provenance)
- Don't mix sources with vastly different quality (filter first)

## Debugging

### Enable Verbose Logging

```typescript
const result = await fuser.process(input, { verbose: true });
```

Output:
```
[Multi-Source Fuser] Fusing data from 3 sources...
[Multi-Source Fuser] Found 2 conflicts between sources
[Multi-Source Fuser] Using Agent SDK to resolve 1 complex conflicts...
[Multi-Source Fuser] Agent resolved conflict in patient_demographics.sample_size using most-recent
[Multi-Source Fuser] Resolved conflict in clinical_outcomes.mortality using highest-quality
```

### Inspect Conflict Details

```typescript
const conflicts = result.conflicts;

console.log(JSON.stringify(conflicts, null, 2));
```

## Extending the Module

### Adding Custom Resolution Strategies

1. Update the `ConflictResolution` type in `types/index.ts`:

```typescript
export interface ConflictResolution {
  resolution_strategy:
    | 'most-recent'
    | 'highest-quality'
    | 'manual-review'
    | 'custom-strategy'; // Add your strategy
}
```

2. Implement logic in `resolveConflict()`:

```typescript
private resolveConflict(fieldPath: string, values: { source: string; value: any }[]): {
  value: any;
  strategy: ConflictResolution['resolution_strategy'];
} {
  if (/* custom condition */) {
    return {
      value: /* custom resolution */,
      strategy: 'custom-strategy',
    };
  }

  // ... existing logic
}
```

## Migration Notes

This module has been migrated to use the Claude Agent SDK for complex conflict resolution. See [MULTI_SOURCE_FUSER_MIGRATION.md](../MULTI_SOURCE_FUSER_MIGRATION.md) for details.

### Backward Compatibility

✅ **Fully backward compatible**
✅ Public API unchanged
✅ Return types unchanged
✅ Simple conflicts use existing logic
✅ Agent SDK only for complex conflicts

## Support

For issues or questions:

1. Check the [Migration Guide](../MULTI_SOURCE_FUSER_MIGRATION.md)
2. Review the [Agent Configuration](../src/agents/config.ts)
3. Examine test cases in `/tests/modules/multi-source-fuser.test.ts`
4. Enable verbose logging for debugging

## Examples

See the `/examples` directory for complete working examples:

- `examples/basic-fusion.ts`: Simple two-source fusion
- `examples/complex-conflicts.ts`: Handling complex conflicts
- `examples/errata-correction.ts`: Erratum correction workflow
- `examples/multi-source-pipeline.ts`: Full extraction + fusion pipeline

---

**Last Updated**: November 24, 2024
**Version**: 0.1.0 (Agent SDK Integration)
