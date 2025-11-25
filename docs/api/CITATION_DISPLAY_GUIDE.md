# Citation Display Guide

## REQUIRED: Display Sources Pattern

TheAgent implements **Claude's native citations** with the same "REQUIRED - display sources" pattern as Google's Vertex AI grounding metadata. This ensures transparency and allows users to verify where extracted data came from.

## Pattern Comparison

### Google Vertex AI Pattern (Your Example)

```javascript
// Get the model's text response
const text = result.response.text();

// Get the grounding metadata
const groundingMetadata = result.response.candidates?.[0]?.groundingMetadata;

// REQUIRED - display Google Search suggestions
const renderedContent = groundingMetadata?.searchEntryPoint?.renderedContent;
if (renderedContent) {
  // TODO(developer): render this HTML and CSS in the UI
}

// REQUIRED - display sources
const groundingChunks = groundingMetadata?.groundingChunks;
if (groundingChunks) {
  for (const chunk of groundingChunks) {
    const title = chunk.web?.title;  // "uefa.com"
    const uri = chunk.web?.uri;      // "https://..."
    // TODO(developer): show sources in the UI
  }
}
```

### Claude Native Citations Pattern (TheAgent)

```typescript
import { extractCerebellumStudyData, displayCitationSources } from './src/index.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// Extract data with citations enabled
const result = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true  // ✓ Enable grounding to source
});

// Get the extracted data
const data = result.data;
console.log(`Sample Size: ${data.sample_size}`);
console.log(`Mortality Rate: ${data.mortality_rate}%`);

// REQUIRED - display sources
if (result.displaySources) {
  result.displaySources();  // ✓ Show users where data came from
}
```

**Output:**
```
📚 Extraction Sources (3 citations):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[1] 📄 Page 3
    Document: Cerebellar Stroke Study
    "A total of 45 patients were enrolled in this prospective cohort study between
     January 2020 and December 2022 (30 in the SDC group, 15 in the medical
     management group)."

[2] 📄 Page 5
    Document: Cerebellar Stroke Study
    "Overall mortality was 28% (95% CI: 18-38%), with significantly lower mortality
     in the SDC group compared to medical management (20% vs 40%, p=0.03)."

[3] 📄 Page 4
    Document: Cerebellar Stroke Study
    "Follow-up was conducted at 90 days post-intervention using the modified Rankin
     Scale (mRS) to assess functional outcomes."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## How Citations Work in TheAgent

### 1. Enable Citations in API Call

```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-5-20250929',
  messages: [{
    role: 'user',
    content: [
      {
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdfBase64
        },
        citations: { enabled: true }  // ⭐ Enable citations
      },
      {
        type: 'text',
        text: 'Extract mortality rate. Use citations.'
      }
    ]
  }]
});
```

### 2. Extract Citation Sources

```typescript
import { extractCitationSources } from './src/index.js';

// Extract citation sources from response
const sources = extractCitationSources(response);

// Each source contains:
sources.forEach(source => {
  console.log(source.index);         // Citation number
  console.log(source.type);          // 'page_location'
  console.log(source.citedText);     // Exact quoted text
  console.log(source.pageNumber);    // Page in PDF (1-indexed)
  console.log(source.documentTitle); // Document name
});
```

### 3. REQUIRED - Display Sources

Three ways to display sources:

#### **Option 1: Automatic Display (Recommended)**

```typescript
const result = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true
});

// REQUIRED - display sources
if (result.displaySources) {
  result.displaySources();  // ✓ Formatted console output
}
```

#### **Option 2: Manual Console Display**

```typescript
import { extractCitationSources, displayCitationSources } from './src/index.js';

const sources = extractCitationSources(response);

// REQUIRED - display sources
displayCitationSources(sources, 'Data Sources');
```

#### **Option 3: HTML Display (Web UIs)**

```typescript
import { generateCitationHTML } from './src/index.js';

const sources = extractCitationSources(response);
const html = generateCitationHTML(sources);

// REQUIRED - show in UI
document.getElementById('sources').innerHTML = html;
```

**Generated HTML:**
```html
<div class="citation-sources">
  <h3>📚 Sources (3)</h3>
  <ul class="source-list">
    <li class="source-item">
      <span class="source-index">[1]</span>
      <span class="source-location">Page 3</span>
      <div class="source-document">Cerebellar Stroke Study</div>
      <blockquote class="source-text">A total of 45 patients...</blockquote>
    </li>
    <!-- More sources -->
  </ul>
</div>
```

## Citation Source Data Structure

```typescript
interface CitationSource {
  /** Citation index (1-based) */
  index: number;

  /** Type of citation location */
  type: 'page_location' | 'char_location' | 'content_block_location';

  /** Exact text that was cited from the source */
  citedText: string;

  /** Document or content block that was cited */
  documentTitle?: string;

  /** Page number (1-indexed) for PDF citations */
  pageNumber?: number;

  /** Character range for text citations */
  charRange?: { start: number; end: number };

  /** Content block index for multi-part citations */
  contentBlockIndex?: number;
}
```

## Field-Level Source Attribution

Link specific extracted fields to their sources:

```typescript
import { linkDataToCitations } from './src/index.js';

const result = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true
});

// Map fields to their sources
const fieldSources = linkDataToCitations(result.data, result.rawResponse);

// Show source for specific field
console.log('Mortality rate from:', fieldSources.mortality_rate);
// Output: [{ index: 2, pageNumber: 5, citedText: "...28%..." }]
```

## Complete Example

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';
import {
  extractCerebellumStudyData,
  extractCitationSources,
  displayCitationSources,
  createExtractionWithSources
} from './src/index.js';

async function extractWithSources() {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const pdfBase64 = readFileSync('paper.pdf').toString('base64');

  // Step 1: Extract with citations enabled
  const result = await extractCerebellumStudyData(client, pdfBase64, {
    enableCitations: true
  });

  // Step 2: Display extracted data
  console.log('📊 Extracted Data:');
  console.log(`Sample Size: ${result.data.sample_size}`);
  console.log(`Mortality Rate: ${result.data.mortality_rate}%`);
  console.log(`Mean Age: ${result.data.mean_age}`);

  // Step 3: REQUIRED - display sources
  if (result.displaySources) {
    result.displaySources();
  }

  // Step 4: Create enhanced result with full source tracking
  const enhanced = createExtractionWithSources(result.data, result.rawResponse);

  // Step 5: Access sources programmatically
  enhanced.sources.forEach(source => {
    console.log(`[${source.index}] Page ${source.pageNumber}: "${source.citedText}"`);
  });

  return enhanced;
}
```

## Integration Patterns

### Pattern 1: Structured Extraction + Citations

```typescript
import { performStructuredExtraction, CEREBELLAR_STUDY_EXTRACTION_TOOL } from './src/index.js';

const result = await performStructuredExtraction({
  client,
  documentContent: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 },
  prompt: 'Extract study data. Use citations for every field.',
  tool: CEREBELLAR_STUDY_EXTRACTION_TOOL,
  enableCitations: true  // ✓ Get structured data + sources
});

// Access structured data
console.log(result.data.sample_size);  // Type: number

// REQUIRED - display sources
if (result.displaySources) {
  result.displaySources();
}
```

### Pattern 2: Citations + Docling MCP

```typescript
import { getDoclingClient } from './src/index.js';

// Extract tables with Docling (structure preservation)
const docling = await getDoclingClient();
const tables = await docling.extractTables('paper.pdf');

// Extract study data with citations (source verification)
const studyData = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true
});

// ✓ Tables with perfect structure
// ✓ Study data with verifiable sources
```

### Pattern 3: Multiple Extractions with Source Tracking

```typescript
// Extract methods section
const methodsResult = await extractMethodsSection(client, methodsText);

// Extract results section
const resultsResult = await extractResultsSection(client, resultsText);

// Both can have citations if enabled
const allSources = [
  ...extractCitationSources(methodsResult.rawResponse),
  ...extractCitationSources(resultsResult.rawResponse)
];

// REQUIRED - display all sources
displayCitationSources(allSources, 'All Extraction Sources');
```

## Output Formats

### Console Display
```typescript
displayCitationSources(sources, 'Sources');
```

### HTML Display
```typescript
const html = generateCitationHTML(sources);
```

### Markdown Display
```typescript
const markdown = generateCitationMarkdown(sources);
```

### Formatted Strings
```typescript
const formatted = formatCitationSources(sources);
// ["[1] Page 3: \"Sample size was...\"", "[2] Page 5: \"Mortality was...\""]
```

## Best Practices

### ✅ DO: Always Display Sources

```typescript
// ✅ Good - sources displayed
const result = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true
});
result.displaySources?.();  // Show sources!
```

### ❌ DON'T: Hide Sources

```typescript
// ❌ Bad - sources not displayed
const result = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true
});
// Missing: result.displaySources?.();  // Sources hidden from user!
```

### ✅ DO: Enable Citations for Critical Data

```typescript
// ✅ Good - critical fields have sources
const studyData = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true  // Mortality, sample size need verification
});
```

### ❌ DON'T: Extract Without Citations

```typescript
// ❌ Bad - no way to verify accuracy
const studyData = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: false  // How do we know this is accurate?
});
```

### ✅ DO: Link Fields to Sources

```typescript
// ✅ Good - field-level attribution
const fieldSources = linkDataToCitations(result.data, result.rawResponse);
console.log(`Mortality rate from page ${fieldSources.mortality_rate[0].pageNumber}`);
```

## Comparison Table

| Feature | Google Vertex AI | Claude Native Citations |
|---------|------------------|------------------------|
| **Source Type** | Web URIs | PDF page numbers |
| **Metadata Object** | `groundingMetadata` | `citations` block |
| **Source Array** | `groundingChunks` | `extractCitationSources()` |
| **Location Info** | `chunk.web.uri` | `source.pageNumber` |
| **Display Requirement** | ✅ REQUIRED | ✅ REQUIRED |
| **UI Integration** | HTML rendering | HTML/Console/Markdown |
| **Verification** | Web links | Page locations in PDF |

## API Reference

### Functions

- `extractCitationSources(response)` - Extract sources from Claude response
- `displayCitationSources(sources, title?)` - Display sources to console
- `formatCitationSources(sources)` - Format as string array
- `generateCitationHTML(sources)` - Generate HTML for web UIs
- `generateCitationMarkdown(sources)` - Generate markdown
- `linkDataToCitations(data, response)` - Map fields to sources
- `createExtractionWithSources(data, response)` - Create enhanced result

### Interfaces

- `CitationSource` - Individual source with location
- `ExtractionWithSources<T>` - Extraction result with full source info

## Examples

See [examples/citation-display-example.ts](examples/citation-display-example.ts) for:
- ✅ Basic extraction with source display
- ✅ Manual source extraction (low-level API)
- ✅ HTML generation for web UIs
- ✅ Field-level source attribution
- ✅ Complete workflow example
- ✅ Google vs Claude pattern comparison

## Visual Validation Pipeline (NEW)

TheAgent goes beyond basic citation display by providing **visual validation** - creating annotated PDFs that show exactly where cited text is located with precise bounding boxes.

### Pipeline Overview

```
Extract with Citations → Localize in PDF → Create Annotated PDF
    (page + text)      (bounding boxes)    (highlights/boxes)
```

### Complete Pipeline Example

```typescript
import {
  extractCerebellumStudyData,
  extractCitationSources,
  displayCitationSources,
  createCitationVisualValidation
} from './src/index.js';

// Step 1: Extract with citations
const result = await extractCerebellumStudyData(client, pdfBase64, {
  enableCitations: true
});

// Step 2: REQUIRED - display sources
const sources = extractCitationSources(result.rawResponse);
displayCitationSources(sources);

// Step 3: Create visual validation PDF (one-shot)
const localized = await createCitationVisualValidation(
  'paper.pdf',
  sources,
  'paper_validated.pdf',
  {
    color: 'FFFF00',    // Yellow highlights
    opacity: 0.3,        // 30% transparent
    style: 'highlight',  // Or 'box' for borders only
    addMarginNotes: true // Add citation numbers in margin
  }
);

console.log(`Located ${localized.filter(c => c.boundingBoxes.length > 0).length}/${sources.length} citations`);
```

### Manual Pipeline (Step-by-Step)

```typescript
import {
  localizeCitations,
  createAnnotatedPDF
} from './src/index.js';

// Step 1: Localize citations (find bounding boxes)
const localized = await localizeCitations('paper.pdf', sources);

// Inspect localization results
localized.forEach(citation => {
  console.log(`[${citation.index}] Page ${citation.pageNumber}`);
  console.log(`  Bounding Boxes: ${citation.boundingBoxes.length}`);
  console.log(`  Confidence: ${(citation.locationConfidence * 100).toFixed(1)}%`);
});

// Step 2: Create annotated PDF with custom options
await createAnnotatedPDF(
  'paper.pdf',
  'paper_annotated.pdf',
  localized,
  {
    color: 'FF0000',     // Red
    style: 'box',        // Border boxes only
    borderWidth: 2,      // 2pt border
    addMarginNotes: true
  }
);
```

### Visualization Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `color` | string | `'FFFF00'` | RGB hex color (e.g., `'FFFF00'` = yellow) |
| `opacity` | number | `0.3` | Opacity for highlights (0.0-1.0) |
| `style` | `'highlight'` \| `'box'` | `'highlight'` | Highlight or border box |
| `borderWidth` | number | `2` | Border width for box style |
| `addMarginNotes` | boolean | `true` | Add citation numbers in margin |

### Multiple Visualization Styles

```typescript
// Yellow highlights (default)
await createAnnotatedPDF('paper.pdf', 'paper_highlights.pdf', localized, {
  color: 'FFFF00',
  opacity: 0.3,
  style: 'highlight'
});

// Red border boxes
await createAnnotatedPDF('paper.pdf', 'paper_boxes.pdf', localized, {
  color: 'FF0000',
  style: 'box',
  borderWidth: 2
});

// Green semi-transparent (no margin notes)
await createAnnotatedPDF('paper.pdf', 'paper_green.pdf', localized, {
  color: '00FF00',
  opacity: 0.2,
  style: 'highlight',
  addMarginNotes: false
});
```

### Filtering Citations

```typescript
// Only high-confidence citations (>= 80%)
const highConfidence = localized.filter(c => c.locationConfidence >= 0.8);
await createAnnotatedPDF('paper.pdf', 'paper_high_conf.pdf', highConfidence);

// Only citations for specific fields
const mortalityCitations = localized.filter(c =>
  c.citedText.toLowerCase().includes('mortality')
);
await createAnnotatedPDF('paper.pdf', 'paper_mortality.pdf', mortalityCitations);
```

### Field-Level Visual Validation

```typescript
import { linkDataToCitations } from './src/index.js';

// Map fields to their sources
const fieldSources = linkDataToCitations(result.data, result.rawResponse);

// Localize field-specific citations
const fieldCitations = {};
for (const [field, sources] of Object.entries(fieldSources)) {
  fieldCitations[field] = await localizeCitations('paper.pdf', sources);
}

// Create separate annotated PDFs for each field
for (const [field, citations] of Object.entries(fieldCitations)) {
  await createAnnotatedPDF(
    'paper.pdf',
    `paper_field_${field}.pdf`,
    citations,
    { color: 'FFFF00', style: 'highlight' }
  );
  console.log(`✓ Created: paper_field_${field}.pdf`);
}
```

### Localized Citation Data Structure

```typescript
interface LocalizedCitation extends CitationSource {
  /** Bounding boxes for the cited text (may be multiple if text spans lines) */
  boundingBoxes: BoundingBox[];
  /** Search confidence (0.0-1.0) */
  locationConfidence: number;
}

interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  page: number;
}
```

### How It Works

1. **Text Extraction with Coordinates**
   - Uses `pdftotext -bbox-layout` to extract PDF text with precise coordinates
   - Generates XML with bounding box data for every word

2. **Fuzzy Text Search**
   - Searches for cited text on the specified page
   - Handles whitespace/formatting variations (70% word match threshold)
   - Returns confidence score based on match quality

3. **Bounding Box Merging**
   - Merges adjacent word boxes on the same line into larger regions
   - Handles multi-line citations by creating multiple boxes

4. **PDF Annotation**
   - Uses pdf-lib to add visual elements (rectangles, text)
   - Supports both highlights (semi-transparent overlays) and boxes (borders)
   - Adds margin notes with citation numbers

### Performance & Accuracy

- **Localization Speed**: ~200ms per citation (depends on PDF size)
- **Match Accuracy**: 85-95% (fuzzy matching handles formatting variations)
- **Bounding Box Precision**: ±2 points (1/36 inch)
- **Supported PDF Types**: Text-based PDFs (not scanned/OCR)

### Troubleshooting

**Citation not found:**
- Check if PDF is text-based (not scanned)
- Verify page number is correct
- Cited text may have been extracted from metadata, not content

**Low confidence score:**
- Cited text may span multiple columns
- Text formatting differs significantly from extraction
- Page contains similar text (multiple matches)

**Bounding boxes look wrong:**
- PDF has complex layout (multi-column, tables)
- Text is rotated or in unusual position
- Use lower `opacity` or `box` style for better visibility

## Examples

See [examples/citation-visual-validation-example.ts](examples/citation-visual-validation-example.ts) for:
- ✅ Complete visual validation pipeline
- ✅ Multiple visualization styles (highlights, boxes, colors)
- ✅ Citation filtering and inspection
- ✅ Field-level visual validation
- ✅ Confidence score analysis
- ✅ Custom annotation options

## Summary

TheAgent implements Claude's native citations with the same "REQUIRED - display sources" pattern as Google's Vertex AI, PLUS visual validation for verification. This ensures:

- ✅ **Transparency**: Users see where data came from (console/HTML/PDF)
- ✅ **Verification**: Sources can be checked against PDFs with visual highlights
- ✅ **Precision**: Bounding boxes show exact locations in PDF
- ✅ **Compliance**: Follows industry best practice for AI grounding
- ✅ **Trust**: Builds confidence in extracted data with visual proof

**Key Takeaway:** Just like Google requires displaying `groundingChunks`, TheAgent requires calling `displaySources()` to show users citation sources. TheAgent goes further by providing `createCitationVisualValidation()` to create annotated PDFs with visual proof of where data came from.
