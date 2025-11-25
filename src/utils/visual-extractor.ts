/**
 * Visual Extractor - Screenshot and Visual Validation Utilities
 *
 * Creates visual screenshots and annotations for all extraction steps:
 * - Tables with bounding boxes
 * - Figures with extracted data points
 * - Citations with highlights
 * - Imaging metrics with source regions
 *
 * Used for visual validation and quality assurance during testing.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const execAsync = promisify(exec);

/**
 * Bounding box for PDF regions
 */
export interface BoundingBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  page: number;
}

/**
 * Screenshot options
 */
export interface ScreenshotOptions {
  /** Resolution in DPI (default: 300) */
  dpi?: number;
  /** Output format: 'png' | 'jpg' (default: 'png') */
  format?: 'png' | 'jpg';
  /** JPEG quality if format is 'jpg' (default: 90) */
  quality?: number;
  /** Add colored border to highlight region */
  addBorder?: boolean;
  /** Border color in hex (default: 'FF0000' red) */
  borderColor?: string;
  /** Border width in pixels (default: 3) */
  borderWidth?: number;
}

/**
 * Table screenshot result
 */
export interface TableScreenshot {
  tableName: string;
  pageNumber: number;
  boundingBox: BoundingBox;
  screenshotPath: string;
  extractedData: any;
  confidence: number;
}

/**
 * Figure screenshot result
 */
export interface FigureScreenshot {
  figureName: string;
  figureType: string;
  pageNumber: number;
  boundingBox: BoundingBox;
  screenshotPath: string;
  extractedData?: any;
  annotations?: any[];
}

/**
 * Extract screenshot of a specific PDF region
 *
 * Uses pdftoppm to render PDF at high resolution, then crops to region.
 *
 * @param pdfPath - Path to PDF file
 * @param region - Bounding box to extract
 * @param outputPath - Output image path
 * @param options - Screenshot options
 */
export async function extractRegionScreenshot(
  pdfPath: string,
  region: BoundingBox,
  outputPath: string,
  options: ScreenshotOptions = {}
): Promise<void> {
  const {
    dpi = 300,
    format = 'png',
    quality = 90,
    addBorder = true,
    borderColor = 'FF0000',
    borderWidth = 3
  } = options;

  try {
    // Ensure output directory exists
    const outputDir = dirname(outputPath);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Step 1: Convert PDF page to image using pdftoppm
    const tempDir = join(dirname(outputPath), 'temp');
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }

    const tempPrefix = join(tempDir, 'page');
    const formatFlag = format === 'png' ? '-png' : '-jpeg';
    const qualityFlag = format === 'jpg' ? `-jpegopt quality=${quality}` : '';

    await execAsync(
      `pdftoppm ${formatFlag} ${qualityFlag} -r ${dpi} -f ${region.page} -l ${region.page} "${pdfPath}" "${tempPrefix}"`
    );

    // Find generated file
    const generatedFile = `${tempPrefix}-${region.page}.${format}`;

    if (!existsSync(generatedFile)) {
      throw new Error(`Failed to generate page image: ${generatedFile}`);
    }

    // Step 2: Crop to region using ImageMagick/GraphicsMagick
    const scaleX = dpi / 72; // PDF points to pixels at given DPI
    const scaleY = dpi / 72;

    const x = Math.floor(region.left * scaleX);
    const y = Math.floor(region.top * scaleY);
    const width = Math.floor((region.right - region.left) * scaleX);
    const height = Math.floor((region.bottom - region.top) * scaleY);

    // Try ImageMagick first, fall back to GraphicsMagick
    try {
      let convertCmd = `convert "${generatedFile}" -crop ${width}x${height}+${x}+${y}`;

      if (addBorder) {
        convertCmd += ` -bordercolor "#${borderColor}" -border ${borderWidth}`;
      }

      convertCmd += ` "${outputPath}"`;

      await execAsync(convertCmd);
    } catch (error) {
      // Try GraphicsMagick as fallback
      let gmCmd = `gm convert "${generatedFile}" -crop ${width}x${height}+${x}+${y}`;

      if (addBorder) {
        gmCmd += ` -bordercolor "#${borderColor}" -border ${borderWidth}`;
      }

      gmCmd += ` "${outputPath}"`;

      await execAsync(gmCmd);
    }

    // Clean up temp file
    await execAsync(`rm -f "${generatedFile}"`);

    console.log(`[VisualExtractor] ✓ Created screenshot: ${outputPath}`);
  } catch (error) {
    console.error(`[VisualExtractor] Failed to extract region screenshot:`, error);
    throw error;
  }
}

/**
 * Extract screenshots for all tables in extraction result
 *
 * @param pdfPath - Path to PDF file
 * @param tables - Array of extracted tables with locations
 * @param outputDir - Directory for screenshots
 * @returns Array of table screenshots
 */
export async function extractTableScreenshots(
  pdfPath: string,
  tables: Array<{
    name?: string;
    page: number;
    boundingBox?: BoundingBox;
    data: any;
    confidence?: number;
  }>,
  outputDir: string
): Promise<TableScreenshot[]> {
  console.log(`[VisualExtractor] Extracting screenshots for ${tables.length} tables...`);

  const screenshots: TableScreenshot[] = [];

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];

    if (!table.boundingBox) {
      console.warn(`[VisualExtractor] Skipping table ${i + 1} - no bounding box`);
      continue;
    }

    try {
      const tableName = table.name || `table_${i + 1}`;
      const outputPath = join(outputDir, `${tableName}_page${table.page}.png`);

      await extractRegionScreenshot(
        pdfPath,
        table.boundingBox,
        outputPath,
        {
          dpi: 300,
          format: 'png',
          addBorder: true,
          borderColor: '0066CC', // Blue for tables
          borderWidth: 3
        }
      );

      screenshots.push({
        tableName,
        pageNumber: table.page,
        boundingBox: table.boundingBox,
        screenshotPath: outputPath,
        extractedData: table.data,
        confidence: table.confidence || 0.95
      });

      console.log(`[VisualExtractor] ✓ Table ${i + 1}/${tables.length}: ${tableName}`);
    } catch (error) {
      console.error(`[VisualExtractor] Failed to screenshot table ${i + 1}:`, error);
    }
  }

  console.log(`[VisualExtractor] Successfully created ${screenshots.length}/${tables.length} table screenshots`);

  return screenshots;
}

/**
 * Extract screenshots for all figures with annotations
 *
 * @param pdfPath - Path to PDF file
 * @param figures - Array of extracted figures with locations
 * @param outputDir - Directory for screenshots
 * @returns Array of figure screenshots
 */
export async function extractFigureScreenshots(
  pdfPath: string,
  figures: Array<{
    name?: string;
    type?: string;
    page: number;
    boundingBox?: BoundingBox;
    data?: any;
    annotations?: any[];
  }>,
  outputDir: string
): Promise<FigureScreenshot[]> {
  console.log(`[VisualExtractor] Extracting screenshots for ${figures.length} figures...`);

  const screenshots: FigureScreenshot[] = [];

  for (let i = 0; i < figures.length; i++) {
    const figure = figures[i];

    if (!figure.boundingBox) {
      console.warn(`[VisualExtractor] Skipping figure ${i + 1} - no bounding box`);
      continue;
    }

    try {
      const figureName = figure.name || `figure_${i + 1}`;
      const outputPath = join(outputDir, `${figureName}_page${figure.page}.png`);

      await extractRegionScreenshot(
        pdfPath,
        figure.boundingBox,
        outputPath,
        {
          dpi: 300,
          format: 'png',
          addBorder: true,
          borderColor: '00AA00', // Green for figures
          borderWidth: 3
        }
      );

      // If figure has annotations (e.g., Kaplan-Meier data points), add them
      let annotatedPath = outputPath;
      if (figure.annotations && figure.annotations.length > 0) {
        annotatedPath = await addAnnotationsToImage(outputPath, figure.annotations);
      }

      screenshots.push({
        figureName,
        figureType: figure.type || 'unknown',
        pageNumber: figure.page,
        boundingBox: figure.boundingBox,
        screenshotPath: annotatedPath,
        extractedData: figure.data,
        annotations: figure.annotations
      });

      console.log(`[VisualExtractor] ✓ Figure ${i + 1}/${figures.length}: ${figureName}`);
    } catch (error) {
      console.error(`[VisualExtractor] Failed to screenshot figure ${i + 1}:`, error);
    }
  }

  console.log(`[VisualExtractor] Successfully created ${screenshots.length}/${figures.length} figure screenshots`);

  return screenshots;
}

/**
 * Add visual annotations to an image (e.g., data points on K-M curves)
 *
 * @param imagePath - Path to image file
 * @param annotations - Array of annotations to add
 * @returns Path to annotated image
 */
async function addAnnotationsToImage(
  imagePath: string,
  annotations: Array<{
    type: 'point' | 'line' | 'box';
    x?: number;
    y?: number;
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    color?: string;
    label?: string;
  }>
): Promise<string> {
  const outputPath = imagePath.replace(/\.png$/, '_annotated.png');

  try {
    // Use ImageMagick to add annotations
    let drawCommands: string[] = [];

    for (const annotation of annotations) {
      if (annotation.type === 'point' && annotation.x !== undefined && annotation.y !== undefined) {
        const color = annotation.color || 'red';
        // Draw circle at point
        drawCommands.push(`-fill ${color} -draw "circle ${annotation.x},${annotation.y} ${annotation.x + 5},${annotation.y}"`);

        // Add label if provided
        if (annotation.label) {
          drawCommands.push(`-fill ${color} -pointsize 12 -draw "text ${annotation.x + 10},${annotation.y} '${annotation.label}'"`);
        }
      } else if (annotation.type === 'line' && annotation.x1 !== undefined && annotation.y1 !== undefined && annotation.x2 !== undefined && annotation.y2 !== undefined) {
        const color = annotation.color || 'blue';
        drawCommands.push(`-stroke ${color} -strokewidth 2 -draw "line ${annotation.x1},${annotation.y1} ${annotation.x2},${annotation.y2}"`);
      }
    }

    if (drawCommands.length > 0) {
      const cmd = `convert "${imagePath}" ${drawCommands.join(' ')} "${outputPath}"`;
      await execAsync(cmd);
      return outputPath;
    }
  } catch (error) {
    console.error(`[VisualExtractor] Failed to add annotations:`, error);
  }

  return imagePath; // Return original if annotation failed
}

/**
 * Create full-page screenshots for all pages in PDF
 *
 * Useful for visual validation reports.
 *
 * @param pdfPath - Path to PDF file
 * @param outputDir - Directory for screenshots
 * @param maxPages - Maximum number of pages to screenshot (default: 10)
 * @returns Array of page screenshot paths
 */
export async function createPageScreenshots(
  pdfPath: string,
  outputDir: string,
  maxPages: number = 10
): Promise<string[]> {
  console.log(`[VisualExtractor] Creating page screenshots (max: ${maxPages})...`);

  const screenshots: string[] = [];

  try {
    // Ensure output directory exists
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    const tempPrefix = join(outputDir, 'page');

    // Convert all pages (up to maxPages)
    await execAsync(
      `pdftoppm -png -r 150 -f 1 -l ${maxPages} "${pdfPath}" "${tempPrefix}"`
    );

    // Find all generated files
    for (let i = 1; i <= maxPages; i++) {
      const pageFile = `${tempPrefix}-${i}.png`;
      if (existsSync(pageFile)) {
        screenshots.push(pageFile);
      }
    }

    console.log(`[VisualExtractor] ✓ Created ${screenshots.length} page screenshots`);
  } catch (error) {
    console.error(`[VisualExtractor] Failed to create page screenshots:`, error);
  }

  return screenshots;
}

/**
 * Extract highlighted regions for imaging metrics
 *
 * Creates screenshots showing where imaging values were found in the text.
 *
 * @param pdfPath - Path to PDF file
 * @param imagingData - Extracted imaging metrics with source locations
 * @param outputDir - Directory for screenshots
 * @returns Array of screenshot paths with metadata
 */
export async function extractImagingScreenshots(
  pdfPath: string,
  imagingData: {
    infarctVolume?: { value: number; page?: number; bbox?: BoundingBox };
    edemaVolume?: { value: number; page?: number; bbox?: BoundingBox };
    midlineShift?: { value: number; page?: number; bbox?: BoundingBox };
    [key: string]: any;
  },
  outputDir: string
): Promise<Array<{ field: string; screenshotPath: string; value: any }>> {
  console.log(`[VisualExtractor] Extracting imaging metric screenshots...`);

  const screenshots: Array<{ field: string; screenshotPath: string; value: any }> = [];

  for (const [field, data] of Object.entries(imagingData)) {
    if (!data || typeof data !== 'object') continue;
    if (!data.bbox || !data.page) continue;

    try {
      const outputPath = join(outputDir, `imaging_${field}_page${data.page}.png`);

      await extractRegionScreenshot(
        pdfPath,
        data.bbox,
        outputPath,
        {
          dpi: 300,
          format: 'png',
          addBorder: true,
          borderColor: 'FF6600', // Orange for imaging metrics
          borderWidth: 3
        }
      );

      screenshots.push({
        field,
        screenshotPath: outputPath,
        value: data.value
      });

      console.log(`[VisualExtractor] ✓ ${field}: ${data.value}`);
    } catch (error) {
      console.error(`[VisualExtractor] Failed to screenshot ${field}:`, error);
    }
  }

  console.log(`[VisualExtractor] Successfully created ${screenshots.length} imaging screenshots`);

  return screenshots;
}
