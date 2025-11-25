# Docling MCP Setup Guide

This guide shows you how to set up Docling MCP for advanced table and figure extraction in TheAgent.

## What is Docling MCP?

[Docling](https://github.com/docling-project/docling) is a document processing library with vision-first layout understanding. The MCP server allows Claude agents to use Docling's capabilities through the Model Context Protocol.

**Benefits for TheAgent:**
- ✅ Accurate table structure extraction (headers, merged cells)
- ✅ Figure detection and classification
- ✅ Layout-aware document parsing
- ✅ Support for complex PDF formats

## Installation

### Option 1: Using uvx (Recommended)

```bash
# Install and run Docling MCP server
uvx --from=docling-mcp docling-mcp-server --transport stdio
```

### Option 2: Using pip

```bash
# Install the package
pip install docling-mcp

# Run the server
docling-mcp-server --transport stdio
```

## Configuration

### For Claude Desktop

If you want to use Docling with Claude Desktop (in addition to TheAgent), add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "docling": {
      "command": "uvx",
      "args": [
        "--from=docling-mcp",
        "docling-mcp-server"
      ]
    }
  }
}
```

**Config file location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

### For TheAgent

1. Enable Docling in your `.env` file:

```env
DOCLING_MCP_ENABLED=true
```

2. Ensure Docling is installed:

```bash
# Test that Docling is accessible
uvx --from=docling-mcp docling-mcp-server --help
```

## Using Docling with TheAgent

Once configured, TheAgent will automatically use Docling for table extraction when available.

```bash
# Process a PDF with Docling-powered table extraction
npm run cli -- process paper.pdf --modules tables

# Check if Docling is properly configured
npm run cli -- config
```

You should see:
```
⚙️  Configuration:

  ANTHROPIC_API_KEY: ✅ Set
  Docling MCP: ✅ Enabled
```

## Implementing Docling Integration

The Table & Figure Extractor module has a placeholder for Docling integration. Here's how to implement it:

### Step 1: Install MCP Client SDK

```bash
npm install @modelcontextprotocol/sdk
```

### Step 2: Connect to Docling MCP

In `src/modules/table-figure-extractor.ts`, implement the `extractWithDocling` method:

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

private async extractWithDocling(
  input: TableFigureInput,
  options?: ExtractionOptions
): Promise<TableExtractionResult> {
  // Create MCP client
  const transport = new StdioClientTransport({
    command: 'uvx',
    args: ['--from=docling-mcp', 'docling-mcp-server'],
  });

  const client = new Client({
    name: 'theagent-table-extractor',
    version: '1.0.0',
  }, {
    capabilities: {
      tools: {},
    },
  });

  await client.connect(transport);

  try {
    // List available tools
    const tools = await client.listTools();
    console.log('Docling tools:', tools);

    // Use Docling to convert PDF to structured format
    const result = await client.callTool({
      name: 'convert_document',
      arguments: {
        source: input.pdfPath,
        output_format: 'json',
      },
    });

    // Parse the result and extract tables
    const doclingData = JSON.parse(result.content[0].text);
    const tables = doclingData.tables.map((t: any, idx: number) =>
      this.parseDoclingTable(t, idx + 1)
    );

    return {
      tables,
      extraction_method: 'docling',
      confidence: 0.95,
    };
  } finally {
    await client.close();
  }
}
```

### Step 3: Parse Docling Output

Implement the `parseDoclingTable` method to convert Docling's JSON format to your TableData type:

```typescript
private parseDoclingTable(doclingTable: any, pageNum: number): TableData {
  return {
    table_number: doclingTable.index || 0,
    title: doclingTable.caption || '',
    page: pageNum,
    headers: doclingTable.data[0] || [],
    rows: doclingTable.data.slice(1) || [],
    caption: doclingTable.caption,
    extracted_type: 'docling',
  };
}
```

## Troubleshooting

### Docling MCP not found

```bash
# Make sure uvx is installed
pip install uv

# Or use pip to install Docling directly
pip install docling-mcp
```

### Permission errors

```bash
# On macOS/Linux, make sure the script is executable
chmod +x $(which docling-mcp-server)
```

### Connection timeout

```bash
# Test Docling server manually
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | \
  uvx --from=docling-mcp docling-mcp-server --transport stdio
```

You should see a JSON response with available tools.

## Alternative: Vision-based Fallback

If Docling is not available or fails, TheAgent will fall back to Claude vision API for table extraction. This is slower and less accurate but doesn't require external dependencies.

The fallback is automatically enabled when:
- `DOCLING_MCP_ENABLED=false` in `.env`
- Docling MCP server is not installed
- Docling extraction fails

## Resources

- [Docling GitHub](https://github.com/docling-project/docling)
- [Docling MCP Documentation](https://docling-project.github.io/docling/usage/mcp/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs)

## Next Steps

1. Install Docling MCP
2. Enable in `.env`
3. Implement the integration in `table-figure-extractor.ts`
4. Test with real medical papers
5. Compare results with vision fallback

For questions or issues, see the [Docling GitHub Issues](https://github.com/docling-project/docling-mcp/issues).
