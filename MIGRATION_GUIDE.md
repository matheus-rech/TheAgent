# Migration Guide: From Direct API to Agent SDK

## Quick Reference

### Function Mapping

| Legacy Function (Direct API) | New Function (Agent SDK) | Client Needed? |
|------------------------------|--------------------------|----------------|
| `performStructuredExtraction()` | `performStructuredExtractionWithAgent()` | ❌ No |
| `extractMethodsSection()` | `extractMethodsSectionWithAgent()` | ❌ No |
| `extractResultsSection()` | `extractResultsSectionWithAgent()` | ❌ No |
| `extractCitationsStructured()` | `extractCitationsStructuredWithAgent()` | ❌ No |

## Side-by-Side Comparison

### Example 1: Methods Section Extraction

#### Before (Legacy)
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { extractMethodsSection } from './utils/structured-extraction';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const result = await extractMethodsSection(
  client,
  methodsText,
  { verbose: true }
);

console.log(result);
```

#### After (Agent SDK)
```typescript
import { extractMethodsSectionWithAgent } from './utils/structured-extraction';

// No client initialization needed!
const result = await extractMethodsSectionWithAgent(
  methodsText,
  {
    verbose: true,
    agentOptions: {
      model: 'claude-sonnet-4-5-20250929'
    }
  }
);

console.log(result);
```

### Example 2: Full PDF Extraction

#### Before (Legacy)
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { performStructuredExtraction, CEREBELLAR_STUDY_EXTRACTION_TOOL } from './utils/structured-extraction';
import { readFileSync } from 'fs';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const pdfBuffer = readFileSync('study.pdf');
const pdfBase64 = pdfBuffer.toString('base64');

const result = await performStructuredExtraction({
  client,
  documentContent: {
    type: 'base64',
    media_type: 'application/pdf',
    data: pdfBase64
  },
  prompt: 'Extract all study data',
  tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
  enableCitations: true,
  verbose: true
});

console.log(result.data);
if (result.displaySources) {
  result.displaySources();
}
```

#### After (Agent SDK)
```typescript
import { performStructuredExtractionWithAgent, CEREBELLAR_STUDY_EXTRACTION_TOOL } from './utils/structured-extraction';
import { readFileSync } from 'fs';

// No client initialization!
const pdfBuffer = readFileSync('study.pdf');
const pdfBase64 = pdfBuffer.toString('base64');

const result = await performStructuredExtractionWithAgent({
  documentContent: {
    type: 'base64',
    media_type: 'application/pdf',
    data: pdfBase64
  },
  prompt: 'Extract all study data',
  tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
  enableCitations: true,
  verbose: true,
  agentOptions: {
    model: 'claude-sonnet-4-5-20250929',
    maxTurns: 1
  }
});

console.log(result.data);
if (result.displaySources) {
  result.displaySources();
}
```

### Example 3: With Error Handling

#### Before (Legacy)
```typescript
try {
  const result = await performStructuredExtraction({
    client,
    documentContent: pdfBase64,
    prompt: 'Extract data',
    tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 4096
  });

  return result.data;
} catch (error) {
  if (error.status === 429) {
    console.error('Rate limited');
  }
  throw error;
}
```

#### After (Agent SDK)
```typescript
try {
  const result = await performStructuredExtractionWithAgent({
    documentContent: pdfBase64,
    prompt: 'Extract data',
    tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
    agentOptions: {
      model: 'claude-sonnet-4-5-20250929',
      maxBudgetUsd: 0.50 // New: Budget control
    }
  });

  // Additional debugging info
  console.log('Messages:', result.rawMessages);

  return result.data;
} catch (error) {
  console.error('Extraction failed:', error);
  throw error;
}
```

## Key Differences

### 1. No Client Required
**Legacy**: Must create and pass `Anthropic` client instance
**Agent SDK**: No client needed, SDK manages authentication internally

### 2. Options Structure
**Legacy**: Flat options with `client`, `model`, `maxTokens`
**Agent SDK**: Nested `agentOptions` with expanded capabilities

### 3. Return Types
**Legacy**:
```typescript
{
  data: T;
  citations?: any[];
  rawResponse: Anthropic.Messages.Message;
  displaySources?: () => void;
}
```

**Agent SDK**:
```typescript
{
  data: T;
  citations?: any[];
  rawMessages: SDKMessage[];  // ← More comprehensive
  displaySources?: () => void;
}
```

### 4. Advanced Features

#### MCP Server Integration (Agent SDK Only)
```typescript
const result = await performStructuredExtractionWithAgent({
  documentContent: pdfBase64,
  prompt: 'Extract data',
  tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
  agentOptions: {
    mcpServers: {
      docling: {
        command: 'uvx',
        args: ['--from=docling-mcp', 'docling-mcp-server'],
        env: {}
      }
    }
  }
});
```

#### Budget Control (Agent SDK Only)
```typescript
const result = await performStructuredExtractionWithAgent({
  documentContent: pdfBase64,
  prompt: 'Extract data',
  tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
  agentOptions: {
    maxBudgetUsd: 0.25  // Stop if cost exceeds $0.25
  }
});
```

#### Hooks (Agent SDK Only)
```typescript
const result = await performStructuredExtractionWithAgent({
  documentContent: pdfBase64,
  prompt: 'Extract data',
  tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
  agentOptions: {
    hooks: {
      PreToolUse: [{
        matcher: 'extract_cerebellar_study_data',
        hooks: [async (input, toolUseID, options) => {
          console.log('About to extract:', input.tool_name);
          return { continue: true };
        }]
      }],
      PostToolUse: [{
        matcher: 'extract_cerebellar_study_data',
        hooks: [async (input, toolUseID, options) => {
          console.log('Extraction complete');
          return {};
        }]
      }]
    }
  }
});
```

## Migration Checklist

- [ ] Remove `Anthropic` client initialization code
- [ ] Remove `client` parameter from function calls
- [ ] Wrap model/config options in `agentOptions` object
- [ ] Update return type expectations (`rawResponse` → `rawMessages`)
- [ ] Consider adding budget limits with `maxBudgetUsd`
- [ ] Consider adding MCP servers if needed
- [ ] Update error handling for Agent SDK error types
- [ ] Test thoroughly with actual PDFs

## Breaking Changes

### ❌ Removed Parameters
- `client` parameter (no longer needed)
- Top-level `maxTokens` (move to `agentOptions.maxTokens` if needed)

### ✅ New Parameters
- `agentOptions` (comprehensive Agent SDK configuration)

### ⚠️ Changed Return Type
- `rawResponse: Anthropic.Messages.Message` → `rawMessages: SDKMessage[]`

## Backward Compatibility

All legacy functions are **preserved** and will continue to work:
- ✅ `performStructuredExtraction()` - Still available
- ✅ `extractMethodsSection()` - Still available
- ✅ `extractResultsSection()` - Still available
- ✅ `extractCitationsStructured()` - Still available

You can migrate gradually:
1. Keep existing code using legacy functions
2. Use new Agent SDK functions for new features
3. Migrate incrementally when ready

## Performance Considerations

### Agent SDK Advantages
- ✅ Built-in session management
- ✅ Automatic retry logic
- ✅ Better connection pooling
- ✅ MCP server caching
- ✅ Permission system reduces overhead

### Legacy Advantages
- ✅ Direct control over API calls
- ✅ Simpler for single-request scenarios
- ✅ Familiar Anthropic SDK patterns

## When to Use Each Approach

### Use Legacy (Direct API) When:
- Simple one-off extractions
- Need precise control over API parameters
- Working in environment without Agent SDK
- Existing codebase already uses direct API

### Use Agent SDK When:
- Building production applications
- Need MCP server integration
- Want built-in budget controls
- Need session management
- Want enhanced debugging (rawMessages)
- Using hooks for monitoring/logging

## Common Pitfalls

### ❌ Pitfall 1: Forgetting to Remove Client
```typescript
// WRONG - Agent SDK doesn't need client
const client = new Anthropic({ apiKey: '...' });
await extractMethodsSectionWithAgent(client, text);  // ❌ Too many args
```

### ✅ Solution
```typescript
// RIGHT - No client needed
await extractMethodsSectionWithAgent(text, { verbose: true });
```

### ❌ Pitfall 2: Wrong Options Nesting
```typescript
// WRONG - maxBudgetUsd at wrong level
await performStructuredExtractionWithAgent({
  documentContent: pdf,
  prompt: 'Extract',
  tool: TOOL,
  maxBudgetUsd: 0.50  // ❌ Wrong level
});
```

### ✅ Solution
```typescript
// RIGHT - maxBudgetUsd in agentOptions
await performStructuredExtractionWithAgent({
  documentContent: pdf,
  prompt: 'Extract',
  tool: TOOL,
  agentOptions: {
    maxBudgetUsd: 0.50  // ✅ Correct
  }
});
```

### ❌ Pitfall 3: Expecting rawResponse
```typescript
// WRONG - rawResponse doesn't exist in Agent SDK version
const result = await performStructuredExtractionWithAgent({ ... });
console.log(result.rawResponse);  // ❌ undefined
```

### ✅ Solution
```typescript
// RIGHT - Use rawMessages instead
const result = await performStructuredExtractionWithAgent({ ... });
console.log(result.rawMessages);  // ✅ Array of SDK messages
```

## Support

For issues or questions:
1. Check `REFACTOR_SUMMARY.md` for implementation details
2. Review `examples/agent-sdk-extraction-example.ts` for usage patterns
3. Consult Agent SDK documentation: https://github.com/anthropics/claude-agent-sdk

---

**Last Updated**: November 24, 2025
