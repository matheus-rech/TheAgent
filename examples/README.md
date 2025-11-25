# TheAgent Examples

Practical examples demonstrating TheAgent's capabilities with visual validation.

## 📋 Prerequisites

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure API Key
```bash
# Copy example env file
cp .env.example .env

# Edit .env and add your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" >> .env
```

### 3. Install Docling MCP (Optional but Recommended)
```bash
# Install uv package manager
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install Docling MCP server
uvx --from=docling-mcp docling-mcp-server --help
```

### 4. Download Test Papers
```bash
# Create test papers directory
mkdir -p test_papers
cd test_papers

# Download Beez et al. (2019) - Primary test paper
wget -O beez2019.pdf "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf"

# Or use curl
curl -L "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf" -o beez2019.pdf
```

---

## 🧪 Visual Testing Pipeline

### What is Visual Testing?

The visual testing pipeline validates TheAgent's extraction by:
1. **Extracting data** from PDF (tables, figures, imaging, citations)
2. **Creating screenshots** showing exactly where each piece of data came from
3. **Generating HTML report** with side-by-side comparison of PDFs and extracted JSON
4. **Highlighting citations** with yellow overlays showing exact source locations

This enables:
- ✅ Visual quality assurance
- ✅ Provenance tracking
- ✅ Debugging extraction issues
- ✅ Validation of accuracy

### Quick Start

#### Option 1: Use CLI (Recommended)
```bash
# Run visual testing on a paper
npm run cli -- visual-test test_papers/beez2019.pdf --verbose

# Custom output directory
npm run cli -- visual-test test_papers/beez2019.pdf \
  --output ./my-tests \
  --verbose

# Specific modules only
npm run cli -- visual-test test_papers/beez2019.pdf \
  --modules tables,imaging \
  --verbose

# High-resolution screenshots
npm run cli -- visual-test test_papers/beez2019.pdf \
  --dpi 600 \
  --verbose
```

#### Option 2: Run Example Script
```bash
# TypeScript execution
npx tsx examples/visual-testing-example.ts

# Or compile and run
npm run build
node dist/examples/visual-testing-example.js
```

#### Option 3: Programmatic API
```typescript
import { runVisualTestingPipeline } from './src/utils/visual-testing-pipeline.js';

const result = await runVisualTestingPipeline('paper.pdf', {
  verbose: true,
  generateReport: true,
  generateAnnotatedPDF: true,
});

console.log(`Report: ${result.reportPath}`);
console.log(`Screenshots: ${result.screenshots.total}`);
```

---

## 📊 What Gets Generated

### 1. Screenshots Directory
```
visual-tests/beez2019/screenshots/
├── tables/
│   ├── table_1_page3.png          # Table 1 with blue border
│   ├── table_2_page5.png          # Table 2 with blue border
│   └── ...
├── figures/
│   ├── figure_1_page4.png         # Figure 1 with green border
│   ├── figure_2_annotated_page6.png  # With data point annotations
│   └── ...
├── imaging/
│   ├── imaging_infarctVolume_page7.png  # Orange border
│   ├── imaging_edemaVolume_page7.png
│   └── ...
└── pages/
    ├── page-1.png                 # Full-page screenshot
    ├── page-2.png
    └── ...
```

### 2. HTML Validation Report
**File**: `beez2019_validation_report.html`

**Contents**:
- Summary cards (modules, time, tables, citations, warnings/errors)
- Study metadata section
- **Tables section**: Side-by-side PDF screenshot + extracted JSON
- **Figures section**: Screenshot with annotations + extracted data
- **Citations section**: Provenance with bounding boxes
- **Imaging section**: Source region screenshots + extracted values
- **Outcomes section**: Harmonization confidence scores
- Warnings/errors for quality validation

### 3. Annotated PDF
**File**: `beez2019_annotated.pdf`

**Features**:
- Yellow highlights on cited text
- Margin notes with citation numbers [1], [2], etc.
- Exact bounding boxes showing source locations
- Same content as original, just with visual overlays

---

## 🎯 Example: Testing Beez et al. (2019)

### Paper Details
- **Title**: Decompressive craniectomy for acute ischemic stroke
- **Authors**: Beez T, Munoz-Bendix C, Steiger HJ, Beseoglu K
- **Journal**: Critical Care, 2019; Volume 23, Article 209
- **DOI**: [10.1186/s13054-019-2490-x](https://doi.org/10.1186/s13054-019-2490-x)
- **PDF**: [Download from PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/)

### Why This Paper?
- ✅ Open access (free PDF download)
- ✅ Comprehensive review of decompressive craniectomy
- ✅ Contains multiple tables with outcome data
- ✅ Extensive citations (50+ references)
- ✅ Multiple outcomes reported (mortality, mRS, GOS)

### Expected Results
```
📊 Modules: full-pdf, tables, imaging, harmonizer
📸 Screenshots: ~15-20 total
   - Tables: 3-5 (outcome tables)
   - Figures: 0-2 (flow diagrams)
   - Imaging: 2-4 (volume metrics mentioned)
   - Citations: 50+ (extensive references)
   - Pages: 10 (first 10 pages)

⏱️  Execution Time: ~60-90 seconds
```

### Validation Checklist
After running visual testing, verify:

- [ ] **Tables**: Screenshot shows table exactly as in PDF
- [ ] **Extracted JSON**: Matches table structure (headers, rows, values)
- [ ] **Citations**: Yellow highlights match cited text
- [ ] **Imaging**: Source regions contain mentioned values
- [ ] **Bounding Boxes**: Accurate (not overlapping text)
- [ ] **Confidence Scores**: >80% for high-quality data
- [ ] **Warnings**: No critical issues
- [ ] **Report**: Opens in browser correctly

---

## 🔍 Debugging Extraction Issues

### Problem: Low Confidence Score (<60%)
**Solution**: Check screenshot to see what went wrong
```bash
# Run with verbose logging
npm run cli -- visual-test paper.pdf --verbose

# Check specific module
npm run cli -- visual-test paper.pdf --modules tables --verbose
```

### Problem: Missing Tables
**Solution**: Verify Docling MCP is enabled
```bash
# Check configuration
npm run cli -- config

# Should show:
#   🔌 MCP Servers:
#     - docling: ✅ Enabled
```

### Problem: Incorrect Bounding Boxes
**Solution**: Review citation localization confidence
- Check `locationConfidence` in HTML report
- Values <0.7 indicate text matching issues
- May need to adjust fuzzy matching threshold

### Problem: No Screenshots Generated
**Solution**: Check dependencies
```bash
# Verify pdftoppm is installed
which pdftoppm  # Should show path

# Install Poppler (macOS)
brew install poppler

# Install Poppler (Ubuntu)
sudo apt-get install poppler-utils

# Verify ImageMagick
which convert  # Should show path
brew install imagemagick  # macOS
```

---

## 📚 Additional Test Papers

See [RESEARCH_PAPERS.md](../RESEARCH_PAPERS.md) for more test cases:

1. **von Gottberg et al. (2024)** - Latest research, good imaging data
2. **Raco et al. (1992)** - Classic paper, clear outcomes
3. **Swiss Recommendations (2009)** - Guidelines, good for harmonization testing

---

## 🚀 Advanced Usage

### Batch Testing Multiple Papers
```bash
# Create batch test script
cat > batch_test.sh << 'EOF'
#!/bin/bash
for pdf in test_papers/*.pdf; do
  echo "Testing: $pdf"
  npm run cli -- visual-test "$pdf" --verbose
done
EOF

chmod +x batch_test.sh
./batch_test.sh
```

### Custom Output Structure
```typescript
import { runVisualTestingPipeline } from './src/utils/visual-testing-pipeline.js';

const result = await runVisualTestingPipeline('paper.pdf', {
  outputDir: './custom-output',
  modules: ['full-pdf', 'tables'],
  screenshotDPI: 600,  // Higher resolution
  maxPages: 20,        // More page screenshots
});
```

### Integration with Testing Framework
```typescript
import { describe, it, expect } from 'vitest';
import { runVisualTestingPipeline } from '../src/utils/visual-testing-pipeline.js';

describe('Visual Testing', () => {
  it('should extract tables with >80% confidence', async () => {
    const result = await runVisualTestingPipeline('test.pdf');

    expect(result.screenshots.tables).toBeGreaterThan(0);
    expect(result.summary.errors).toBe(0);

    // Verify confidence scores
    result.extractionResult.data.tables?.forEach(table => {
      expect(table.extraction_confidence).toBeGreaterThan(0.8);
    });
  });
});
```

---

## 📝 Output File Reference

| File | Purpose | When Created |
|------|---------|--------------|
| `*_validation_report.html` | Visual validation report | Always (unless --no-report) |
| `*_annotated.pdf` | PDF with citation highlights | Always (unless --no-annotated-pdf) |
| `screenshots/tables/*.png` | Table screenshots | If tables found |
| `screenshots/figures/*.png` | Figure screenshots | If figures found |
| `screenshots/imaging/*.png` | Imaging metric screenshots | If imaging data found |
| `screenshots/pages/*.png` | Full-page screenshots | Always (unless --no-page-screenshots) |

---

## 🛠️ Troubleshooting

### Common Issues

**1. "ANTHROPIC_API_KEY not set"**
```bash
# Check .env file exists
cat .env

# Should contain:
ANTHROPIC_API_KEY=sk-ant-...

# If missing, create it
echo "ANTHROPIC_API_KEY=your-key-here" > .env
```

**2. "pdftoppm command not found"**
```bash
# macOS
brew install poppler

# Ubuntu/Debian
sudo apt-get install poppler-utils

# Verify
pdftoppm -v
```

**3. "ImageMagick convert not found"**
```bash
# macOS
brew install imagemagick

# Ubuntu/Debian
sudo apt-get install imagemagick

# Verify
convert -version
```

**4. "Module import error"**
```bash
# Rebuild TypeScript
npm run build

# Run tests
npm test
```

---

## 📞 Support

- **Documentation**: [README.md](../README.md), [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md)
- **Test Papers**: [RESEARCH_PAPERS.md](../RESEARCH_PAPERS.md)
- **Migration Details**: [AGENT_SDK_MIGRATION.md](../AGENT_SDK_MIGRATION.md)

---

**Last Updated**: November 2024
**Version**: 0.2.0
**Status**: ✅ Ready for Testing
