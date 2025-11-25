import type { McpServerConfig } from '@anthropic-ai/claude-agent-sdk';

export const MCP_SERVERS: Record<string, McpServerConfig> = {
  docling: {
    command: 'uvx',
    args: ['--from=docling-mcp', 'docling-mcp-server', '--transport', 'stdio'],
    env: {},
  },
};

export function isMcpEnabled(serverName: string): boolean {
  const envKey = `${serverName.toUpperCase()}_MCP_ENABLED`;
  return process.env[envKey] === 'true';
}
