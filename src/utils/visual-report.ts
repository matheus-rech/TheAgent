/**
 * Visual Validation Report Generator
 *
 * Creates comprehensive HTML reports with screenshots for all extraction steps:
 * - Tables: Original PDF screenshot + extracted JSON
 * - Figures: Screenshot with annotations
 * - Citations: Highlighted text with provenance
 * - Imaging: Metrics with source screenshots
 * - Outcomes: Harmonization with confidence scores
 *
 * Used for visual quality assurance and validation during testing.
 */

import { writeFileSync } from 'fs';
import { basename } from 'path';
import type { ProcessingResult } from '../types/index.js';
import type { TableScreenshot, FigureScreenshot } from './visual-extractor.js';
import type { LocalizedCitation } from './citation-localizer.js';

/**
 * Visual validation report data
 */
export interface VisualValidationReport {
  /** Original PDF filename */
  pdfFilename: string;
  /** Extraction result */
  extractionResult: ProcessingResult;
  /** Table screenshots */
  tableScreenshots: TableScreenshot[];
  /** Figure screenshots */
  figureScreenshots: FigureScreenshot[];
  /** Localized citations with bounding boxes */
  citations: LocalizedCitation[];
  /** Imaging metric screenshots */
  imagingScreenshots: Array<{ field: string; screenshotPath: string; value: any }>;
  /** Page screenshots */
  pageScreenshots: string[];
  /** Report generation timestamp */
  timestamp: Date;
}

/**
 * Generate HTML visual validation report
 *
 * Creates a comprehensive HTML report with all screenshots and extracted data.
 *
 * @param report - Visual validation report data
 * @param outputPath - Output HTML file path
 */
export function generateVisualValidationHTML(
  report: VisualValidationReport,
  outputPath: string
): void {
  console.log(`[VisualReport] Generating HTML validation report...`);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TheAgent Visual Validation - ${report.pdfFilename}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      line-height: 1.6;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }

    .header .metadata {
      opacity: 0.9;
      font-size: 0.9rem;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }

    .summary-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .card {
      background: white;
      padding: 1.5rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .card h3 {
      color: #667eea;
      font-size: 0.9rem;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }

    .card .value {
      font-size: 2rem;
      font-weight: bold;
      color: #333;
    }

    .card .label {
      font-size: 0.85rem;
      color: #666;
      margin-top: 0.25rem;
    }

    .section {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 2rem;
    }

    .section h2 {
      color: #667eea;
      border-bottom: 3px solid #667eea;
      padding-bottom: 0.5rem;
      margin-bottom: 1.5rem;
    }

    .extraction-item {
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      background: #fafafa;
    }

    .extraction-item h3 {
      color: #333;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .confidence-badge {
      background: #4CAF50;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: bold;
    }

    .confidence-badge.medium {
      background: #FF9800;
    }

    .confidence-badge.low {
      background: #F44336;
    }

    .screenshot-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-top: 1rem;
    }

    .screenshot-container {
      background: white;
      border: 2px solid #ddd;
      border-radius: 8px;
      padding: 1rem;
    }

    .screenshot-container h4 {
      color: #666;
      font-size: 0.9rem;
      margin-bottom: 0.75rem;
      text-transform: uppercase;
    }

    .screenshot-container img {
      width: 100%;
      border: 1px solid #ddd;
      border-radius: 4px;
    }

    .extracted-data {
      background: #f0f0f0;
      border-left: 4px solid #667eea;
      padding: 1rem;
      border-radius: 4px;
      margin-top: 1rem;
    }

    .extracted-data pre {
      background: #2d2d2d;
      color: #f8f8f2;
      padding: 1rem;
      border-radius: 4px;
      overflow-x: auto;
      font-size: 0.85rem;
    }

    .citation-item {
      border-left: 4px solid #FF9800;
      padding: 1rem;
      margin-bottom: 1rem;
      background: white;
      border-radius: 4px;
    }

    .citation-item .citation-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 0.5rem;
    }

    .citation-index {
      background: #FF9800;
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-weight: bold;
      font-size: 0.9rem;
    }

    .citation-text {
      color: #555;
      font-style: italic;
      margin-top: 0.5rem;
      padding: 0.75rem;
      background: #f9f9f9;
      border-radius: 4px;
    }

    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }

    .metric-item {
      background: white;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      padding: 1rem;
      text-align: center;
    }

    .metric-item .metric-label {
      color: #666;
      font-size: 0.85rem;
      text-transform: uppercase;
      margin-bottom: 0.5rem;
    }

    .metric-item .metric-value {
      color: #667eea;
      font-size: 1.5rem;
      font-weight: bold;
    }

    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: bold;
    }

    .status-badge.success {
      background: #4CAF50;
      color: white;
    }

    .status-badge.warning {
      background: #FF9800;
      color: white;
    }

    .status-badge.error {
      background: #F44336;
      color: white;
    }

    .footer {
      text-align: center;
      padding: 2rem;
      color: #666;
      font-size: 0.9rem;
    }

    @media print {
      .screenshot-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧠 TheAgent Visual Validation Report</h1>
    <div class="metadata">
      <strong>PDF:</strong> ${report.pdfFilename} &nbsp;|&nbsp;
      <strong>Generated:</strong> ${report.timestamp.toLocaleString()} &nbsp;|&nbsp;
      <strong>Version:</strong> 0.2.0
    </div>
  </div>

  <div class="container">
    <!-- Summary Cards -->
    <div class="summary-cards">
      <div class="card">
        <h3>Modules Executed</h3>
        <div class="value">${report.extractionResult.modules_executed.length}</div>
        <div class="label">${report.extractionResult.modules_executed.join(', ')}</div>
      </div>

      <div class="card">
        <h3>Execution Time</h3>
        <div class="value">${(report.extractionResult.execution_time_ms / 1000).toFixed(1)}s</div>
        <div class="label">${report.extractionResult.execution_time_ms}ms total</div>
      </div>

      <div class="card">
        <h3>Tables Extracted</h3>
        <div class="value">${report.tableScreenshots.length}</div>
        <div class="label">${report.tableScreenshots.length} screenshots created</div>
      </div>

      <div class="card">
        <h3>Citations Found</h3>
        <div class="value">${report.citations.length}</div>
        <div class="label">${report.citations.filter(c => c.boundingBoxes.length > 0).length} localized</div>
      </div>

      <div class="card">
        <h3>Warnings</h3>
        <div class="value ${report.extractionResult.warnings.length > 0 ? 'style="color: #FF9800"' : ''}">${report.extractionResult.warnings.length}</div>
        <div class="label">Quality indicators</div>
      </div>

      <div class="card">
        <h3>Errors</h3>
        <div class="value ${report.extractionResult.errors.length > 0 ? 'style="color: #F44336"' : ''}">${report.extractionResult.errors.length}</div>
        <div class="label">Processing errors</div>
      </div>
    </div>

    ${generateStudyMetadataSection(report)}
    ${generateTableSection(report)}
    ${generateFigureSection(report)}
    ${generateCitationSection(report)}
    ${generateImagingSection(report)}
    ${generateOutcomeSection(report)}
    ${generateWarningsSection(report)}
  </div>

  <div class="footer">
    Generated by TheAgent v0.2.0 &nbsp;|&nbsp; Powered by Claude Agent SDK &nbsp;|&nbsp;
    <a href="https://docs.claude.com/en/api/agent-sdk/overview" target="_blank">Documentation</a>
  </div>
</body>
</html>`;

  writeFileSync(outputPath, html);
  console.log(`[VisualReport] ✓ Generated HTML report: ${outputPath}`);
}

/**
 * Generate study metadata section
 */
function generateStudyMetadataSection(report: VisualValidationReport): string {
  const data = report.extractionResult.data;

  return `
    <div class="section">
      <h2>📄 Study Metadata</h2>

      <div class="metric-grid">
        <div class="metric-item">
          <div class="metric-label">Study ID</div>
          <div class="metric-value">${data.study_id || 'N/A'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Authors</div>
          <div class="metric-value" style="font-size: 1rem;">${data.authors || 'N/A'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Year</div>
          <div class="metric-value">${data.year || 'N/A'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Study Design</div>
          <div class="metric-value" style="font-size: 1rem;">${data.study_design || 'N/A'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Sample Size</div>
          <div class="metric-value">${data.population?.sample_size || 'N/A'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Citations</div>
          <div class="metric-value" style="font-size: 0.9rem;">${data.citations?.length || 0} extracted</div>
        </div>
      </div>

      ${data.title ? `
        <div class="extracted-data">
          <strong>Title:</strong> ${data.title}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Generate table extraction section with screenshots
 */
function generateTableSection(report: VisualValidationReport): string {
  if (report.tableScreenshots.length === 0) {
    return '';
  }

  const tableItems = report.tableScreenshots.map((table) => {
    const confidenceBadge = getConfidenceBadgeClass(table.confidence);
    const tableDataJson = JSON.stringify(table.extractedData, null, 2);

    return `
      <div class="extraction-item">
        <h3>
          <span>${table.tableName} (Page ${table.pageNumber})</span>
          <span class="confidence-badge ${confidenceBadge}">
            ${(table.confidence * 100).toFixed(0)}% confidence
          </span>
        </h3>

        <div class="screenshot-grid">
          <div class="screenshot-container">
            <h4>📸 Original PDF Screenshot</h4>
            <img src="${makeRelativePath(table.screenshotPath)}" alt="${table.tableName}">
            <p style="margin-top: 0.5rem; color: #666; font-size: 0.85rem;">
              Bounding Box: [${table.boundingBox.left.toFixed(0)}, ${table.boundingBox.top.toFixed(0)},
              ${table.boundingBox.right.toFixed(0)}, ${table.boundingBox.bottom.toFixed(0)}]
            </p>
          </div>

          <div class="screenshot-container">
            <h4>📊 Extracted Data (JSON)</h4>
            <div class="extracted-data">
              <pre>${escapeHtml(tableDataJson)}</pre>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <h2>📊 Tables (${report.tableScreenshots.length})</h2>
      ${tableItems}
    </div>
  `;
}

/**
 * Generate figure extraction section with screenshots
 */
function generateFigureSection(report: VisualValidationReport): string {
  if (report.figureScreenshots.length === 0) {
    return '';
  }

  const figureItems = report.figureScreenshots.map((figure) => {
    const figureDataJson = figure.extractedData
      ? JSON.stringify(figure.extractedData, null, 2)
      : 'No data extracted';

    return `
      <div class="extraction-item">
        <h3>
          <span>${figure.figureName} - ${figure.figureType} (Page ${figure.pageNumber})</span>
        </h3>

        <div class="screenshot-grid">
          <div class="screenshot-container">
            <h4>📸 Figure Screenshot${figure.annotations ? ' (Annotated)' : ''}</h4>
            <img src="${makeRelativePath(figure.screenshotPath)}" alt="${figure.figureName}">
            ${figure.annotations ? `
              <p style="margin-top: 0.5rem; color: #666; font-size: 0.85rem;">
                ${figure.annotations.length} data points annotated
              </p>
            ` : ''}
          </div>

          <div class="screenshot-container">
            <h4>📊 Extracted Data</h4>
            <div class="extracted-data">
              <pre>${escapeHtml(figureDataJson)}</pre>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <h2>📈 Figures (${report.figureScreenshots.length})</h2>
      ${figureItems}
    </div>
  `;
}

/**
 * Generate citation section with provenance highlights
 */
function generateCitationSection(report: VisualValidationReport): string {
  if (report.citations.length === 0) {
    return '';
  }

  const citationItems = report.citations.map((citation) => {
    const confidenceBadge = getConfidenceBadgeClass(citation.locationConfidence);
    const boxCount = citation.boundingBoxes.length;
    const status = boxCount > 0 ? 'success' : 'error';

    return `
      <div class="citation-item">
        <div class="citation-header">
          <div>
            <span class="citation-index">[${citation.index}]</span>
            <strong>Page ${citation.pageNumber}</strong>
          </div>
          <div>
            <span class="confidence-badge ${confidenceBadge}">
              ${(citation.locationConfidence * 100).toFixed(0)}% confidence
            </span>
            <span class="status-badge ${status}">
              ${boxCount > 0 ? `${boxCount} box${boxCount > 1 ? 'es' : ''}` : 'Not localized'}
            </span>
          </div>
        </div>

        <div class="citation-text">
          "${citation.citedText}"
        </div>

        ${citation.boundingBoxes.length > 0 ? `
          <div style="margin-top: 0.75rem; font-size: 0.85rem; color: #666;">
            <strong>Bounding Boxes:</strong>
            ${citation.boundingBoxes.map((box) =>
              `[${box.left.toFixed(0)}, ${box.top.toFixed(0)}, ${box.right.toFixed(0)}, ${box.bottom.toFixed(0)}]`
            ).join(', ')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  const localizedCount = report.citations.filter(c => c.boundingBoxes.length > 0).length;
  const localizationRate = (localizedCount / report.citations.length * 100).toFixed(1);

  return `
    <div class="section">
      <h2>📚 Citations & Provenance (${report.citations.length})</h2>

      <div class="extracted-data" style="margin-bottom: 1.5rem;">
        <strong>Localization Success Rate:</strong> ${localizedCount}/${report.citations.length}
        (${localizationRate}%)
      </div>

      ${citationItems}
    </div>
  `;
}

/**
 * Generate imaging metrics section with source screenshots
 */
function generateImagingSection(report: VisualValidationReport): string {
  if (report.imagingScreenshots.length === 0) {
    return '';
  }

  const imagingItems = report.imagingScreenshots.map((item) => {
    return `
      <div class="extraction-item">
        <h3>${formatFieldName(item.field)}</h3>

        <div class="screenshot-grid">
          <div class="screenshot-container">
            <h4>📸 Source Region</h4>
            <img src="${makeRelativePath(item.screenshotPath)}" alt="${item.field}">
          </div>

          <div class="screenshot-container">
            <h4>📊 Extracted Value</h4>
            <div class="extracted-data">
              <div class="metric-value">${item.value}</div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="section">
      <h2>🧠 Imaging Metrics (${report.imagingScreenshots.length})</h2>
      ${imagingItems}
    </div>
  `;
}

/**
 * Generate outcome harmonization section
 */
function generateOutcomeSection(report: VisualValidationReport): string {
  const outcomes = report.extractionResult.data.outcomes;
  const harmonizedOutcomes = report.extractionResult.data.harmonized_outcomes;

  // Check if we have any outcome data to display
  if (!outcomes && !harmonizedOutcomes) {
    return '';
  }

  // Display raw outcomes (object with mortality, mRS_favorable, etc.)
  const rawOutcomesHtml = outcomes ? `
    <div class="extraction-item">
      <h3>Raw Outcomes</h3>
      <div class="metric-grid">
        <div class="metric-item">
          <div class="metric-label">Mortality</div>
          <div class="metric-value">${outcomes.mortality || 'N/A'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">mRS Favorable</div>
          <div class="metric-value">${outcomes.mRS_favorable || 'N/A'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Complications</div>
          <div class="metric-value">${outcomes.complications || 'N/A'}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Length of Stay</div>
          <div class="metric-value">${outcomes.length_of_stay || 'N/A'}</div>
        </div>
      </div>
    </div>
  ` : '';

  // Display harmonized outcomes (array of timepoints)
  let harmonizedHtml = '';
  if (harmonizedOutcomes && harmonizedOutcomes.timepoints && harmonizedOutcomes.timepoints.length > 0) {
    const confidenceBadge = getConfidenceBadgeClass(
      harmonizedOutcomes.confidence === 'high' ? 0.95 :
      harmonizedOutcomes.confidence === 'medium' ? 0.75 : 0.5
    );

    const timepointItems = harmonizedOutcomes.timepoints.map((tp) => `
      <div class="extraction-item">
        <h4>${tp.days} Days</h4>
        <div class="metric-grid">
          <div class="metric-item">
            <div class="metric-label">Mortality</div>
            <div class="metric-value">${tp.mortality !== undefined ? `${(tp.mortality * 100).toFixed(1)}%` : 'N/A'}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">mRS 0-2</div>
            <div class="metric-value">${tp.mRS_0_2 !== undefined ? `${(tp.mRS_0_2 * 100).toFixed(1)}%` : 'N/A'}</div>
          </div>
          <div class="metric-item">
            <div class="metric-label">mRS 0-3</div>
            <div class="metric-value">${tp.mRS_0_3 !== undefined ? `${(tp.mRS_0_3 * 100).toFixed(1)}%` : 'N/A'}</div>
          </div>
        </div>
      </div>
    `).join('');

    harmonizedHtml = `
      <div class="extraction-item">
        <h3>
          <span>Harmonized Outcomes</span>
          <span class="confidence-badge ${confidenceBadge}">
            ${harmonizedOutcomes.confidence} confidence
          </span>
        </h3>
        ${timepointItems}
        ${harmonizedOutcomes.conversions_applied && harmonizedOutcomes.conversions_applied.length > 0 ? `
          <div class="extracted-data">
            <strong>Conversions Applied:</strong>
            <ul style="margin-top: 0.5rem; margin-left: 1.5rem;">
              ${harmonizedOutcomes.conversions_applied.map((c: string) => `<li>${c}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  const totalItems = (outcomes ? 1 : 0) + (harmonizedOutcomes?.timepoints?.length || 0);

  return `
    <div class="section">
      <h2>⚕️ Outcome Data (${totalItems} sections)</h2>
      ${rawOutcomesHtml}
      ${harmonizedHtml}
    </div>
  `;
}

/**
 * Generate warnings and errors section
 */
function generateWarningsSection(report: VisualValidationReport): string {
  const hasWarnings = report.extractionResult.warnings.length > 0;
  const hasErrors = report.extractionResult.errors.length > 0;

  if (!hasWarnings && !hasErrors) {
    return `
      <div class="section">
        <h2>✅ Quality Validation</h2>
        <div class="extraction-item" style="text-align: center; padding: 2rem;">
          <h3 style="color: #4CAF50;">No Warnings or Errors</h3>
          <p style="color: #666; margin-top: 0.5rem;">Extraction completed successfully with no issues detected.</p>
        </div>
      </div>
    `;
  }

  const warningItems = report.extractionResult.warnings.map((warning) => `
    <div style="padding: 0.75rem; background: #FFF3CD; border-left: 4px solid #FF9800; margin-bottom: 0.5rem; border-radius: 4px;">
      ⚠️  ${warning}
    </div>
  `).join('');

  const errorItems = report.extractionResult.errors.map((error) => `
    <div style="padding: 0.75rem; background: #F8D7DA; border-left: 4px solid #F44336; margin-bottom: 0.5rem; border-radius: 4px;">
      ❌ ${error}
    </div>
  `).join('');

  return `
    <div class="section">
      <h2>⚠️  Warnings & Errors</h2>

      ${hasWarnings ? `
        <h3 style="margin-bottom: 1rem;">Warnings (${report.extractionResult.warnings.length})</h3>
        ${warningItems}
      ` : ''}

      ${hasErrors ? `
        <h3 style="margin-bottom: 1rem; margin-top: 1.5rem;">Errors (${report.extractionResult.errors.length})</h3>
        ${errorItems}
      ` : ''}
    </div>
  `;
}

// Helper functions

function getConfidenceBadgeClass(confidence: number): string {
  if (confidence >= 0.8) return '';
  if (confidence >= 0.6) return 'medium';
  return 'low';
}

function makeRelativePath(absolutePath: string): string {
  // Convert absolute path to relative for HTML
  return basename(absolutePath);
}

function formatFieldName(field: string): string {
  return field
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

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
