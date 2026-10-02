import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js"
import { mcpConnectorsConfig, deniedToolNames, packageJson } from "../config.js"
import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"

const MCP_REMOTE_VERSION = "mcp-remote@0.1.38"

function getMcpConnectorConfig(connectorName: string) {
  const connectorConfig = mcpConnectorsConfig[connectorName]
  if (!connectorConfig) {
    throw new AppError(HttpStatus.NOT_FOUND, ErrorCode.UNKNOWN_MCP_SERVER, `Unknown MCP connector: ${connectorName}`)
  }
  return connectorConfig
}

async function connectToMcpConnector(connectorName: string) {
  const connectorConfig = getMcpConnectorConfig(connectorName)
  const mcpClient = new Client({ name: packageJson.name, version: packageJson.version })
  const stdioTransport = new StdioClientTransport({
    command: "npx",
    args: [
      "-y",
      MCP_REMOTE_VERSION,
      connectorConfig.url,
      ...(connectorConfig.callbackPort ? [String(connectorConfig.callbackPort)] : []),
    ],
  })
  await mcpClient.connect(stdioTransport)
  return mcpClient
}

export async function invokeMcpTool(
  connectorName: string,
  toolName: string,
  toolArguments: Record<string, unknown> = {},
) {
  if (deniedToolNames.has(toolName)) {
    throw new AppError(HttpStatus.FORBIDDEN, ErrorCode.BLOCKED_TOOL, `Blocked tool: ${toolName}`)
  }

  const mcpClient = await connectToMcpConnector(connectorName)
  try {
    return await mcpClient.callTool({ name: toolName, arguments: toolArguments })
  } finally {
    try { await mcpClient.close() } catch {}
  }
}

export async function listMcpTools(connectorName: string) {
  const mcpClient = await connectToMcpConnector(connectorName)
  try {
    const toolListResult = await mcpClient.listTools()
    return toolListResult.tools
      .filter((tool) => !deniedToolNames.has(tool.name))
      .map((tool) => ({ name: tool.name, description: tool.description }))
  } finally {
    try { await mcpClient.close() } catch {}
  }
}
