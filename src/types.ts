export interface McpConnectorConfig {
  url: string
  callbackPort?: number
}

export interface McpConfig {
  [connector: string]: McpConnectorConfig
}
