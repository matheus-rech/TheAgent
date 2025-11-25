/**
 * Docling MCP Client
 *
 * Connects to Docling MCP server for advanced document processing:
 * - Table extraction with structure preservation
 * - Image extraction from PDFs
 * - OCR support for scanned documents
 * - Markdown conversion
 *
 * Docling MCP Tools:
 * 1. extract_tables - Extract tables as structured data
 * 2. convert_document_with_images - Extract images + convert to markdown
 * 3. convert_document - Convert to markdown only
 * 4. convert_batch - Batch processing
 *
 * See: https://glama.ai/mcp/servers/@zanetworker/mcp-docling
 */

import { spawn } from 'child_process';

/**
 * Docling table structure (from MCP server)
 */
export interface DoclingTable {
  table_number?: number;
  caption?: string;
  data: string[][]; // Rows of cells
  headers?: string[];
  page?: number;
}

/**
 * Docling image metadata
 */
export interface DoclingImage {
  image_number: number;
  path: string; // Path to extracted image file
  caption?: string;
  page?: number;
  type?: 'figure' | 'chart' | 'diagram' | 'photo';
}

/**
 * Docling conversion result
 */
export interface DoclingResult {
  markdown: string;
  tables: DoclingTable[];
  images: DoclingImage[];
  metadata?: {
    page_count: number;
    has_ocr: boolean;
  };
}

/**
 * Docling MCP Client
 *
 * Communicates with Docling MCP server via JSON-RPC over stdio
 */
export class DoclingMcpClient {
  private serverProcess: any = null;
  private messageId = 0;

  /**
   * Check if Docling MCP is available
   */
  static async isAvailable(): Promise<boolean> {
    try {
      // Try to run uvx --from=docling-mcp docling-mcp-server --help
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      await execAsync('uvx --from=docling-mcp docling-mcp-server --help', {
        timeout: 5000
      });
      return true;
    } catch (error) {
      console.warn('[DoclingMCP] Not available:', error);
      return false;
    }
  }

  /**
   * Start Docling MCP server
   */
  async start(): Promise<void> {
    if (this.serverProcess) {
      return; // Already started
    }

    // Start Docling MCP server via uvx
    this.serverProcess = spawn('uvx', [
      '--from=docling-mcp',
      'docling-mcp-server',
      '--transport', 'stdio'
    ]);

    // Handle server output
    this.serverProcess.stdout?.on('data', (data: Buffer) => {
      console.log('[DoclingMCP]', data.toString());
    });

    this.serverProcess.stderr?.on('data', (data: Buffer) => {
      console.error('[DoclingMCP Error]', data.toString());
    });

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  /**
   * Stop Docling MCP server
   */
  async stop(): Promise<void> {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  /**
   * Send JSON-RPC request to Docling MCP server
   */
  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.serverProcess) {
      await this.start();
    }

    const request = {
      jsonrpc: '2.0',
      id: ++this.messageId,
      method: method,
      params: params
    };

    return new Promise((resolve, reject) => {
      // Write request to stdin
      this.serverProcess.stdin.write(JSON.stringify(request) + '\n');

      // Listen for response on stdout
      const onData = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.id === request.id) {
            this.serverProcess.stdout.off('data', onData);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      this.serverProcess.stdout.on('data', onData);

      // Timeout after 30 seconds
      setTimeout(() => {
        this.serverProcess.stdout.off('data', onData);
        reject(new Error('Docling MCP request timeout'));
      }, 30000);
    });
  }

  /**
   * Extract tables from PDF using Docling
   *
   * @param pdfPath - Path to PDF file
   * @returns Array of extracted tables with structure
   */
  async extractTables(pdfPath: string): Promise<DoclingTable[]> {
    try {
      const result = await this.sendRequest('extract_tables', {
        source: pdfPath
      });

      // Parse Docling response
      // Result format: { tables: [...] }
      if (result && Array.isArray(result.tables)) {
        return result.tables.map((table: any, index: number) => ({
          table_number: index + 1,
          caption: table.caption || table.title,
          data: table.data || table.rows || [],
          headers: table.headers || (table.data?.[0] || []),
          page: table.page
        }));
      }

      return [];
    } catch (error) {
      console.error('[DoclingMCP] Table extraction failed:', error);
      return [];
    }
  }

  /**
   * Extract images from PDF using Docling
   *
   * @param pdfPath - Path to PDF file
   * @param outputDir - Directory to save extracted images
   * @returns Array of extracted images with metadata
   */
  async extractImages(pdfPath: string, _outputDir: string): Promise<DoclingImage[]> {
    try {
      const result = await this.sendRequest('convert_document_with_images', {
        source: pdfPath,
        enable_ocr: false // Don't need OCR for image extraction
      });

      // Result includes:
      // - markdown: Full document text
      // - images: Array of image metadata with paths
      if (result && Array.isArray(result.images)) {
        return result.images.map((img: any, index: number) => ({
          image_number: index + 1,
          path: img.path || img.file_path,
          caption: img.caption || img.alt_text,
          page: img.page,
          type: this.classifyImageType(img)
        }));
      }

      return [];
    } catch (error) {
      console.error('[DoclingMCP] Image extraction failed:', error);
      return [];
    }
  }

  /**
   * Convert PDF to markdown (useful for full-text extraction)
   *
   * @param pdfPath - Path to PDF file
   * @param enableOcr - Enable OCR for scanned documents
   * @param ocrLanguages - Language codes for OCR (e.g., ['en', 'fr'])
   * @returns Markdown content
   */
  async convertToMarkdown(
    pdfPath: string,
    enableOcr: boolean = false,
    ocrLanguages: string[] = ['en']
  ): Promise<string> {
    try {
      const result = await this.sendRequest('convert_document', {
        source: pdfPath,
        enable_ocr: enableOcr,
        ocr_language: ocrLanguages
      });

      return result.markdown || result.content || '';
    } catch (error) {
      console.error('[DoclingMCP] Markdown conversion failed:', error);
      return '';
    }
  }

  /**
   * Full extraction: tables + images + markdown
   *
   * @param pdfPath - Path to PDF file
   * @param outputDir - Directory for extracted images
   * @returns Complete extraction result
   */
  async extractAll(pdfPath: string, outputDir?: string): Promise<DoclingResult> {
    const [tables, images, markdown] = await Promise.all([
      this.extractTables(pdfPath),
      outputDir ? this.extractImages(pdfPath, outputDir) : Promise.resolve([]),
      this.convertToMarkdown(pdfPath)
    ]);

    return {
      markdown,
      tables,
      images,
      metadata: {
        page_count: this.estimatePageCount(markdown),
        has_ocr: false
      }
    };
  }

  /**
   * Batch processing of multiple PDFs
   *
   * @param pdfPaths - Array of PDF file paths
   * @returns Array of extraction results
   */
  async extractBatch(pdfPaths: string[]): Promise<DoclingResult[]> {
    try {
      const result = await this.sendRequest('convert_batch', {
        sources: pdfPaths,
        enable_ocr: false
      });

      // Process batch results
      if (Array.isArray(result)) {
        return result.map((doc: any) => ({
          markdown: doc.markdown || '',
          tables: doc.tables || [],
          images: doc.images || [],
          metadata: {
            page_count: this.estimatePageCount(doc.markdown),
            has_ocr: false
          }
        }));
      }

      return [];
    } catch (error) {
      console.error('[DoclingMCP] Batch processing failed:', error);
      return [];
    }
  }

  /**
   * Classify image type based on metadata
   */
  private classifyImageType(imgMetadata: any): 'figure' | 'chart' | 'diagram' | 'photo' {
    const caption = (imgMetadata.caption || imgMetadata.alt_text || '').toLowerCase();

    if (caption.includes('figure') || caption.includes('fig')) return 'figure';
    if (caption.includes('chart') || caption.includes('graph')) return 'chart';
    if (caption.includes('diagram') || caption.includes('schematic')) return 'diagram';

    return 'photo';
  }

  /**
   * Estimate page count from markdown length
   */
  private estimatePageCount(markdown: string): number {
    // Rough estimate: 3000 characters per page
    return Math.ceil(markdown.length / 3000);
  }
}

/**
 * Singleton instance for reuse
 */
let doclingInstance: DoclingMcpClient | null = null;

/**
 * Get shared Docling MCP client instance
 */
export async function getDoclingClient(): Promise<DoclingMcpClient> {
  if (!doclingInstance) {
    doclingInstance = new DoclingMcpClient();
    await doclingInstance.start();
  }
  return doclingInstance;
}

/**
 * Cleanup on process exit
 */
process.on('exit', () => {
  if (doclingInstance) {
    doclingInstance.stop();
  }
});
