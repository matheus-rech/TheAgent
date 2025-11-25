/**
 * Citation Display Utility
 *
 * REQUIRED: Display sources for all extracted data using Claude's native citations.
 * Follows the pattern of displaying grounding metadata/sources to users.
 *
 * Similar to Google's Vertex AI grounding chunks pattern, but for Claude's native citations.
 */

import type { Message } from '@anthropic-ai/sdk/resources/messages';

/**
 * Citation source information extracted from Claude's response
 */
export interface CitationSource {
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

/**
 * Extract citation sources from Claude API response
 *
 * REQUIRED: Call this for every response that uses citations to get source information.
 *
 * @param response - Claude API response with citations enabled
 * @returns Array of citation sources with location information
 *
 * @example
 * ```typescript
 * const response = await client.messages.create({
 *   messages: [{
 *     role: 'user',
 *     content: [
 *       { type: 'document', source: {...}, citations: { enabled: true } },
 *       { type: 'text', text: 'Extract mortality rate' }
 *     ]
 *   }]
 * });
 *
 * // REQUIRED - extract citation sources
 * const sources = extractCitationSources(response);
 *
 * // REQUIRED - display sources to user
 * displayCitationSources(sources);
 * ```
 */
export function extractCitationSources(response: Message): CitationSource[] {
  const sources: CitationSource[] = [];

  for (const block of response.content) {
    if ((block as any).type === 'citations') {
      const citationsBlock = block as any;

      for (const citation of citationsBlock.citations) {
        const source: CitationSource = {
          index: sources.length + 1,
          type: citation.type,
          citedText: citation.cited_text || '',
          documentTitle: citation.document_title
        };

        // Add location-specific fields
        if (citation.type === 'page_location') {
          source.pageNumber = citation.start_page_number;
        } else if (citation.type === 'char_location') {
          source.charRange = {
            start: citation.start_char_index,
            end: citation.end_char_index
          };
        } else if (citation.type === 'content_block_location') {
          source.contentBlockIndex = citation.content_block_index;
        }

        sources.push(source);
      }
    }
  }

  return sources;
}

/**
 * Format citation sources for display
 *
 * Creates human-readable source attribution strings.
 *
 * @param sources - Array of citation sources
 * @returns Array of formatted source strings
 *
 * @example
 * ```typescript
 * const formatted = formatCitationSources(sources);
 * // Output:
 * // [
 * //   "[1] Page 3: \"Sample size was 45 patients...\"",
 * //   "[2] Page 5: \"Mortality rate of 28%...\"",
 * // ]
 * ```
 */
export function formatCitationSources(sources: CitationSource[]): string[] {
  return sources.map(source => {
    let location = '';

    if (source.pageNumber) {
      location = `Page ${source.pageNumber}`;
    } else if (source.charRange) {
      location = `Characters ${source.charRange.start}-${source.charRange.end}`;
    } else if (source.contentBlockIndex !== undefined) {
      location = `Block ${source.contentBlockIndex}`;
    } else {
      location = 'Unknown location';
    }

    const preview = source.citedText.length > 100
      ? source.citedText.slice(0, 97) + '...'
      : source.citedText;

    return `[${source.index}] ${location}: "${preview}"`;
  });
}

/**
 * Display citation sources to console
 *
 * REQUIRED: Call this to show users where extracted data came from.
 * This ensures transparency and allows verification of extracted information.
 *
 * @param sources - Array of citation sources
 * @param title - Optional title for the sources section
 *
 * @example
 * ```typescript
 * // REQUIRED - display sources
 * displayCitationSources(sources, "Data Sources");
 * ```
 */
export function displayCitationSources(
  sources: CitationSource[],
  title: string = 'Sources'
): void {
  if (sources.length === 0) {
    console.log(`\n📚 ${title}: No sources cited`);
    return;
  }

  console.log(`\n📚 ${title} (${sources.length} citation${sources.length > 1 ? 's' : ''}):`);
  console.log('━'.repeat(80));

  for (const source of sources) {
    let locationStr = '';

    if (source.pageNumber) {
      locationStr = `📄 Page ${source.pageNumber}`;
    } else if (source.charRange) {
      locationStr = `📝 Chars ${source.charRange.start}-${source.charRange.end}`;
    } else if (source.contentBlockIndex !== undefined) {
      locationStr = `📦 Block ${source.contentBlockIndex}`;
    }

    console.log(`\n[${source.index}] ${locationStr}`);
    if (source.documentTitle) {
      console.log(`    Document: ${source.documentTitle}`);
    }

    // Display cited text with proper wrapping
    const maxWidth = 76;
    const lines = wrapText(source.citedText, maxWidth);
    console.log(`    "${lines[0]}`);
    for (let i = 1; i < lines.length; i++) {
      console.log(`     ${lines[i]}`);
    }
    if (lines.length === 1) {
      console.log(`"`);
    } else {
      const lastLine = lines[lines.length - 1];
      console.log(`${lastLine.includes('"') ? '' : '"'}`);
    }
  }

  console.log('\n' + '━'.repeat(80));
}

/**
 * Create HTML markup for citation sources (for web UIs)
 *
 * Generates HTML that can be rendered in web applications.
 *
 * @param sources - Array of citation sources
 * @returns HTML string
 *
 * @example
 * ```typescript
 * const html = generateCitationHTML(sources);
 * document.getElementById('sources').innerHTML = html;
 * ```
 */
export function generateCitationHTML(sources: CitationSource[]): string {
  if (sources.length === 0) {
    return '<p class="no-sources">No sources cited</p>';
  }

  let html = '<div class="citation-sources">';
  html += `<h3>📚 Sources (${sources.length})</h3>`;
  html += '<ul class="source-list">';

  for (const source of sources) {
    html += '<li class="source-item">';
    html += `<span class="source-index">[${source.index}]</span> `;

    if (source.pageNumber) {
      html += `<span class="source-location">Page ${source.pageNumber}</span>`;
    } else if (source.charRange) {
      html += `<span class="source-location">Characters ${source.charRange.start}-${source.charRange.end}</span>`;
    }

    if (source.documentTitle) {
      html += `<div class="source-document">${escapeHtml(source.documentTitle)}</div>`;
    }

    html += `<blockquote class="source-text">${escapeHtml(source.citedText)}</blockquote>`;
    html += '</li>';
  }

  html += '</ul>';
  html += '</div>';

  return html;
}

/**
 * Create markdown for citation sources (for documentation)
 *
 * @param sources - Array of citation sources
 * @returns Markdown string
 */
export function generateCitationMarkdown(sources: CitationSource[]): string {
  if (sources.length === 0) {
    return '_No sources cited_';
  }

  let markdown = `## Sources (${sources.length})\n\n`;

  for (const source of sources) {
    markdown += `**[${source.index}]** `;

    if (source.pageNumber) {
      markdown += `Page ${source.pageNumber}`;
    } else if (source.charRange) {
      markdown += `Characters ${source.charRange.start}-${source.charRange.end}`;
    }

    markdown += '\n\n';

    if (source.documentTitle) {
      markdown += `_Document: ${source.documentTitle}_\n\n`;
    }

    markdown += `> ${source.citedText}\n\n`;
  }

  return markdown;
}

/**
 * Link extracted data fields to their citation sources
 *
 * Maps each extracted field to the citation(s) that support it.
 *
 * @param extractedData - The extracted data object
 * @param response - Claude API response with citations
 * @returns Map of field names to their supporting citations
 *
 * @example
 * ```typescript
 * const fieldSources = linkDataToCitations(
 *   { mortality_rate: 28, sample_size: 45 },
 *   response
 * );
 *
 * // Show source for specific field
 * console.log(`Mortality rate source: ${fieldSources.mortality_rate}`);
 * ```
 */
export function linkDataToCitations(
  extractedData: Record<string, any>,
  response: Message
): Record<string, CitationSource[]> {
  const sources = extractCitationSources(response);
  const fieldSources: Record<string, CitationSource[]> = {};

  // Simple heuristic: match field values to cited text
  for (const [field, value] of Object.entries(extractedData)) {
    const valueStr = String(value).toLowerCase();
    const matchingSources = sources.filter(source =>
      source.citedText.toLowerCase().includes(valueStr)
    );

    if (matchingSources.length > 0) {
      fieldSources[field] = matchingSources;
    }
  }

  return fieldSources;
}

// Helper functions

/**
 * Wrap text to specified width
 */
function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length > 0 ? lines : [''];
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Enhanced extraction result with citation sources
 *
 * Use this interface for extraction results that include citation sources.
 */
export interface ExtractionWithSources<T = any> {
  /** Extracted structured data */
  data: T;
  /** Citation sources supporting the data */
  sources: CitationSource[];
  /** Formatted source strings for display */
  formattedSources: string[];
  /** Field-to-source mapping */
  fieldSources?: Record<string, CitationSource[]>;
}

/**
 * Create extraction result with full citation source information
 *
 * REQUIRED: Use this wrapper for all extraction results to ensure sources are tracked.
 *
 * @param data - Extracted data
 * @param response - Claude API response
 * @returns Extraction result with full source information
 *
 * @example
 * ```typescript
 * const result = createExtractionWithSources(
 *   { mortality_rate: 28, sample_size: 45 },
 *   response
 * );
 *
 * // REQUIRED - display sources
 * displayCitationSources(result.sources);
 *
 * // Access data
 * console.log(result.data.mortality_rate);
 *
 * // Show field-specific sources
 * console.log('Mortality rate from:', result.fieldSources.mortality_rate);
 * ```
 */
export function createExtractionWithSources<T = any>(
  data: T,
  response: Message
): ExtractionWithSources<T> {
  const sources = extractCitationSources(response);
  const formattedSources = formatCitationSources(sources);
  const fieldSources = linkDataToCitations(data as any, response);

  return {
    data,
    sources,
    formattedSources,
    fieldSources
  };
}
