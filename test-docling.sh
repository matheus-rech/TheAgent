#!/bin/bash
# Test Docling MCP server
echo "Testing Docling MCP server..."
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | uvx --from=docling-mcp docling-mcp-server --transport stdio
