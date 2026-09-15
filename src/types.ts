export interface McpConnectorConfig {
  url: string
  callbackPort?: number
}

export interface McpConfig {
  [connector: string]: McpConnectorConfig
}

export interface ProviderConfig {
  baseUrl: string
  model: string
  apiKeyEnv: string
}

export interface ProvidersConfig {
  default: string
  [name: string]: string | ProviderConfig
}

export type { AiRequest } from "./schemas.js"

export interface HealthResponse {
  status: string
  mcps: string[]
  providers: string[]
}

export interface AiResponse {
  response: string
}

export interface SkillsResponse {
  skills: string[]
}

export interface McpToolsResponse {
  connector: string
  tools: Array<{ name: string; description: string }>
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }

export type MessageContent = string | ContentPart[]

export interface ChatMessage {
  role: string
  content: MessageContent
}

// OpenAI-compatible chat completion response (from CLIProxyAPI / OpenRouter)
export interface ChatCompletionResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string | null
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}
