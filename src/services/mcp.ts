import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mcpConfig, denyTools, pkg } from "../config.js"
import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"

const MCP_REMOTE_VERSION = "mcp-remote@0.1.38"

function getConnectorConfig(connectorName: string) {
  const config = mcpConfig[connectorName]
  if (!config) {
    throw new AppError(HttpStatus.NOT_FOUND, ErrorCode.UNKNOWN_MCP_SERVER, `Unknown MCP connector: ${connectorName}`)
  }
  return config
}

async function createClient(connectorName: string) {
  const config = getConnectorConfig(connectorName)
  const client = new Client({ name: pkg.name, version: pkg.version })
  const transport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y",
      MCP_REMOTE_VERSION,
      config.url,
      ...(config.callbackPort ? [String(config.callbackPort)] : []),
    ],
  })
  await client.connect(transport)
  return client
}

export async function invokeMcpTool(
  connectorName: string,
  toolName: string,
  args: Record<string, unknown> = {},
) {
  if (denyTools.has(toolName)) {
    throw new AppError(HttpStatus.FORBIDDEN, ErrorCode.BLOCKED_TOOL, `Blocked tool: ${toolName}`)
  }

  const client = await createClient(connectorName)
  try {
    return await client.callTool({ name: toolName, arguments: args })
  } finally {
    try { await client.close() } catch {}
  }
}

export async function listMcpTools(connectorName: string) {
  const client = await createClient(connectorName)
  try {
    const result = await client.listTools()
    return result.tools
      .filter((t) => !denyTools.has(t.name))
      .map((t) => ({ name: t.name, description: t.description }))
  } finally {
    try { await client.close() } catch {}
  }
}
