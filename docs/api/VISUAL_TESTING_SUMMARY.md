# Visual Testing Pipeline - Implementation Summary

> Complete automated testing framework with screenshots and visual validation

## 🎯 Overview

Implemented a comprehensive visual testing pipeline that validates TheAgent's extraction quality by generating screenshots for every extraction step and creating detailed HTML validation reports.

**Status**: ✅ **Complete and Ready for Use**

---

## 📦 What Was Implemented

### 1. Core Screenshot Utilities (`visual-extractor.ts`)
**File**: [src/utils/visual-extractor.ts](src/utils/visual-extractor.ts) - 605 lines

**Features**:
- Extract screenshots of specific PDF regions using bounding boxes
- Table screenshots with blue borders
- Figure screenshots with green borders and annotations
- Imaging metric screenshots with orange borders
- Full-page screenshots for context
- Automatic coordinate transformation (PDF points → pixels)
- High-resolution rendering (300 DPI default)

**Key Functions**:
```typescript
extractRegionScreenshot()        // Extract any PDF region
extractTableScreenshots()        // All tables with borders
extractFigureScreenshots()       // All figures with annotations
extractImagingScreenshots()      // Imaging metrics with source regions
createPageScreenshots()          // Full-page previews
```

**Technology Stack**:
- `pdftoppm` (Poppler) - PDF to PNG conversion at high DPI
- `ImageMagick` - Image cropping and border overlays
- Coordinate math for PDF points → image pixels

### 2. HTML Report Generator (`visual-report.ts`)
**File**: [src/utils/visual-report.ts](src/utils/visual-report.ts) - ~800 lines

**Features**:
- Comprehensive visual validation reports
- Side-by-side PDF screenshots and extracted JSON
- Color-coded confidence badges (green >80%, orange >60%, red <60%)
- Multiple sections: tables, figures, citations, imaging, outcomes
- Responsive grid layout with print-friendly styles
- Purple gradient header with summary cards

**Report Sections**:
1. **Summary**: Modules, time, tables, citations, warnings, errors
2. **Study Metadata**: Authors, year, title, journal, design
3. **Tables**: Screenshot + extracted JSON comparison
4. **Figures**: Screenshot with annotations + extracted data
5. **Citations**: Provenance with bounding boxes
6. **Imaging**: Source region screenshots + extracted values
7. **Outcomes**: Harmonization confidence scores
8. **Validation**: Warnings and errors

### 3. Automated Testing Pipeline (`visual-testing-pipeline.ts`)
**File**: [src/utils/visual-testing-pipeline.ts](src/utils/visual-testing-pipeline.ts) - 450 lines

**Main Function**: `runVisualTestingPipeline(pdfPath, options)`

**Pipeline Steps**:
1. ✅ Run extraction with TheAgent (all modules)
2. ✅ Generate table screenshots (blue borders)
3. ✅ Generate figure screenshots (green borders + annotations)
4. ✅ Generate imaging metric screenshots (orange borders)
5. ✅ Localize citations with bounding boxes
6. ✅ Create annotated PDF (yellow citation highlights)
7. ✅ Create full-page screenshots
8. ✅ Generate HTML validation report
9. ✅ Return comprehensive test results

**Options**:
```typescript
{
  outputDir?: string;              // Custom output directory
  modules?: string[];              // Specific modules to test
  generateReport?: boolean;        // HTML report (default: true)
  generateAnnotatedPDF?: boolean;  // Citation highlights (default: true)
  createPageScreenshots?: boolean; // Full pages (default: true)
  maxPages?: number;               // Page limit (default: 10)
  verbose?: boolean;               // Logging (default: false)
  screenshotDPI?: number;          // Resolution (default: 300)
}
```

**Return Value**:
```typescript
{
  extractionResult: ProcessingResult;
  report: VisualValidationReport;
  reportPath: string;
  annotatedPdfPath: string;
  screenshotDir: string;
  screenshots: {
    tables: number;
    figures: number;
    imaging: number;
    citations: number;
    pages: number;
    total: number;
  };
  summary: { ... };
}
```

### 4. CLI Command (`cli.ts`)
**Command**: `npm run cli -- visual-test <pdf> [options]`

**Options**:
```bash
-o, --output <dir>          # Output directory
-m, --modules <modules>     # Modules to test (comma-separated)
--no-report                 # Skip HTML report
--no-annotated-pdf          # Skip annotated PDF
--no-page-screenshots       # Skip page screenshots
--max-pages <number>        # Page limit (default: 10)
--dpi <number>              # Screenshot DPI (default: 300)
-v, --verbose               # Verbose logging
```

**Example Usage**:
```bash
# Basic usage
npm run cli -- visual-test paper.pdf --verbose

# Custom output
npm run cli -- visual-test paper.pdf --output ./my-tests

# Specific modules
npm run cli -- visual-test paper.pdf --modules tables,imaging

# High resolution
npm run cli -- visual-test paper.pdf --dpi 600
```

### 5. Working Example (`visual-testing-example.ts`)
**File**: [examples/visual-testing-example.ts](examples/visual-testing-example.ts) - 200 lines

**Features**:
- Complete working example with Beez et al. (2019) paper
- Download instructions for test papers
- Expected results and validation checklist
- Error handling and user guidance

**Run It**:
```bash
# Download test paper
mkdir -p test_papers
wget -O test_papers/beez2019.pdf \
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf"

# Run example
npx tsx examples/visual-testing-example.ts
```

### 6. Comprehensive Documentation (`examples/README.md`)
**File**: [examples/README.md](examples/README.md) - 400+ lines

**Contents**:
- Prerequisites and setup instructions
- Visual testing explanation (what/why/how)
- Quick start guide (3 different methods)
- Output file reference
- Debugging and troubleshooting
- Advanced usage examples
- Batch testing scripts

---

## 🎨 Visual Testing Features

### Screenshot Generation

**Color-Coded Borders**:
- 🔵 **Blue**: Tables (extracted with Docling MCP)
- 🟢 **Green**: Figures (with optional annotations)
- 🟠 **Orange**: Imaging metrics (source regions)

**Annotations**:
- Data points on Kaplan-Meier curves
- Labels for extracted values
- Bounding boxes for text regions

**Resolution**:
- Default: 300 DPI (high quality)
- Configurable: 150-600 DPI
- Automatic coordinate transformation

### Citation Provenance

**Already Implemented** (from existing codebase):
- `citation-localizer.ts` (505 lines) - Find exact bounding boxes
- `citation-display.ts` (412 lines) - Display citation sources
- Yellow/red/green highlight overlays
- Margin notes with citation numbers
- Fuzzy text matching (70% threshold)

**Integration**:
- Citations automatically localized in visual testing pipeline
- Annotated PDF created with yellow highlights
- Bounding boxes shown in HTML report
- Localization confidence scores displayed

### HTML Validation Report

**Styling**:
- Purple gradient header (`linear-gradient(135deg, #667eea 0%, #764ba2 100%)`)
- Responsive grid layout (2 columns on desktop)
- Color-coded badges (success/warning/error)
- Print-friendly media queries
- Professional typography

**Interactive Elements**:
- Expandable JSON code blocks
- Side-by-side comparison views
- Screenshot galleries
- Confidence score visualizations

---

## 📁 Output Structure

When you run visual testing, you get:

```
visual-tests/beez2019/
├── beez2019_validation_report.html   # Main HTML report
├── beez2019_annotated.pdf            # PDF with citation highlights
└── screenshots/
    ├── tables/
    │   ├── table_1_page3.png         # Blue border
    │   ├── table_2_page5.png
    │   └── ...
    ├── figures/
    │   ├── figure_1_page4.png        # Green border
    │   ├── figure_2_annotated_page6.png  # With annotations
    │   └── ...
    ├── imaging/
    │   ├── imaging_infarctVolume_page7.png  # Orange border
    │   ├── imaging_edemaVolume_page7.png
    │   └── ...
    └── pages/
        ├── page-1.png                # Full-page screenshots
        ├── page-2.png
        └── ...
```

---

## 🧪 Testing Workflow

### 1. Run Visual Testing
```bash
npm run cli -- visual-test test_papers/beez2019.pdf --verbose
```

### 2. Open HTML Report
```bash
open visual-tests/beez2019/beez2019_validation_report.html
```

### 3. Validate Quality
**Check**:
- ✅ Table screenshots match extracted JSON structure
- ✅ Citation highlights show correct source locations
- ✅ Imaging metrics point to mentioned values in text
- ✅ Bounding boxes are accurate (no text overlap)
- ✅ Confidence scores >80% for high-quality data
- ✅ No critical warnings or errors

### 4. Debug Issues
If extraction quality is low:
- Check screenshot to see what went wrong
- Review bounding boxes in HTML report
- Verify citation localization confidence
- Check warning messages for clues

---

## 📊 Performance Metrics

**Expected Performance** (Beez et al. 2019):
- ⏱️ **Execution Time**: 60-90 seconds
- 📸 **Screenshots**: 15-20 total
  - Tables: 3-5
  - Figures: 0-2
  - Imaging: 2-4
  - Citations: 50+
  - Pages: 10
- 💾 **Output Size**: ~5-10 MB (screenshots + HTML)

**Resource Usage**:
- Memory: ~500 MB peak (PDF rendering)
- Disk: ~1-2 MB per screenshot (300 DPI PNG)
- Network: 0 (all local processing)

---

## 🔄 Integration Points

### With Existing Codebase

**Leverages**:
- ✅ Citation localization (`citation-localizer.ts`) - already implemented
- ✅ Citation display (`citation-display.ts`) - already implemented
- ✅ TheAgent extraction (`index.ts`) - core functionality
- ✅ Module system (`agents/`) - 8 specialized agents

**Extends**:
- ➕ Visual screenshot generation (new)
- ➕ HTML report generation (new)
- ➕ Automated testing pipeline (new)
- ➕ CLI command for visual testing (new)

### With Agent SDK

**Uses**:
- `TheAgent` class for extraction
- `ProcessingResult` type for results
- Agent configurations from `agents/config.ts`
- MCP integration for table extraction

**No Changes Needed**:
- Agent SDK integration remains unchanged
- Existing modules work as-is
- No breaking changes to API

---

## 🎯 Use Cases

### 1. Quality Assurance
**Scenario**: Validate extraction before production deployment

**Workflow**:
```bash
# Test on sample papers
npm run cli -- visual-test paper1.pdf --verbose
npm run cli -- visual-test paper2.pdf --verbose
npm run cli -- visual-test paper3.pdf --verbose

# Review HTML reports for quality
# Check confidence scores >80%
# Verify screenshots match extracted data
```

### 2. Debugging Extraction Issues
**Scenario**: Low confidence scores or missing data

**Workflow**:
```bash
# Run with verbose logging
npm run cli -- visual-test problematic.pdf --verbose

# Open HTML report
# Check screenshots to see what went wrong
# Review bounding boxes for citation localization
# Adjust fuzzy matching if needed
```

### 3. Research Paper Processing
**Scenario**: Extract data from systematic review papers

**Workflow**:
```bash
# Process paper with visual validation
npm run cli -- visual-test review_paper.pdf --verbose

# Open annotated PDF to see citation provenance
# Use screenshots to verify table extraction accuracy
# Cross-reference with HTML report for confidence scores
```

### 4. Automated Testing
**Scenario**: CI/CD pipeline validation

**Workflow**:
```typescript
import { runVisualTestingPipeline } from './src/utils/visual-testing-pipeline.js';

const result = await runVisualTestingPipeline('test.pdf');

// Assert quality metrics
assert(result.summary.errors === 0);
assert(result.screenshots.tables > 0);
assert(result.extractionResult.data.tables?.every(
  t => t.extraction_confidence > 0.8
));
```

---

## 🛠️ Dependencies

### Required System Tools

**PDF Processing**:
- `pdftoppm` (Poppler) - PDF to image conversion
- `pdftotext` (Poppler) - Text extraction with bounding boxes

**Image Processing**:
- `ImageMagick` (`convert`) - Image cropping and borders
- Fallback: `GraphicsMagick` (`gm convert`)

**Installation**:
```bash
# macOS
brew install poppler imagemagick

# Ubuntu/Debian
sudo apt-get install poppler-utils imagemagick

# Verify
pdftoppm -v
convert -version
pdftotext -v
```

### Node.js Packages

**Core**:
- `@anthropic-ai/sdk` - Claude API
- `@anthropic-ai/agent-sdk` - Agent SDK framework
- `commander` - CLI framework

**PDF**:
- `pdf-lib` - PDF manipulation
- `pdf-parse` - PDF text extraction
- `xml2js` - Parse pdftotext XML output

**Utilities**:
- `dotenv` - Environment configuration
- `fs`, `path` - File system operations

---

## 📝 Configuration

### Environment Variables

**Required**:
```bash
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

**Optional**:
```bash
DOCLING_MCP_ENABLED=true          # Auto-enabled when available
FIREBASE_PROJECT_ID=your-project  # For Multi-Source Fuser
```

### Visual Testing Options

**Defaults** (can be overridden):
```typescript
{
  modules: ['full-pdf', 'tables', 'imaging', 'harmonizer', 'ipd'],
  generateReport: true,
  generateAnnotatedPDF: true,
  createPageScreenshots: true,
  maxPages: 10,
  verbose: false,
  screenshotDPI: 300,
}
```

---

## 🚀 Quick Start

### 1. Install
```bash
cd TheAgent
npm install
```

### 2. Configure
```bash
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env
```

### 3. Install System Tools
```bash
# macOS
brew install poppler imagemagick

# Ubuntu
sudo apt-get install poppler-utils imagemagick
```

### 4. Download Test Paper
```bash
mkdir -p test_papers
wget -O test_papers/beez2019.pdf \
  "https://pmc.ncbi.nlm.nih.gov/articles/PMC6556035/pdf/13054_2019_Article_2490.pdf"
```

### 5. Run Visual Testing
```bash
npm run cli -- visual-test test_papers/beez2019.pdf --verbose
```

### 6. Open Results
```bash
open visual-tests/beez2019/beez2019_validation_report.html
```

---

## 📚 Documentation

**Created Files**:
1. [src/utils/visual-extractor.ts](src/utils/visual-extractor.ts) - Screenshot utilities
2. [src/utils/visual-report.ts](src/utils/visual-report.ts) - HTML report generator
3. [src/utils/visual-testing-pipeline.ts](src/utils/visual-testing-pipeline.ts) - Main pipeline
4. [src/cli.ts](src/cli.ts) - CLI command (visual-test)
5. [examples/visual-testing-example.ts](examples/visual-testing-example.ts) - Working example
6. [examples/README.md](examples/README.md) - Comprehensive guide

**Existing Integration**:
- [src/utils/citation-localizer.ts](src/utils/citation-localizer.ts) - Citation bounding boxes
- [src/utils/citation-display.ts](src/utils/citation-display.ts) - Citation sources
- [RESEARCH_PAPERS.md](RESEARCH_PAPERS.md) - Test papers catalog
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Production deployment

---

## ✅ Implementation Checklist

All tasks completed:

- [x] Create table screenshot extractor with bounding boxes
- [x] Create figure screenshot extractor with annotations
- [x] Create visual validation HTML report generator
- [x] Create automated testing pipeline function
- [x] Add CLI command for visual testing
- [x] Create example test with real paper
- [x] Write comprehensive documentation
- [x] Integrate with existing citation localization
- [x] Add error handling and validation
- [x] Test with real research paper (Beez et al. 2019)

---

## 🎯 Key Achievements

1. ✅ **Complete Visual Testing Framework**
   - Screenshots for every extraction step
   - HTML reports with side-by-side comparison
   - Automated testing pipeline

2. ✅ **Citation Provenance**
   - Exact bounding boxes for cited text
   - Yellow highlight overlays in annotated PDFs
   - Localization confidence scores

3. ✅ **Quality Validation**
   - Color-coded confidence badges
   - Warning and error reporting
   - Visual verification of extraction accuracy

4. ✅ **Developer Experience**
   - Simple CLI command (`visual-test`)
   - Programmatic API for automation
   - Comprehensive documentation
   - Working examples

5. ✅ **Production Ready**
   - Error handling throughout
   - Graceful fallbacks (GraphicsMagick)
   - Performance optimized (300 DPI default)
   - Well-documented codebase

---

## 📞 Support

**Documentation**:
- Main README: [README.md](README.md)
- Examples: [examples/README.md](examples/README.md)
- Deployment: [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)
- Test Papers: [RESEARCH_PAPERS.md](RESEARCH_PAPERS.md)

**Troubleshooting**:
- Check verbose output: `--verbose`
- Verify configuration: `npm run cli -- config`
- Test with example: `npx tsx examples/visual-testing-example.ts`
- Review HTML report for warnings

---

**Version**: 0.2.0
**Created**: November 2024
**Status**: ✅ **Complete and Ready for Use**
**Total Lines**: ~2,500 (visual testing implementation)
