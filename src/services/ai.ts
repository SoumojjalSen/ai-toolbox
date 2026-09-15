import { providers } from "../config.js"
import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"
import type { MessageContent, ChatMessage, ChatCompletionResponse } from "../types.js"

const MAX_TOKENS = 16384

function resolveProvider(providerName?: string) {
  const resolvedName = providerName || providers.default
  const providerConfig = providers[resolvedName]

  if (!providerConfig || typeof providerConfig === "string") {
    throw new AppError(HttpStatus.BAD_REQUEST, ErrorCode.UNKNOWN_PROVIDER, `Unknown provider: ${resolvedName}`)
  }

  return { name: resolvedName, config: providerConfig }
}

function buildMessages(content: MessageContent, systemPrompt?: string) {
  const messages: ChatMessage[] = []
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt })
  messages.push({ role: "user", content })
  return messages
}

export async function callAi(
  content: MessageContent,
  providerName?: string,
  systemPrompt?: string,
): Promise<string> {
  const provider = resolveProvider(providerName)
  const messages = buildMessages(content, systemPrompt)
  const apiKey = provider.config.apiKeyEnv ? process.env[provider.config.apiKeyEnv] : ""

  const response = await fetch(`${provider.config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.config.model,
      messages,
      max_tokens: MAX_TOKENS,
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new AppError(
      HttpStatus.BAD_GATEWAY,
      ErrorCode.PROVIDER_ERROR,
      `AI provider ${provider.name} error: ${response.status} ${errorBody}`,
    )
  }

  const data: ChatCompletionResponse = await response.json()
  return data.choices[0]?.message.content || ""
}
