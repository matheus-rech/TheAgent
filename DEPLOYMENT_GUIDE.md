# TheAgent v0.2.0 - Production Deployment Guide

> Complete guide for deploying TheAgent with Docling MCP integration

## 🎯 Overview

This guide covers production deployment of TheAgent, including:
- System requirements and dependencies
- Docling MCP server setup
- Environment configuration
- Production deployment options
- Testing and validation

---

## 📋 Prerequisites

### System Requirements

- **Node.js**: >= 18.0.0 (LTS recommended)
- **Python**: 3.9+ (for Docling MCP)
- **Memory**: 4GB+ RAM recommended
- **Storage**: 2GB+ free space

### Required Accounts

- **Anthropic API Key**: [Get one here](https://console.anthropic.com/)
- **Optional**: Firebase project (for Multi-Source Fuser storage)

---

## ⚙️ Installation

### 1. Install TheAgent Dependencies

```bash
cd /Users/matheusrech/cerebellar-extraction/TheAgent
npm install
```

### 2. Install uv Package Manager

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
source $HOME/.local/bin/env  # Add to PATH
```

### 3. Install Docling MCP Server

```bash
uvx --from=docling-mcp docling-mcp-server --help
```

This command automatically installs Docling MCP and its 116 dependencies.

---

## 🔧 Configuration

### 1. Create Environment File

```bash
cp .env.example .env
```

### 2. Configure API Keys

Edit `.env`:

```bash
# Required: Anthropic API Key
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional: Firebase (for Multi-Source Fuser)
FIREBASE_PROJECT_ID=your-project-id

# Docling MCP is auto-enabled when installed
```

### 3. Verify Configuration

```bash
npm run cli -- config
```

**Expected Output:**
```
⚙️  Configuration:

  ANTHROPIC_API_KEY: ✅ Set

  🤖 Agent SDK: ✅ Active
  Configured Agents: 8
  Agent List:
    - full-pdf-extractor (claude-sonnet-4-5-20250929)
    - methods-extractor (claude-sonnet-4-5-20250929)
    - results-extractor (claude-sonnet-4-5-20250929)
    - citation-extractor (claude-sonnet-4-5-20250929)
    - table-extractor (claude-haiku-4-5-20250929)
    - imaging-extractor (claude-sonnet-4-5-20250929)
    - outcome-harmonizer (claude-sonnet-4-5-20250929)
    - multi-source-fuser (claude-sonnet-4-5-20250929)

  🔌 MCP Servers:
    - docling: ✅ Enabled

📊 Summary:
   Total Agents: 8
   MCP Servers Available: 1
   MCP Servers Enabled: 1
```

---

## 🚀 Deployment Options

### Option 1: CLI Usage (Recommended for Research)

```bash
# Process single paper
npm run cli -- process paper.pdf

# Process with specific modules
npm run cli -- process paper.pdf --modules full-pdf,tables,imaging

# Multi-source fusion
npm run cli -- fuse main:paper.pdf supplement:supp.pdf

# View available modules
npm run cli -- modules
```

### Option 2: Programmatic API

```typescript
import { TheAgent } from './src/index.js';

// Initialize with all modules
const agent = new TheAgent({
  modules: ['full-pdf', 'tables', 'imaging', 'harmonizer', 'ipd', 'fuser'],
  verbose: true,
});

// Process paper
const result = await agent.processPaper('paper.pdf');

// Access extracted data
console.log('Study:', result.data.study_id);
console.log('Tables:', result.data.tables?.length);
console.log('Imaging:', result.data.imaging);
```

### Option 3: Docker Deployment

**Dockerfile** (create in project root):

```dockerfile
FROM node:18-alpine

# Install Python for Docling MCP
RUN apk add --no-cache python3 py3-pip curl bash

# Install uv
RUN curl -LsSf https://astral.sh/uv/install.sh | sh

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application
COPY . .

# Build TypeScript
RUN npm run build

# Expose port (if needed for API)
EXPOSE 3000

# Start CLI or API server
CMD ["npm", "run", "cli", "--", "process"]
```

**Build and run:**

```bash
docker build -t theagent:0.2.0 .
docker run -v $(pwd)/papers:/papers -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY theagent:0.2.0 process /papers/paper.pdf
```

### Option 4: Cloud Deployment (AWS Lambda)

**Serverless Framework** (`serverless.yml`):

```yaml
service: theagent

provider:
  name: aws
  runtime: nodejs18.x
  region: us-east-1
  environment:
    ANTHROPIC_API_KEY: ${env:ANTHROPIC_API_KEY}
  timeout: 900  # 15 minutes max
  memorySize: 4096  # 4GB RAM

functions:
  extractPaper:
    handler: handler.extractPaper
    events:
      - http:
          path: extract
          method: post
```

**handler.js:**

```javascript
import { TheAgent } from './src/index.js';

export const extractPaper = async (event) => {
  const { pdfUrl, modules } = JSON.parse(event.body);

  const agent = new TheAgent({ modules });
  const result = await agent.processPaper(pdfUrl);

  return {
    statusCode: 200,
    body: JSON.stringify(result)
  };
};
```

---

## 🧪 Testing

### 1. Test Single Module

```bash
npm run cli -- process test.pdf --modules imaging --verbose
```

### 2. Test Docling MCP Integration

```bash
npm run cli -- process paper-with-tables.pdf --modules tables --verbose
```

**Look for:** `extraction_method: 'docling'` in output (95% confidence)

### 3. Test Full Pipeline

```bash
npm run cli -- process paper.pdf --modules all
```

### 4. Test Multi-Source Fusion

```bash
npm run cli -- fuse main:paper.pdf supplement:supp.pdf
```

---

## 📊 Performance Optimization

### 1. Module Selection

**For speed:**
```bash
# Use only needed modules
npm run cli -- process paper.pdf --modules imaging,tables
```

**For accuracy:**
```bash
# Use all modules with Agent SDK refinement
npm run cli -- process paper.pdf --modules all
```

### 2. Model Selection

Edit `src/agents/config.ts`:

```typescript
export const AGENT_CONFIGS = {
  // Use Haiku for faster/cheaper extraction
  tableExtractor: {
    model: 'claude-haiku-4-5-20250929',  // 3-5x faster, 70% cheaper
  },

  // Use Sonnet for higher accuracy
  fullPdfExtractor: {
    model: 'claude-sonnet-4-5-20250929',  // Better accuracy
  }
};
```

### 3. Caching Strategy

**For large-scale processing:**

```typescript
// Batch processing with caching
const papers = ['paper1.pdf', 'paper2.pdf', 'paper3.pdf'];

for (const paper of papers) {
  const result = await agent.processPaper(paper);
  // Cache results to avoid re-processing
  await saveToDatabase(result);
}
```

---

## 🔐 Security Best Practices

### 1. API Key Management

**DO:**
- Store API keys in environment variables
- Use `.env` files (gitignored)
- Rotate keys regularly

**DON'T:**
- Hardcode keys in source code
- Commit `.env` to git
- Share keys in logs/outputs

### 2. Rate Limiting

```typescript
// Implement rate limiting for production
import { RateLimiter } from 'limiter';

const limiter = new RateLimiter({ tokensPerInterval: 50, interval: "minute" });

async function processWithRateLimit(paper) {
  await limiter.removeTokens(1);
  return await agent.processPaper(paper);
}
```

### 3. Error Handling

```typescript
try {
  const result = await agent.processPaper('paper.pdf');
} catch (error) {
  if (error.message.includes('rate_limit')) {
    // Implement exponential backoff
    await sleep(60000);
    return retry();
  } else if (error.message.includes('invalid_api_key')) {
    // Alert administrator
    console.error('API key invalid!');
  }
  throw error;
}
```

---

## 📈 Monitoring

### 1. Log Extraction Metrics

```typescript
const result = await agent.processPaper('paper.pdf');

console.log({
  paper: result.data.study_id,
  modules: result.modules_executed,
  time_ms: result.execution_time_ms,
  warnings: result.warnings.length,
  errors: result.errors.length,
  tables: result.data.tables?.length || 0,
  imaging_confidence: result.data.imaging?.extraction_confidence
});
```

### 2. Track Costs

**Estimated costs per paper:**
- Full-PDF extraction: ~$0.10-0.30 (Sonnet 4.5)
- Table extraction: ~$0.02-0.05 (Haiku 4.5)
- Imaging extraction: ~$0.00-0.05 (hybrid, mostly free)
- **Total**: ~$0.15-0.45 per paper

### 3. Monitor MCP Server

```bash
# Check Docling MCP health
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  uvx --from=docling-mcp docling-mcp-server --transport stdio
```

---

## 🐛 Troubleshooting

### Issue: "ANTHROPIC_API_KEY not set"

**Solution:**
```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
# Or add to .env file
```

### Issue: "Docling MCP not available"

**Solution:**
```bash
# Reinstall Docling MCP
uvx --from=docling-mcp docling-mcp-server --help

# Verify installation
which uvx  # Should show ~/.local/bin/uvx
```

### Issue: "Module import error"

**Solution:**
```bash
# Rebuild TypeScript
npm run build

# Check for type errors
npm run typecheck
```

### Issue: "Low extraction confidence"

**Solution:**
- Check PDF quality (scanned vs native)
- Use verbose mode to debug: `--verbose`
- Try different modules for cross-validation

---

## 📚 Test Papers

### Recommended Test Cases

**1. Cerebellar Stroke Papers:**
- Beez et al. (2019): "Decompressive craniectomy for acute ischemic stroke"
  - [PDF Available](https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/)
  - Good for: Full-PDF, tables, outcomes

**2. SDC Case Studies:**
- von Gottberg et al. (2024): "Suboccipital Decompressive Necrosectomy"
  - [ResearchGate](https://www.researchgate.net/publication/386128007)
  - Good for: Imaging, surgical procedures

**3. Systematic Reviews:**
- Swiss recommendations (2009)
  - [PubMed](https://pubmed.ncbi.nlm.nih.gov/19659825/)
  - Good for: Multi-source fusion, outcome harmonization

---

## 🔄 Update Strategy

### Check for Updates

```bash
# Update dependencies
npm update

# Update Docling MCP
uvx --from=docling-mcp docling-mcp-server --help
```

### Version Management

```bash
# Check current version
npm run cli -- --version  # 0.2.0

# Changelog
cat CHANGELOG.md
```

---

## 📞 Support

### Documentation

- [README.md](./README.md) - Project overview
- [AGENT_SDK_MIGRATION.md](./AGENT_SDK_MIGRATION.md) - Migration details
- [CHANGELOG.md](./CHANGELOG.md) - Version history

### Issue Reporting

If you encounter issues:

1. Check verbose output: `--verbose`
2. Verify configuration: `npm run cli -- config`
3. Test with example papers
4. Check API key quota

---

## ✅ Production Checklist

- [ ] Node.js 18+ installed
- [ ] uv and uvx installed
- [ ] Docling MCP installed
- [ ] ANTHROPIC_API_KEY configured
- [ ] Configuration verified (`npm run cli -- config`)
- [ ] Test extraction successful
- [ ] Docling MCP enabled (95% table confidence)
- [ ] Monitoring/logging implemented
- [ ] Error handling configured
- [ ] Rate limiting (if needed)
- [ ] Backup strategy for extracted data
- [ ] Cost tracking enabled

---

**Version:** 0.2.0
**Last Updated:** November 2024
**Status:** ✅ Production Ready
