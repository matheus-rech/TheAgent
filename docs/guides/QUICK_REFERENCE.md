# Quick Reference: Agent SDK Structured Extraction

## 🚀 Quick Start

```typescript
import { extractMethodsSectionWithAgent } from './utils/structured-extraction';

// Extract methods section - no client needed!
const result = await extractMethodsSectionWithAgent(
  methodsText,
  { verbose: true }
);
```

## 📋 Function Signatures

### performStructuredExtractionWithAgent
```typescript
async function performStructuredExtractionWithAgent<T = any>(
  options: AgentExtractionOptions
): Promise<{
  data: T;
  citations?: any[];
  rawMessages: SDKMessage[];
  displaySources?: () => void;
}>
```

### extractMethodsSectionWithAgent
```typescript
async function extractMethodsSectionWithAgent(
  methodsText: string,
  options?: {
    verbose?: boolean;
    agentOptions?: Partial<QueryOptions>;
  }
): Promise<any>
```

### extractResultsSectionWithAgent
```typescript
async function extractResultsSectionWithAgent(
  resultsText: string,
  options?: {
    verbose?: boolean;
    agentOptions?: Partial<QueryOptions>;
  }
): Promise<any>
```

### extractCitationsStructuredWithAgent
```typescript
async function extractCitationsStructuredWithAgent(
  referencesText: string,
  options?: {
    verbose?: boolean;
    agentOptions?: Partial<QueryOptions>;
  }
): Promise<any[]>
```

## ⚙️ AgentExtractionOptions

```typescript
interface AgentExtractionOptions {
  // Required
  documentContent: string | {
    type: 'base64';
    media_type: 'application/pdf';
    data: string;
  };
  prompt: string;
  tool: Tool;

  // Optional
  model?: string;                          // Default: 'claude-sonnet-4-5-20250929'
  enableCitations?: boolean;               // Default: false
  verbose?: boolean;                       // Default: false
  agentOptions?: Partial<QueryOptions>;    // Advanced SDK options
}
```

## 🔧 Common Agent Options

```typescript
agentOptions: {
  model?: string;                    // Model to use
  maxTurns?: number;                 // Max conversation turns (usually 1 for extraction)
  maxBudgetUsd?: number;            // Budget limit (e.g., 0.50 for $0.50)
  systemPrompt?: string;            // Custom system prompt
  mcpServers?: Record<string, McpServerConfig>;  // MCP server configs
  hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;  // Event hooks
}
```

## 📦 Tool Definitions (Available)

```typescript
import {
  CEREBELLAR_STUDY_EXTRACTION_TOOL,
  METHODS_EXTRACTION_TOOL,
  RESULTS_EXTRACTION_TOOL,
  CITATION_EXTRACTION_TOOL
} from './utils/structured-extraction';
```

## 💡 Common Patterns

### Pattern 1: Basic Extraction
```typescript
const result = await extractMethodsSectionWithAgent(text);
console.log(result);
```

### Pattern 2: With Verbose Logging
```typescript
const result = await extractMethodsSectionWithAgent(text, {
  verbose: true
});
```

### Pattern 3: With Budget Control
```typescript
const result = await extractMethodsSectionWithAgent(text, {
  agentOptions: {
    maxBudgetUsd: 0.25  // Stop if cost exceeds $0.25
  }
});
```

### Pattern 4: Full PDF Extraction with Citations
```typescript
const result = await performStructuredExtractionWithAgent({
  documentContent: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
  prompt: 'Extract all study data',
  tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
  enableCitations: true,
  verbose: true
});

// Display citation sources
if (result.displaySources) {
  result.displaySources();
}
```

### Pattern 5: With MCP Server
```typescript
const result = await extractMethodsSectionWithAgent(text, {
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

### Pattern 6: Error Handling
```typescript
try {
  const result = await extractMethodsSectionWithAgent(text, {
    agentOptions: { maxBudgetUsd: 0.10 }
  });
  console.log(result);
} catch (error) {
  if (error instanceof Error) {
    console.error('Extraction failed:', error.message);
  }
}
```

## 🎯 Return Value Structure

```typescript
{
  data: T,                    // Extracted structured data
  citations?: any[],          // Array of citations (if enableCitations=true)
  rawMessages: SDKMessage[],  // All SDK messages for debugging
  displaySources?: () => void // Function to display citation sources
}
```

## 🔍 Debugging

### View All Messages
```typescript
const result = await extractMethodsSectionWithAgent(text);
console.log('Message types:', result.rawMessages.map(m => m.type));
```

### Enable Verbose Output
```typescript
const result = await extractMethodsSectionWithAgent(text, {
  verbose: true  // Logs detailed extraction steps
});
```

## ⚠️ Common Mistakes

### ❌ Don't: Pass Anthropic client
```typescript
const client = new Anthropic({ apiKey: '...' });
await extractMethodsSectionWithAgent(client, text);  // Wrong!
```

### ✅ Do: Just pass the text
```typescript
await extractMethodsSectionWithAgent(text);  // Correct!
```

### ❌ Don't: Put options at wrong level
```typescript
await performStructuredExtractionWithAgent({
  documentContent: pdf,
  prompt: 'Extract',
  tool: TOOL,
  maxBudgetUsd: 0.50  // Wrong level!
});
```

### ✅ Do: Nest in agentOptions
```typescript
await performStructuredExtractionWithAgent({
  documentContent: pdf,
  prompt: 'Extract',
  tool: TOOL,
  agentOptions: {
    maxBudgetUsd: 0.50  // Correct!
  }
});
```

## 🔄 Migration from Legacy

| From (Legacy) | To (Agent SDK) |
|---------------|----------------|
| `performStructuredExtraction({ client, ... })` | `performStructuredExtractionWithAgent({ ... })` |
| `extractMethodsSection(client, text)` | `extractMethodsSectionWithAgent(text)` |
| `extractResultsSection(client, text)` | `extractResultsSectionWithAgent(text)` |
| `extractCitationsStructured(client, text)` | `extractCitationsStructuredWithAgent(text)` |

**Key Change**: Remove `client` parameter!

## 📚 Documentation

- **REFACTOR_SUMMARY.md** - Technical implementation details
- **MIGRATION_GUIDE.md** - Complete migration guide with examples
- **examples/agent-sdk-extraction-example.ts** - 6 working examples

## 🆘 Need Help?

1. Check `MIGRATION_GUIDE.md` for detailed comparisons
2. Review `examples/agent-sdk-extraction-example.ts` for code samples
3. Read `REFACTOR_SUMMARY.md` for implementation details
4. Consult Agent SDK docs: https://github.com/anthropics/claude-agent-sdk

---

**Version**: 1.0.0 | **Date**: November 24, 2025
