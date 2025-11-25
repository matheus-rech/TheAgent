# Native Claude Citations Integration

## Overview

Claude API has **native citation support** (introduced June 2025) that can dramatically improve TheAgent's accuracy and transparency. This document explains how to leverage this feature alongside the Citation Extractor module.

## Two Complementary Features

### 1. Native Claude Citations (API Feature)
**What it does:** Claude cites WHERE it found information when answering questions

**Use case:** Extract structured data FROM papers with verifiable sources
- "What was the sample size?" → "45 patients [cited from page 3, lines 15-17]"
- Every extracted field comes with exact location in PDF
- Enables visual validation and transparency

### 2. Reference Extraction (Citation Extractor Module)
**What it does:** Extracts and validates the paper's bibliography

**Use case:** Build reference database across systematic review
- Extract all 30-50 citations from paper's References section
- Validate DOIs via CrossRef/PubMed
- Format in Vancouver style for your review's bibliography

## Architecture: How They Integrate

```
PDF Paper
  ├─ Native Citations: Extract study data WITH source locations
  │   ├─ "Sample size: 45 patients" [page 3, char 1234-1250]
  │   ├─ "Mortality: 28%" [page 5, char 3456-3470]
  │   └─ "Follow-up: 90 days" [page 4, char 2789-2810]
  │
  └─ Reference Extraction: Extract bibliography for database
      ├─ Smith J et al. (2022) - DOI: 10.1234/abc
      ├─ Jones M et al. (2021) - DOI: 10.5678/def
      └─ Anderson K et al. (2020) - DOI: 10.9012/ghi
```

## Implementation: Enhanced Citation Extractor

### TypeScript/JavaScript Example

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

/**
 * Extract structured data WITH native citations
 */
async function extractWithCitations(pdfPath: string) {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!
  });

  // Read PDF and convert to base64
  const pdfBuffer = readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const response = await client.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
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
          title: 'Cerebellar Stroke Study',
          citations: { enabled: true } // ⭐ Enable native citations
        },
        {
          type: 'text',
          text: `Extract the following data from this cerebellar stroke research paper.
Use citations to back up every answer.

Extract:
1. Sample size
2. Mean age
3. Intervention procedure
4. Mortality rate
5. mRS favorable outcome rate
6. Follow-up duration

Return as JSON with citations for each field.`
        }
      ]
    }]
  });

  // Response includes both the answer AND citations
  return response;
}

/**
 * Process citations from response
 */
function processCitationResponse(response: any) {
  const citations: any[] = [];

  for (const block of response.content) {
    if (block.type === 'text') {
      console.log('Extracted data:', block.text);
    } else if (block.type === 'citations') {
      citations.push(...block.citations);
    }
  }

  // Each citation includes:
  citations.forEach(citation => {
    console.log(`Citation ${citation.index}:`);
    console.log(`  Type: ${citation.type}`); // "page_location" for PDFs
    console.log(`  Pages: ${citation.start_page_number}-${citation.end_page_number}`);
    console.log(`  Text: "${citation.cited_text}"`);
    console.log(`  Document: ${citation.document_title}`);
  });

  return citations;
}
```

### Python Example (from Claude Cookbook)

```python
import anthropic
import base64

def extract_with_citations(pdf_path: str):
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    # Read PDF and encode
    with open(pdf_path, 'rb') as f:
        pdf_data = base64.standard_b64encode(f.read()).decode("utf-8")

    response = client.messages.create(
        model="claude-sonnet-4-5-20250929",
        max_tokens=4096,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": pdf_data
                    },
                    "title": "Cerebellar Stroke Study",
                    "citations": {"enabled": True}
                },
                {
                    "type": "text",
                    "text": "Extract sample size, mortality, and outcomes. Use citations."
                }
            ]
        }]
    )

    # Process response
    for block in response.content:
        if block.type == "text":
            print(block.text)
        elif block.type == "citations":
            for citation in block.citations:
                print(f"\nCitation: {citation.cited_text}")
                print(f"Pages: {citation.start_page_number}-{citation.end_page_number}")

    return response
```

## Integration with TheAgent

### Option 1: Enhance Full-PDF Extractor

Update `full-pdf-extractor.ts` to use native citations:

```typescript
private async extractMethods(pdfPath: string, options?: ExtractionOptions): Promise<MethodsData> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

  // Read PDF as base64
  const pdfBuffer = readFileSync(pdfPath);
  const pdfBase64 = pdfBuffer.toString('base64');

  const response = await client.messages.create({
    model: options?.model || 'claude-sonnet-4-5-20250929',
    max_tokens: options?.maxTokens || 4096,
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
          citations: { enabled: true }
        },
        {
          type: 'text',
          text: `Extract methods section data. Use citations for every field.

Extract:
- study_type (RCT, cohort, case series)
- setting (hospital, multicenter)
- participants (inclusion/exclusion)
- interventions (treatment details)
- outcomes_measured
- statistical_analysis

Return as JSON.`
        }
      ]
    }]
  });

  // Parse response and extract citations
  const data = JSON.parse(response.content[0].text);
  const citations = response.content
    .filter(b => b.type === 'citations')
    .flatMap(b => b.citations);

  return {
    ...data,
    citations: citations, // Store citation locations
    extraction_confidence: 0.95 // High confidence with citations
  };
}
```

### Option 2: Create Dedicated Citation-Aware Extractor

```typescript
export class CitationAwareExtractor extends BaseModule {
  async extractWithSources(pdfPath: string) {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

    // ... (similar to above)

    // Return both data AND citation proofs
    return {
      data: extractedData,
      citations: citationLocations,
      confidence: 0.95
    };
  }
}
```

## Citation Response Format

### For PDFs (page_location)

```typescript
{
  type: "page_location",
  cited_text: "Sample size was 45 patients (30 SDC, 15 medical management)",
  document_index: 0,
  document_title: "Cerebellar Stroke Study",
  start_page_number: 3, // 1-indexed
  end_page_number: 3
}
```

### For Plain Text (char_location)

```typescript
{
  type: "char_location",
  cited_text: "mortality rate of 28%",
  document_index: 0,
  document_title: "Results Section",
  start_char_index: 1234, // 0-indexed
  end_char_index: 1256
}
```

## Visual Validation with Citations

Combine native citations with PDF annotation:

```typescript
import { PdfAnnotator } from './modules/pdf-annotator.js';

// 1. Extract data with citations
const response = await extractWithCitations('paper.pdf');
const citations = processCitationResponse(response);

// 2. Create annotated PDF highlighting cited passages
const annotator = new PdfAnnotator();
await annotator.process({
  pdfPath: 'paper.pdf',
  outputPath: 'paper_annotated.pdf',
  citations: citations, // Pass Claude's citation locations
  colorScheme: 'citation-based' // Color by citation type
});

// Result: PDF with highlighted text showing exactly where data came from
```

## Benefits Over Manual Extraction

### Without Native Citations
```
"Sample size: 45 patients"
// Where did this come from? 🤷
// Is it reliable? Unknown
// Can we verify? Manual PDF search
```

### With Native Citations
```
"Sample size: 45 patients" [1]

[1] Page 3, lines 15-17: "A total of 45 patients were enrolled
    in this prospective cohort study between January 2020 and
    December 2022 (30 in the SDC group, 15 in the medical
    management group)."
```

**Advantages:**
- ✅ Verifiable: Exact page and text location
- ✅ Transparent: Show reviewers the source
- ✅ Accurate: No hallucination, must cite real text
- ✅ Efficient: No need to copy entire quotes in prompts
- ✅ Precise: Can verify against PDF manually

## Combining with Reference Extraction

Full workflow for systematic review:

```typescript
async function processStudyComplete(pdfPath: string) {
  const agent = new TheAgent({ verbose: true });

  // Step 1: Extract study data WITH native citations
  const studyData = await agent.extractWithCitations(pdfPath);

  // Step 2: Extract paper's bibliography
  const references = await agent.citationExtractor.process({
    pdfPath: pdfPath,
    validateDOIs: true,
    outputFormat: 'vancouver'
  });

  // Step 3: Create annotated PDF showing extraction sources
  await agent.pdfAnnotator.process({
    pdfPath: pdfPath,
    outputPath: `${pdfPath.replace('.pdf', '_annotated.pdf')}`,
    extractedData: studyData,
    citations: studyData.citations // Use native citations for highlighting
  });

  return {
    study: studyData.data,
    citations_used: studyData.citations, // WHERE data came from
    bibliography: references.citations,  // WHAT papers this study cites
    confidence: studyData.confidence
  };
}
```

## Performance Considerations

**Token Usage:**
- Enabling citations adds ~50-100 tokens to input (system prompt + chunking)
- `cited_text` field doesn't count toward output tokens
- Overall: Small increase for major accuracy improvement

**Prompt Caching:**
```typescript
{
  type: 'document',
  source: { /* ... */ },
  citations: { enabled: true },
  cache_control: { type: 'ephemeral' } // Cache the document
}
```

**Streaming:**
```typescript
const stream = await client.messages.stream({
  // ... same config ...
});

for await (const event of stream) {
  if (event.type === 'citations_delta') {
    console.log('Citation:', event.citation);
  }
}
```

## Important Limitations

1. **Cannot use with Structured Outputs**
   - Citations + JSON mode = 400 error
   - Use regular text responses, parse JSON manually

2. **Sonnet 3.7 needs explicit prompting**
   - Add: "Use citations to back up your answer"
   - Sonnet 4.5 cites more naturally

3. **No image citations yet**
   - Can process PDFs with images
   - Only text content can be cited

4. **Files API support**
   ```typescript
   {
     type: 'document',
     source: {
       type: 'file',
       file_id: 'file_abc123...'
     },
     citations: { enabled: true }
   }
   ```

## Next Steps

1. **Update Full-PDF Extractor** to use native citations
2. **Keep Reference Extractor** for bibliography extraction
3. **Integrate with PDF Annotator** for visual validation
4. **Test with real papers** to validate accuracy improvement

## Resources

- [Claude Citations Docs](https://platform.claude.com/docs/en/build-with-claude/citations)
- [Citations Cookbook](https://github.com/anthropics/claude-cookbooks/blob/main/misc/using_citations.ipynb)
- [Anthropic API Reference](https://platform.claude.com/docs/en/api/messages)
- [Citations API Announcement](https://www.anthropic.com/news/introducing-citations-api)

---

**Summary:** Native citations provide WHERE data came from (transparency), while Reference Extraction provides WHAT papers are cited (bibliography). Together they create a complete citation solution for systematic reviews.
