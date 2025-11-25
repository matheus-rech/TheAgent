/**
 * PDF Bounding Box Text Extractor
 * Extracts text with precise (x, y) coordinates for highlighting and annotation
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { parseString } from 'xml2js';

const execAsync = promisify(exec);
const parseXml = promisify(parseString);

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface TextWithBBox {
  text: string;
  bbox: BoundingBox;
  page: number;
  fontSize?: number;
  fontFamily?: string;
}

export interface WordWithBBox extends TextWithBBox {
  confidence?: number;
}

export interface PageBounds {
  width: number;
  height: number;
}

/**
 * PDF Bounding Box Extractor
 * Uses pdftotext -bbox-layout to extract text with coordinates
 */
export class PdfBBoxExtractor {
  /**
   * Extract text with bounding boxes from PDF
   *
   * @param pdfPath - Path to PDF file
   * @param outputXml - Optional output XML file path
   * @returns Array of text elements with bounding boxes
   */
  static async extractWithBBoxes(
    pdfPath: string,
    outputXml?: string
  ): Promise<{ words: WordWithBBox[]; pages: PageBounds[] }> {
    if (!existsSync(pdfPath)) {
      throw new Error(`PDF file not found: ${pdfPath}`);
    }

    // Generate output XML path
    const xmlPath = outputXml || pdfPath.replace('.pdf', '_coords.xml');

    try {
      // Run pdftotext with bbox-layout option
      await execAsync(`pdftotext -bbox-layout "${pdfPath}" "${xmlPath}"`);

      // Parse XML
      const xmlContent = readFileSync(xmlPath, 'utf-8');
      const parsed = await parseXml(xmlContent);

      // Extract words and pages
      return this.parseXmlBBoxes(parsed);
    } catch (error) {
      throw new Error(`Failed to extract bounding boxes: ${error}`);
    }
  }

  /**
   * Extract bounding boxes for specific text (search and locate)
   *
   * @param pdfPath - Path to PDF file
   * @param searchText - Text to find and get coordinates for
   * @param caseSensitive - Case-sensitive search
   * @returns Array of bounding boxes where text was found
   */
  static async findTextBBoxes(
    pdfPath: string,
    searchText: string,
    caseSensitive: boolean = false
  ): Promise<TextWithBBox[]> {
    const { words } = await this.extractWithBBoxes(pdfPath);

    const searchLower = caseSensitive ? searchText : searchText.toLowerCase();
    const matches: TextWithBBox[] = [];

    // Search for exact word matches
    for (const word of words) {
      const wordText = caseSensitive ? word.text : word.text.toLowerCase();
      if (wordText.includes(searchLower)) {
        matches.push(word);
      }
    }

    // Also search for multi-word phrases
    if (searchText.includes(' ')) {
      const phraseMatches = this.findPhraseBBoxes(words, searchText, caseSensitive);
      matches.push(...phraseMatches);
    }

    return matches;
  }

  /**
   * Find bounding boxes for a phrase (multiple words)
   */
  private static findPhraseBBoxes(
    words: WordWithBBox[],
    phrase: string,
    caseSensitive: boolean
  ): TextWithBBox[] {
    const phraseWords = phrase.split(/\s+/);
    const matches: TextWithBBox[] = [];

    for (let i = 0; i <= words.length - phraseWords.length; i++) {
      let isMatch = true;
      const matchedWords: WordWithBBox[] = [];

      for (let j = 0; j < phraseWords.length; j++) {
        const wordText = caseSensitive ? words[i + j].text : words[i + j].text.toLowerCase();
        const phraseWord = caseSensitive ? phraseWords[j] : phraseWords[j].toLowerCase();

        if (!wordText.includes(phraseWord)) {
          isMatch = false;
          break;
        }
        matchedWords.push(words[i + j]);
      }

      if (isMatch && matchedWords.length > 0) {
        // Combine bounding boxes of matched words
        const combinedBBox = this.combineBBoxes(matchedWords);
        matches.push({
          text: matchedWords.map((w) => w.text).join(' '),
          bbox: combinedBBox,
          page: matchedWords[0].page,
        });
      }
    }

    return matches;
  }

  /**
   * Combine multiple bounding boxes into one
   */
  private static combineBBoxes(items: TextWithBBox[]): BoundingBox {
    if (items.length === 0) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const minX = Math.min(...items.map((w) => w.bbox.x));
    const minY = Math.min(...items.map((w) => w.bbox.y));
    const maxX = Math.max(...items.map((w) => w.bbox.x + w.bbox.width));
    const maxY = Math.max(...items.map((w) => w.bbox.y + w.bbox.height));

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }

  /**
   * Parse XML output from pdftotext -bbox-layout
   */
  private static parseXmlBBoxes(parsed: any): { words: WordWithBBox[]; pages: PageBounds[] } {
    const words: WordWithBBox[] = [];
    const pages: PageBounds[] = [];

    if (!parsed.pdf2xml || !parsed.pdf2xml.page) {
      return { words, pages };
    }

    const pagesData = Array.isArray(parsed.pdf2xml.page)
      ? parsed.pdf2xml.page
      : [parsed.pdf2xml.page];

    pagesData.forEach((pageData: any, pageIndex: number) => {
      // Extract page dimensions
      const width = parseFloat(pageData.$.width || 0);
      const height = parseFloat(pageData.$.height || 0);
      pages.push({ width, height });

      // Extract words
      if (pageData.word) {
        const wordsData = Array.isArray(pageData.word) ? pageData.word : [pageData.word];

        wordsData.forEach((wordData: any) => {
          const text = wordData._ || '';
          const xMin = parseFloat(wordData.$.xMin || 0);
          const yMin = parseFloat(wordData.$.yMin || 0);
          const xMax = parseFloat(wordData.$.xMax || 0);
          const yMax = parseFloat(wordData.$.yMax || 0);

          words.push({
            text,
            bbox: {
              x: xMin,
              y: yMin,
              width: xMax - xMin,
              height: yMax - yMin,
            },
            page: pageIndex + 1,
            fontSize: parseFloat(wordData.$.fontSize || 0),
            fontFamily: wordData.$.font,
          });
        });
      }
    });

    return { words, pages };
  }

  /**
   * Extract text from a specific region of a page
   *
   * @param pdfPath - Path to PDF
   * @param page - Page number (1-indexed)
   * @param region - Bounding box region to extract from
   * @returns Text within the specified region
   */
  static async extractRegion(
    pdfPath: string,
    page: number,
    region: BoundingBox
  ): Promise<string> {
    const { words } = await this.extractWithBBoxes(pdfPath);

    const regionWords = words.filter((word) => {
      if (word.page !== page) return false;

      // Check if word's bbox overlaps with region
      const wordBox = word.bbox;
      const overlapsX = wordBox.x < region.x + region.width && wordBox.x + wordBox.width > region.x;
      const overlapsY = wordBox.y < region.y + region.height && wordBox.y + wordBox.height > region.y;

      return overlapsX && overlapsY;
    });

    // Sort by position (top to bottom, left to right)
    regionWords.sort((a, b) => {
      const yDiff = a.bbox.y - b.bbox.y;
      if (Math.abs(yDiff) > 5) return yDiff; // Different lines
      return a.bbox.x - b.bbox.x; // Same line, sort by x
    });

    return regionWords.map((w) => w.text).join(' ');
  }

  /**
   * Check if pdftotext is available
   */
  static async checkAvailability(): Promise<boolean> {
    try {
      await execAsync('which pdftotext');
      return true;
    } catch {
      return false;
    }
  }
}
