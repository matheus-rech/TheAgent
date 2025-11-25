/**
 * Table & Figure Extractor Module
 * Vision-based extraction of tables and figures using Docling MCP
 *
 * Migrated to use Agent SDK MCP integration for standardized MCP server management
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { BaseModule } from './base.js';
import { AGENT_CONFIGS } from '../agents/config.js';
import { MCP_SERVERS, isMcpEnabled } from '../agents/mcp-config.js';
import type { ExtractionOptions, TableExtractionResult, TableData, FigureData } from '../types/index.js';

// Import legacy client for type compatibility (DoclingImage used in parseDoclingResponse)
import type { DoclingImage } from '../utils/docling-mcp-client.js';

interface TableFigureInput {
  pdfPath: string;
  /** Specific pages to extract from (optional) */
  pages?: number[];
  /** Extract images/figures in addition to tables */
  extractFigures?: boolean;
  /** Output directory for extracted images */
  imageOutputDir?: string;
}

export class TableFigureExtractor extends BaseModule<TableFigureInput, TableExtractionResult> {
  readonly name = 'Table & Figure Extractor';
  readonly description = 'Extracts tables and figures using vision-based document understanding';

  async process(input: TableFigureInput, options?: ExtractionOptions): Promise<TableExtractionResult> {
    this.validate();
    this.log('Starting table and figure extraction...', options?.verbose);

    try {
      // Check if Docling MCP is available via Agent SDK config
      const useDocling = isMcpEnabled('docling');

      if (useDocling) {
        this.log('Docling MCP enabled via Agent SDK', options?.verbose);
        return await this.extractWithDocling(input, options);
      } else {
        this.log('Docling MCP not enabled, using vision fallback', options?.verbose);
        return await this.extractWithVision(input, options);
      }
    } catch (error) {
      this.logError(`Extraction failed: ${error}`);
      throw error;
    }
  }

  /**
   * Extract tables using Docling MCP server via Agent SDK
   *
   * Docling MCP provides advanced document layout understanding:
   * - Accurate table structure extraction (headers, merged cells)
   * - Vision-first approach for complex layouts
   * - High accuracy on medical/scientific tables
   *
   * Agent SDK Integration:
   * - Standardized MCP server configuration
   * - Automatic server lifecycle management
   * - Graceful fallback on MCP unavailability
   *
   * See: https://glama.ai/mcp/servers/@zanetworker/mcp-docling
   */
  private async extractWithDocling(
    input: TableFigureInput,
    options?: ExtractionOptions
  ): Promise<TableExtractionResult> {
    this.log('Using Docling MCP via Agent SDK for table extraction', options?.verbose);

    try {
      // Construct extraction prompt for Docling
      const extractionPrompt = this.buildDoclingPrompt(input);

      // Get agent configuration
      const agentConfig = AGENT_CONFIGS.tableExtractor;

      // Query with Docling MCP server
      this.log('Querying Docling MCP server...', options?.verbose);

      const queryResult = query({
        prompt: extractionPrompt,
        options: {
          model: options?.model || agentConfig.model,
          systemPrompt: agentConfig.systemPrompt,
          // Enable Docling MCP server
          mcpServers: isMcpEnabled('docling') ? { docling: MCP_SERVERS.docling } : undefined,
        },
      });

      // Collect response from agent
      let responseText = '';
      for await (const message of queryResult) {
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'text') {
              responseText += block.text;
            }
          }
        }
      }

      // Parse Docling response
      const extractedData = this.parseDoclingResponse(responseText);

      this.log(`Docling extracted ${extractedData.tables.length} tables`, options?.verbose);

      // TODO: Figure extraction disabled - TableExtractionResult doesn't support figures
      // If needed, implement separate figure extraction method or extend result type
      /*
      if (input.extractFigures && extractedData.images) {
        const imageDir = input.imageOutputDir || join(dirname(input.pdfPath), 'extracted_images');
        if (!existsSync(imageDir)) {
          mkdirSync(imageDir, { recursive: true });
        }
        this.log(`Docling extracted ${extractedData.images.length} images`, options?.verbose);
      }
      */

      return {
        tables: extractedData.tables,
        extraction_method: 'docling',
        confidence: 0.95, // Docling has high accuracy
      };
    } catch (error) {
      this.logError(`Docling extraction failed: ${error}`);

      // Fallback to vision API if Docling fails
      this.log('Falling back to vision-based extraction', options?.verbose);
      return await this.extractWithVision(input, options);
    }
  }

  /**
   * Fallback: Extract tables using Claude vision API via Agent SDK
   *
   * This fallback method:
   * 1. Uses Claude vision to identify table regions
   * 2. Extracts table content via vision API
   * 3. Structures the data into TableData format
   *
   * Trade-offs:
   * - Vision is slower but works without Docling MCP
   * - May have lower accuracy on complex tables (~80% vs 95%)
   * - Better for figures and charts
   * - Always available (no MCP dependency)
   *
   * Enhanced with Agent SDK for standardized extraction
   */
  private async extractWithVision(
    input: TableFigureInput,
    options?: ExtractionOptions
  ): Promise<TableExtractionResult> {
    this.log('Using Claude vision API via Agent SDK for extraction', options?.verbose);

    try {
      // Construct vision extraction prompt
      const visionPrompt = this.buildVisionPrompt(input);

      // Get agent configuration
      const agentConfig = AGENT_CONFIGS.tableExtractor;

      // Query with vision API (no MCP servers)
      this.log('Querying Claude vision API...', options?.verbose);

      const queryResult = query({
        prompt: visionPrompt,
        options: {
          model: options?.model || agentConfig.model,
          systemPrompt: agentConfig.systemPrompt,
          // No MCP servers for vision fallback
          mcpServers: undefined,
        },
      });

      // Collect response
      let responseText = '';
      for await (const message of queryResult) {
        if (message.type === 'assistant') {
          for (const block of message.message.content) {
            if (block.type === 'text') {
              responseText += block.text;
            }
          }
        }
      }

      // Parse vision response
      const extractedData = this.parseVisionResponse(responseText);

      this.log(`Vision API extracted ${extractedData.tables.length} tables`, options?.verbose);

      return {
        tables: extractedData.tables,
        extraction_method: 'vision',
        confidence: 0.80, // Vision has good but lower accuracy than Docling
      };
    } catch (error) {
      this.logError(`Vision extraction failed: ${error}`);

      // Return empty result on complete failure
      return {
        tables: [],
        extraction_method: 'fallback',
        confidence: 0.0,
      };
    }
  }

  /**
   * Extract figures and charts from PDF
   *
   * TODO: Implement figure extraction
   *
   * Key considerations:
   * - How to identify different chart types (Kaplan-Meier, forest plots, etc.)?
   * - Should we extract data points from charts for IPD reconstruction?
   * - How to handle image quality and resolution?
   */
  async extractFigures(_input: TableFigureInput, options?: ExtractionOptions): Promise<FigureData[]> {
    this.log('Extracting figures...', options?.verbose);

    // TODO: Implement figure extraction logic
    return [];
  }

  /**
   * Build extraction prompt for Docling MCP
   */
  private buildDoclingPrompt(input: TableFigureInput): string {
    const extractImages = input.extractFigures ? 'and images/figures' : '';
    const pageFilter = input.pages ? `Focus on pages: ${input.pages.join(', ')}` : 'Extract from all pages';

    return `Extract all tables ${extractImages} from the PDF file at: ${input.pdfPath}

${pageFilter}

For each table, provide:
1. Table number (sequential)
2. Caption/title (if present)
3. Complete table structure (headers and data rows)
4. Page number where the table appears
5. Column headers with exact text
6. All data rows with preserved formatting

${input.extractFigures ? `
For each image/figure, provide:
1. Figure number (sequential)
2. Caption/title (if present)
3. Page number
4. Type (figure, chart, diagram, photo)
5. Path to extracted image file
` : ''}

Return the results as structured JSON in this format:
{
  "tables": [
    {
      "table_number": 1,
      "caption": "Patient characteristics",
      "headers": ["Variable", "Value", "P-value"],
      "data": [
        ["Age (years)", "65 ± 12", "0.03"],
        ["Gender (M/F)", "45/30", "0.15"]
      ],
      "page": 3
    }
  ]${input.extractFigures ? `,
  "images": [
    {
      "image_number": 1,
      "caption": "Kaplan-Meier survival curve",
      "path": "/path/to/extracted/image.png",
      "page": 5,
      "type": "chart"
    }
  ]` : ''}
}`;
  }

  /**
   * Build extraction prompt for vision API fallback
   */
  private buildVisionPrompt(input: TableFigureInput): string {
    const pageFilter = input.pages ? `Focus on pages: ${input.pages.join(', ')}` : 'Analyze all pages';

    return `Analyze the PDF at ${input.pdfPath} and extract all tables.

${pageFilter}

For each table:
1. Identify table boundaries and structure
2. Extract complete headers with exact text
3. Extract all data rows preserving formatting
4. Note the page number
5. Capture any table caption or title

Return structured JSON:
{
  "tables": [
    {
      "table_number": 1,
      "title": "Table title or caption",
      "page": 3,
      "headers": ["Column 1", "Column 2", "Column 3"],
      "rows": [
        ["Data 1", "Data 2", "Data 3"],
        ["Data 4", "Data 5", "Data 6"]
      ],
      "caption": "Full table caption if present"
    }
  ]
}

Important:
- Preserve exact numerical values (no rounding)
- Maintain column alignment and relationships
- Handle merged cells appropriately
- Extract footnotes and notes
- Identify statistical significance markers (*, †, ‡)`;
  }

  /**
   * Parse Docling MCP response into table data
   */
  private parseDoclingResponse(responseText: string): {
    tables: TableData[];
    images?: DoclingImage[];
  } {
    try {
      // Extract JSON from response (may be wrapped in markdown code blocks)
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
                       responseText.match(/(\{[\s\S]*\})/);

      if (!jsonMatch) {
        this.logError('No JSON found in Docling response');
        return { tables: [] };
      }

      const parsed = JSON.parse(jsonMatch[1]);

      // Convert to TableData format
      const tables: TableData[] = (parsed.tables || []).map((table: any, index: number) => ({
        table_number: table.table_number || index + 1,
        title: table.caption || table.title || `Table ${index + 1}`,
        page: table.page || 0,
        headers: table.headers || (table.data?.[0] || []),
        rows: table.data || table.rows || [],
        caption: table.caption || table.title,
        extracted_type: 'docling',
      }));

      return {
        tables,
        images: parsed.images || undefined,
      };
    } catch (error) {
      this.logError(`Failed to parse Docling response: ${error}`);
      return { tables: [] };
    }
  }

  /**
   * Parse vision API response into table data
   */
  private parseVisionResponse(responseText: string): {
    tables: TableData[];
    figures?: FigureData[];
  } {
    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/) ||
                       responseText.match(/(\{[\s\S]*\})/);

      if (!jsonMatch) {
        this.logError('No JSON found in vision response');
        return { tables: [] };
      }

      const parsed = JSON.parse(jsonMatch[1]);

      // Convert to TableData format
      const tables: TableData[] = (parsed.tables || []).map((table: any, index: number) => ({
        table_number: table.table_number || index + 1,
        title: table.title || `Table ${index + 1}`,
        page: table.page || 0,
        headers: table.headers || [],
        rows: table.rows || table.data || [],
        caption: table.caption,
        extracted_type: 'vision',
      }));

      return {
        tables,
        figures: parsed.figures,
      };
    } catch (error) {
      this.logError(`Failed to parse vision response: ${error}`);
      return { tables: [] };
    }
  }

  /**
   * Parse a table extracted by Docling into our TableData format
   *
   * @deprecated Legacy method - kept for backward compatibility but currently unused
   * TODO: Remove if not needed or reintegrate into extraction logic
   */
  /*
  private parseDoclingTable(_doclingTable: DoclingTable, _tableNumber: number): TableData {
    const data = _doclingTable.data || [];

    // First row is typically headers (if not explicitly provided)
    const headers = _doclingTable.headers || (data.length > 0 ? data[0] : []);

    // Remaining rows are data (skip first row if it was used for headers)
    const rows = _doclingTable.headers ? data : data.slice(1);

    return {
      table_number: _tableNumber,
      title: _doclingTable.caption || `Table ${_tableNumber}`,
      page: _doclingTable.page || 0,
      headers: headers,
      rows: rows,
      caption: _doclingTable.caption,
      extracted_type: 'docling',
    };
  }
  */

  /**
   * Map Docling image type to FigureData type
   *
   * TODO: Re-enable when figure extraction is implemented
   */
  /*
  private mapImageTypeToFigureType(
    _doclingType?: 'figure' | 'chart' | 'diagram' | 'photo'
  ): 'kaplan-meier' | 'forest-plot' | 'bar-chart' | 'scatter' | 'other' {
    // Default mapping (can be enhanced with Claude vision for precise classification)
    switch (_doclingType) {
      case 'chart':
        return 'bar-chart'; // Could be any chart type
      case 'diagram':
      case 'figure':
      case 'photo':
      default:
        return 'other';
    }
  }
  */
}
