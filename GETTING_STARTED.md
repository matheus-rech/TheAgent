# Getting Started with TheAgent

Welcome! TheAgent is now set up and ready for implementation. This guide will walk you through the next steps.

## ✅ What's Been Created

Your project structure:

```
TheAgent/
├── src/
│   ├── index.ts                    # Main orchestrator
│   ├── cli.ts                      # Command-line interface
│   ├── types/index.ts              # TypeScript types
│   ├── modules/                    # 6 extraction modules
│   │   ├── base.ts
│   │   ├── full-pdf-extractor.ts
│   │   ├── table-figure-extractor.ts
│   │   ├── imaging-extractor.ts
│   │   ├── outcome-harmonizer.ts
│   │   ├── ipd-reconstructor.ts
│   │   └── multi-source-fuser.ts
│   └── utils/
│       └── pdf-operations.ts       # PDF skill capabilities
├── examples/
│   └── complete-workflow.ts        # Full usage example
├── tests/                          # Test directory (empty)
├── package.json                    # Dependencies configured
├── tsconfig.json                   # TypeScript config
├── tsup.config.ts                  # Build config
├── .env.example                    # Environment template
├── .gitignore
├── README.md                       # Main documentation
├── DOCLING_SETUP.md               # Docling MCP guide
└── GETTING_STARTED.md             # This file
```

## 🚀 Quick Setup (5 minutes)

### Step 1: Install Dependencies

```bash
cd TheAgent
npm install
```

This will install:
- `@anthropic-ai/claude-agent-sdk` - Latest version
- `pdf-parse`, `pdf-lib` - PDF processing
- `commander` - CLI framework
- TypeScript, tsup, vitest - Development tools

### Step 2: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```env
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Get from https://console.anthropic.com/
```

### Step 3: Test the Setup

```bash
# Check configuration
npm run cli -- config

# Should show:
#   ANTHROPIC_API_KEY: ✅ Set
#   Docling MCP: ⚠️  Disabled (optional)
```

### Step 4: Try the CLI

```bash
# List available modules
npm run cli -- modules

# Process a PDF (will fail until TODOs are implemented)
npm run cli -- process path/to/paper.pdf
```

## 📋 Implementation Roadmap

Your modules are **architected and ready**, but need implementation of the AI/extraction logic. Here's the recommended order:

### Phase 1: Core Extraction (Week 1)

**Priority: Full-PDF Deep Extractor**

File: `src/modules/full-pdf-extractor.ts`

TODOs to implement:
- [ ] Line 70: `extractMethods()` - Use Claude Agent SDK to extract structured methods data
- [ ] Line 95: `extractResults()` - Extract results section data
- [ ] Line 108: `extractDiscussion()` - Extract discussion insights

Why start here? This provides foundational data for all other modules.

**Implementation example:**

```typescript
// In extractMethods()
private async extractMethods(methodsText?: string, options?: ExtractionOptions): Promise<MethodsData | undefined> {
  if (!methodsText) return undefined;

  // Use Claude Agent SDK
  const { Agent } = await import('@anthropic-ai/claude-agent-sdk');

  const agent = new Agent({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: options?.model || 'claude-sonnet-4-5-20250929',
  });

  const prompt = `Extract structured methods data from this text:

${methodsText}

Return JSON with:
- study_type: (RCT, cohort, case series, etc.)
- setting: (hospital, multicenter, etc.)
- participants: (inclusion/exclusion)
- interventions: (treatment details)
- outcomes_measured: (list of outcomes)
- statistical_analysis: (methods used)`;

  const response = await agent.query(prompt, {
    temperature: 0,
    maxTokens: 2048,
  });

  return JSON.parse(response.text);
}
```

### Phase 2: Table Extraction (Week 2)

**Priority: Table & Figure Extractor + Docling MCP**

Files:
- `src/modules/table-figure-extractor.ts`
- See `DOCLING_SETUP.md` for integration guide

TODOs:
- [ ] Line 47: `extractWithDocling()` - Implement Docling MCP client
- [ ] Line 88: `extractWithVision()` - Implement Claude vision fallback
- [ ] Line 108: `extractFigures()` - Extract and classify figures
- [ ] Line 123: `parseDoclingTable()` - Parse Docling JSON to TableData

### Phase 3: Specialized Extractors (Week 3)

**Imaging Metrics Extractor** (`src/modules/imaging-extractor.ts`):
- Already has pattern matching implemented ✅
- [ ] Line 62: Enhance with Claude for context-aware extraction

**Outcome Harmonizer** (`src/modules/outcome-harmonizer.ts`):
- [ ] Line 90: Implement timepoint mapping logic
- [ ] Line 200: Implement mRS distribution parsing

**IPD Reconstructor** (`src/modules/ipd-reconstructor.ts`):
- [ ] Line 85: Implement Kaplan-Meier digitization (Guyot algorithm)
- [ ] Line 140: Implement aggregate imputation

### Phase 4: Integration (Week 4)

**Multi-Source Fuser** - Already fully implemented ✅

**Testing & Refinement:**
- Write tests in `tests/` directory
- Test with real cerebellar stroke papers
- Compare results with manual extraction
- Tune confidence thresholds

## 🎯 Your First Implementation Task

**Start here:** Implement the Full-PDF Deep Extractor

1. Open `src/modules/full-pdf-extractor.ts`

2. Find the first TODO (line ~70):

```typescript
/**
 * Extract structured methods data using Claude
 *
 * TODO: Integrate with Claude Agent SDK for structured extraction
 * ...
 */
private async extractMethods(methodsText?: string, options?: ExtractionOptions): Promise<MethodsData | undefined>
```

3. Implement using the example code above

4. Test:

```bash
# Create a test file
cat > test.ts << 'EOF'
import { FullPdfExtractor } from './src/modules/full-pdf-extractor.js';

const extractor = new FullPdfExtractor();
const result = await extractor.process({ pdfPath: 'paper.pdf' });
console.log(result);
EOF

npm run dev test.ts
```

5. Iterate until it works!

## 🔧 Development Workflow

```bash
# Development mode (auto-reload)
npm run dev

# Type checking (run before committing)
npm run typecheck

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## 📊 Testing Your Modules

Create test files in `tests/`:

```typescript
// tests/full-pdf-extractor.test.ts
import { describe, it, expect } from 'vitest';
import { FullPdfExtractor } from '../src/modules/full-pdf-extractor';

describe('FullPdfExtractor', () => {
  it('should extract methods section', async () => {
    const extractor = new FullPdfExtractor();
    const result = await extractor.process({ pdfPath: 'fixtures/sample.pdf' });

    expect(result.methods).toBeDefined();
    expect(result.methods?.study_type).toBeTruthy();
  });
});
```

Run tests:

```bash
npm test
```

## 🔗 Integration with cerebellar-extraction

Once modules are implemented, integrate with your web app:

### Option 1: Batch Processing Script

```typescript
// scripts/batch-process.ts
import { TheAgent } from './src/index.js';
import { readdirSync } from 'fs';

const pdfDir = '../pdfs/';
const agent = new TheAgent({ verbose: true });

const pdfs = readdirSync(pdfDir).filter(f => f.endsWith('.pdf'));

for (const pdf of pdfs) {
  console.log(`Processing ${pdf}...`);
  const result = await agent.processPaper(`${pdfDir}/${pdf}`);

  // Save to Firebase
  await uploadToFirebase(result.data);
}
```

### Option 2: Backend API

```typescript
// api/extract.ts (Next.js API route example)
import { TheAgent } from 'theagent';

export default async function handler(req, res) {
  const { pdfUrl } = req.body;

  // Download PDF
  const pdfPath = await downloadPdf(pdfUrl);

  // Extract
  const agent = new TheAgent();
  const result = await agent.processPaper(pdfPath);

  // Return
  res.json(result.data);
}
```

### Option 3: Claude Desktop Extension (Advanced)

Convert TheAgent to an MCP server for use in Claude Desktop.

## 📚 Resources

### Documentation
- [Claude Agent SDK Docs](https://docs.claude.com/en/api/agent-sdk/typescript)
- [PDF Operations Reference](./README.md#module-details)
- [Docling MCP Setup](./DOCLING_SETUP.md)

### Example Code
- [Complete Workflow](./examples/complete-workflow.ts)
- [CLI Implementation](./src/cli.ts)
- [Module Architecture](./src/modules/base.ts)

### Medical Research
- [Guyot IPD Reconstruction](https://bmcmedresmethodol.biomedcentral.com/articles/10.1186/1471-2288-12-9)
- [Newcastle-Ottawa Scale](https://www.ohri.ca/programs/clinical_epidemiology/oxford.asp)
- [PRISMA 2020](http://www.prisma-statement.org/)

## 💡 Tips for Success

1. **Start simple:** Get one module working end-to-end before adding complexity

2. **Use real papers:** Test with actual cerebellar stroke papers from your systematic review

3. **Validate outputs:** Compare TheAgent results with manual extraction

4. **Iterate on prompts:** The TODO sections are starting points - refine prompts based on your results

5. **Leverage Claude:** Use Claude Desktop to help implement the TODO sections!

6. **Ask for help:** If stuck, reference the documentation or ask in the community

## 🐛 Troubleshooting

### "Cannot find module '@anthropic-ai/claude-agent-sdk'"

```bash
npm install
# or
rm -rf node_modules package-lock.json
npm install
```

### "ANTHROPIC_API_KEY is not set"

```bash
# Check your .env file
cat .env

# Should contain:
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### TypeScript errors

```bash
# Run type checking
npm run typecheck

# Common fixes:
# - Add missing imports
# - Check interface definitions
# - Ensure all required fields are provided
```

### Module extraction fails

1. Check the PDF is readable: `npm run cli -- config`
2. Enable verbose logging: `npm run cli -- process paper.pdf --verbose`
3. Check the TODO implementation in the module
4. Verify API key has sufficient quota

## ✅ Next Steps

1. **Install dependencies:** `npm install`
2. **Configure API key:** Edit `.env`
3. **Implement first TODO:** Start with Full-PDF Extractor
4. **Test with real paper:** Use a cerebellar stroke paper from your review
5. **Iterate and refine:** Improve based on results

**You're ready to build! 🚀**

Questions? Check the README.md or DOCLING_SETUP.md for more details.
