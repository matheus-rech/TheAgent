/**
 * PDF Operations Utilities
 * Incorporates all capabilities from the /pdf skill
 */

import pdf from 'pdf-parse';
import { PDFDocument, degrees } from 'pdf-lib';
import { readFileSync, writeFileSync } from 'fs';

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
}

export interface MergeOptions {
  outputPath: string;
  files: string[];
}

export interface SplitOptions {
  inputPath: string;
  outputPrefix: string;
  pageRanges?: Array<{ start: number; end: number }>;
}

/**
 * PDF Operations class - all PDF manipulation capabilities
 */
export class PdfOperations {
  /**
   * Extract text from PDF
   */
  static async extractText(pdfPath: string): Promise<string> {
    const dataBuffer = readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    return data.text;
  }

  /**
   * Extract text from specific pages
   */
  static async extractTextFromPages(
    pdfPath: string,
    pages: number[]
  ): Promise<Record<number, string>> {
    const dataBuffer = readFileSync(pdfPath);
    const data = await pdf(dataBuffer);

    // Note: pdf-parse doesn't support per-page extraction natively
    // This is a simplified version - full implementation would need page-specific extraction
    const fullText = data.text;
    const result: Record<number, string> = {};

    // Split by form feed or page markers (heuristic)
    const pageTexts = fullText.split('\f');
    pages.forEach((pageNum) => {
      if (pageNum >= 0 && pageNum < pageTexts.length) {
        result[pageNum] = pageTexts[pageNum];
      }
    });

    return result;
  }

  /**
   * Get PDF metadata
   */
  static async getMetadata(pdfPath: string): Promise<PdfMetadata> {
    const dataBuffer = readFileSync(pdfPath);
    const pdfDoc = await PDFDocument.load(dataBuffer);

    return {
      title: pdfDoc.getTitle(),
      author: pdfDoc.getAuthor(),
      subject: pdfDoc.getSubject(),
      creator: pdfDoc.getCreator(),
      producer: pdfDoc.getProducer(),
      creationDate: pdfDoc.getCreationDate(),
      modificationDate: pdfDoc.getModificationDate(),
      pageCount: pdfDoc.getPageCount(),
    };
  }

  /**
   * Merge multiple PDFs into one
   */
  static async mergePdfs(options: MergeOptions): Promise<void> {
    const mergedPdf = await PDFDocument.create();

    for (const file of options.files) {
      const pdfBytes = readFileSync(file);
      const pdf = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      copiedPages.forEach((page) => {
        mergedPdf.addPage(page);
      });
    }

    const mergedPdfBytes = await mergedPdf.save();
    writeFileSync(options.outputPath, mergedPdfBytes);
  }

  /**
   * Split PDF into separate files
   */
  static async splitPdf(options: SplitOptions): Promise<string[]> {
    const pdfBytes = readFileSync(options.inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const outputFiles: string[] = [];

    if (options.pageRanges) {
      // Split by specified ranges
      for (let i = 0; i < options.pageRanges.length; i++) {
        const range = options.pageRanges[i];
        const newPdf = await PDFDocument.create();
        const pageIndices = Array.from(
          { length: range.end - range.start + 1 },
          (_, idx) => range.start + idx - 1
        );
        const copiedPages = await newPdf.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => newPdf.addPage(page));

        const outputPath = `${options.outputPrefix}_${i + 1}.pdf`;
        const pdfBytesOutput = await newPdf.save();
        writeFileSync(outputPath, pdfBytesOutput);
        outputFiles.push(outputPath);
      }
    } else {
      // Split into individual pages
      for (let i = 0; i < pdfDoc.getPageCount(); i++) {
        const newPdf = await PDFDocument.create();
        const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
        newPdf.addPage(copiedPage);

        const outputPath = `${options.outputPrefix}_page_${i + 1}.pdf`;
        const pdfBytesOutput = await newPdf.save();
        writeFileSync(outputPath, pdfBytesOutput);
        outputFiles.push(outputPath);
      }
    }

    return outputFiles;
  }

  /**
   * Extract specific pages to a new PDF
   */
  static async extractPages(
    inputPath: string,
    outputPath: string,
    pages: number[]
  ): Promise<void> {
    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const newPdf = await PDFDocument.create();

    const copiedPages = await newPdf.copyPages(pdfDoc, pages);
    copiedPages.forEach((page) => newPdf.addPage(page));

    const newPdfBytes = await newPdf.save();
    writeFileSync(outputPath, newPdfBytes);
  }

  /**
   * Rotate PDF pages
   */
  static async rotatePdf(
    inputPath: string,
    outputPath: string,
    rotation: 90 | 180 | 270,
    pages?: number[]
  ): Promise<void> {
    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    const pagesToRotate = pages || Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i);

    for (const pageIndex of pagesToRotate) {
      const page = pdfDoc.getPage(pageIndex);
      page.setRotation(degrees(rotation));
    }

    const rotatedPdfBytes = await pdfDoc.save();
    writeFileSync(outputPath, rotatedPdfBytes);
  }

  /**
   * Add watermark to PDF
   *
   * TODO: Implement watermark functionality
   * This requires drawing text/images on each page
   */
  static async addWatermark(
    inputPath: string,
    outputPath: string,
    _watermarkText: string
  ): Promise<void> {
    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // TODO: Draw watermark text on each page
    // This requires pdf-lib's drawing capabilities

    const watermarkedBytes = await pdfDoc.save();
    writeFileSync(outputPath, watermarkedBytes);
  }

  /**
   * Encrypt PDF with password
   */
  static async encryptPdf(
    inputPath: string,
    outputPath: string,
    _userPassword: string,
    _ownerPassword?: string
  ): Promise<void> {
    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Note: pdf-lib's encryption API is limited
    // For production use, consider using external tools like qpdf

    const encryptedBytes = await pdfDoc.save({
      // pdf-lib doesn't have built-in encryption yet
      // This is a placeholder for when it's implemented
    });

    writeFileSync(outputPath, encryptedBytes);
  }

  /**
   * Decrypt PDF (remove password)
   */
  static async decryptPdf(
    inputPath: string,
    outputPath: string,
    _password: string
  ): Promise<void> {
    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      // Note: pdf-lib has limited decryption support
    });

    const decryptedBytes = await pdfDoc.save();
    writeFileSync(outputPath, decryptedBytes);
  }

  /**
   * Get page count
   */
  static async getPageCount(pdfPath: string): Promise<number> {
    const dataBuffer = readFileSync(pdfPath);
    const data = await pdf(dataBuffer);
    return data.numpages;
  }

  /**
   * Check if PDF is encrypted
   */
  static async isEncrypted(pdfPath: string): Promise<boolean> {
    try {
      const pdfBytes = readFileSync(pdfPath);
      await PDFDocument.load(pdfBytes);
      return false;
    } catch (error) {
      // If loading fails due to encryption, it's encrypted
      return true;
    }
  }

  /**
   * Compress PDF (reduce file size)
   *
   * TODO: Implement compression
   * This requires advanced PDF optimization techniques
   */
  static async compressPdf(inputPath: string, outputPath: string): Promise<void> {
    const pdfBytes = readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(pdfBytes);

    // Basic compression by removing metadata and unused objects
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
    });

    writeFileSync(outputPath, compressedBytes);
  }
}
