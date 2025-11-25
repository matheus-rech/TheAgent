#!/usr/bin/env node

/**
 * TheAgent CLI - Command-line interface for medical research data extraction
 */

import { Command } from 'commander';
import { TheAgent } from './index.js';
import type { ModuleName } from './types/index.js';
import { writeFileSync } from 'fs';
import dotenv from 'dotenv';
import { AGENT_CONFIGS } from './agents/config.js';
import { MCP_SERVERS, isMcpEnabled } from './agents/mcp-config.js';

// Load environment variables
dotenv.config();

const program = new Command();

program
  .name('theagent')
  .description('Hybrid medical research data extraction agent (Agent SDK powered)')
  .version('0.2.0');

/**
 * Process a single PDF
 */
program
  .command('process')
  .description('Process a single research paper PDF')
  .argument('<pdf>', 'Path to PDF file')
  .option('-o, --output <file>', 'Output JSON file (default: <study_id>.json)')
  .option('-m, --modules <modules>', 'Comma-separated list of modules to enable', 'all')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .option('--model <model>', 'Claude model to use', 'claude-sonnet-4-5-20250929')
  .action(async (pdfPath: string, options) => {
    console.log('🧠 TheAgent - Starting extraction...\n');

    try {
      // Parse modules
      const modules: ModuleName[] = options.modules === 'all'
        ? ['full-pdf', 'tables', 'imaging', 'harmonizer', 'ipd', 'fuser']
        : options.modules.split(',').map((m: string) => m.trim() as ModuleName);

      // Initialize agent
      const agent = new TheAgent({
        modules,
        verbose: options.verbose,
        model: options.model,
      });

      // Process paper
      const result = await agent.processPaper(pdfPath);

      // Display summary
      console.log('\n✅ Extraction complete!\n');
      console.log(`📊 Modules executed: ${result.modules_executed.join(', ')}`);
      console.log(`⏱️  Time: ${result.execution_time_ms}ms`);

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
        result.warnings.forEach((w) => console.log(`   - ${w}`));
      }

      if (result.errors.length > 0) {
        console.log(`\n❌ Errors (${result.errors.length}):`);
        result.errors.forEach((e) => console.log(`   - ${e}`));
      }

      // Determine output file
      const outputFile = options.output || `${result.data.study_id || 'extraction'}.json`;

      // Save to file
      writeFileSync(outputFile, JSON.stringify(result.data, null, 2));
      console.log(`\n💾 Saved to: ${outputFile}`);

      // Show key extracted data
      console.log('\n📄 Key Data:');
      console.log(`   Study: ${result.data.authors} ${result.data.year}`);
      console.log(`   Title: ${result.data.title?.slice(0, 60)}...`);
      console.log(`   Design: ${result.data.study_design}`);
      if (result.data.tables) {
        console.log(`   Tables: ${result.data.tables.length}`);
      }
      if (result.data.ipd) {
        console.log(`   IPD: ${result.data.ipd.length} patients reconstructed`);
      }
    } catch (error) {
      console.error('\n❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Process multiple sources and fuse them
 */
program
  .command('fuse')
  .description('Process multiple sources and fuse them together')
  .argument('<sources...>', 'PDF files (format: type:path, e.g., main:paper.pdf supplement:supp.pdf)')
  .option('-o, --output <file>', 'Output JSON file', 'fused-extraction.json')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (sourcesArgs: string[], options) => {
    console.log('🔄 TheAgent - Multi-source fusion...\n');

    try {
      // Parse sources
      const sources = sourcesArgs.map((arg) => {
        const [type, path] = arg.split(':');
        if (!path) {
          throw new Error(`Invalid source format: ${arg}. Use type:path (e.g., main:paper.pdf)`);
        }
        return {
          type: type as 'main-paper' | 'supplement' | 'erratum' | 'protocol' | 'registry',
          pdfPath: path,
        };
      });

      console.log(`Processing ${sources.length} sources:`);
      sources.forEach((s) => console.log(`  - ${s.type}: ${s.pdfPath}`));
      console.log();

      // Initialize agent
      const agent = new TheAgent({
        verbose: options.verbose,
      });

      // Process and fuse
      const result = await agent.processMultiSource(sources);

      // Display summary
      console.log('\n✅ Fusion complete!\n');
      console.log(`📊 Modules executed: ${result.modules_executed.join(', ')}`);
      console.log(`⏱️  Time: ${result.execution_time_ms}ms`);

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings (${result.warnings.length}):`);
        result.warnings.forEach((w) => console.log(`   - ${w}`));
      }

      // Save
      writeFileSync(options.output, JSON.stringify(result.data, null, 2));
      console.log(`\n💾 Saved to: ${options.output}`);
    } catch (error) {
      console.error('\n❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * Run visual testing pipeline
 */
program
  .command('visual-test')
  .description('Run automated visual testing pipeline with screenshots and HTML report')
  .argument('<pdf>', 'Path to PDF file')
  .option('-o, --output <dir>', 'Output directory for screenshots and reports')
  .option('-m, --modules <modules>', 'Comma-separated list of modules to enable', 'all')
  .option('--no-report', 'Skip HTML report generation', false)
  .option('--no-annotated-pdf', 'Skip annotated PDF creation', false)
  .option('--no-page-screenshots', 'Skip full-page screenshots', false)
  .option('--max-pages <number>', 'Maximum pages for full-page screenshots', '10')
  .option('--dpi <number>', 'Screenshot resolution in DPI', '300')
  .option('-v, --verbose', 'Enable verbose logging', false)
  .action(async (pdfPath: string, options) => {
    console.log('🧪 TheAgent - Visual Testing Pipeline\n');

    try {
      // Parse modules
      const modules: ModuleName[] = options.modules === 'all'
        ? ['full-pdf', 'tables', 'imaging', 'harmonizer', 'ipd']
        : options.modules.split(',').map((m: string) => m.trim() as ModuleName);

      // Import visual testing pipeline
      const { runVisualTestingPipeline } = await import('./utils/visual-testing-pipeline.js');

      // Run visual testing
      const result = await runVisualTestingPipeline(pdfPath, {
        outputDir: options.output,
        modules,
        generateReport: options.report !== false,
        generateAnnotatedPDF: options.annotatedPdf !== false,
        createPageScreenshots: options.pageScreenshots !== false,
        maxPages: parseInt(options.maxPages),
        verbose: options.verbose,
        screenshotDPI: parseInt(options.dpi),
      });

      // Display summary (only if not verbose, as verbose mode already prints)
      if (!options.verbose) {
        console.log('✅ Visual Testing Complete!\n');
        console.log(`📄 PDF: ${result.summary.pdfFilename}`);
        console.log(`⏱️  Execution Time: ${(result.summary.executionTimeMs / 1000).toFixed(2)}s`);
        console.log(`📊 Modules: ${result.summary.modulesExecuted.join(', ')}`);
        console.log(`📸 Screenshots: ${result.screenshots.total} total`);
        console.log(`   - Tables: ${result.screenshots.tables}`);
        console.log(`   - Figures: ${result.screenshots.figures}`);
        console.log(`   - Imaging: ${result.screenshots.imaging}`);
        console.log(`   - Citations: ${result.screenshots.citations}`);
        console.log(`   - Pages: ${result.screenshots.pages}`);
        console.log(`\n📁 Output Directory: ${result.screenshotDir}`);

        if (result.reportPath) {
          console.log(`\n📊 HTML Report: ${result.reportPath}`);
          console.log(`   Open in browser: open "${result.reportPath}"`);
        }

        if (result.annotatedPdfPath) {
          console.log(`\n📝 Annotated PDF: ${result.annotatedPdfPath}`);
        }

        if (result.summary.warnings > 0) {
          console.log(`\n⚠️  Warnings: ${result.summary.warnings}`);
        }

        if (result.summary.errors > 0) {
          console.log(`\n❌ Errors: ${result.summary.errors}`);
        }
      }
    } catch (error) {
      console.error('\n❌ Error:', error);
      process.exit(1);
    }
  });

/**
 * List available modules
 */
program
  .command('modules')
  .description('List all available extraction modules')
  .action(() => {
    console.log('📦 Available Modules:\n');

    const modules = [
      {
        name: 'full-pdf',
        desc: 'Extract from all pages (Methods, Results, Discussion)',
      },
      {
        name: 'tables',
        desc: 'Extract tables and figures using Docling MCP or vision',
      },
      {
        name: 'imaging',
        desc: 'Extract neuroimaging metrics (infarct volume, edema, etc.)',
      },
      {
        name: 'harmonizer',
        desc: 'Standardize outcomes to common timepoints and definitions',
      },
      {
        name: 'ipd',
        desc: 'Reconstruct individual patient data from Kaplan-Meier curves',
      },
      {
        name: 'fuser',
        desc: 'Combine data from multiple sources with conflict resolution',
      },
    ];

    modules.forEach((m) => {
      console.log(`  ${m.name.padEnd(12)} - ${m.desc}`);
    });

    console.log('\nUsage: theagent process <pdf> --modules full-pdf,tables,imaging');
  });

/**
 * Check configuration
 */
program
  .command('config')
  .description('Check TheAgent configuration')
  .action(() => {
    console.log('⚙️  Configuration:\n');

    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log(`  ANTHROPIC_API_KEY: ${apiKey ? '✅ Set' : '❌ Not set'}`);

    // Agent SDK Status
    console.log(`\n  🤖 Agent SDK: ✅ Active`);
    console.log(`  Configured Agents: ${Object.keys(AGENT_CONFIGS).length}`);
    console.log(`  Agent List:`);
    Object.entries(AGENT_CONFIGS).forEach(([_key, config]) => {
      console.log(`    - ${config.name} (${config.model})`);
    });

    // MCP Servers
    console.log(`\n  🔌 MCP Servers:`);
    const mcpServerList = Object.keys(MCP_SERVERS);
    mcpServerList.forEach((serverName) => {
      const enabled = isMcpEnabled(serverName);
      console.log(`    - ${serverName}: ${enabled ? '✅ Enabled' : '⚠️  Disabled'}`);
    });

    const doclingEnabled = process.env.DOCLING_MCP_ENABLED === 'true';

    const firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
    console.log(`\n  Firebase: ${firebaseProjectId ? `✅ ${firebaseProjectId}` : '⚠️  Not configured'}`);

    if (!apiKey) {
      console.log('\n❌ ANTHROPIC_API_KEY is required!');
      console.log('   Get your key from: https://console.anthropic.com/');
      console.log('   Then set it in .env file');
    }

    if (!doclingEnabled) {
      console.log('\n⚠️  Docling MCP is disabled. Table extraction will use fallback method.');
      console.log('   To enable: Set DOCLING_MCP_ENABLED=true in .env');
      console.log('   Install: uvx --from=docling-mcp docling-mcp-server');
    }

    console.log('\n📊 Summary:');
    console.log(`   Total Agents: ${Object.keys(AGENT_CONFIGS).length}`);
    console.log(`   MCP Servers Available: ${mcpServerList.length}`);
    console.log(`   MCP Servers Enabled: ${mcpServerList.filter(s => isMcpEnabled(s)).length}`);
  });

program.parse();
