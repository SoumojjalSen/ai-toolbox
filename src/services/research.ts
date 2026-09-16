import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"
import type { ResearchResult } from "../types.js"

const GEMINI_MODEL = "gemini-3.5-flash"
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/interactions"

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY
  if (!key) {
    throw new AppError(HttpStatus.INTERNAL_SERVER_ERROR, ErrorCode.MISSING_API_KEY, "GEMINI_API_KEY not configured")
  }
  return key
}

interface InteractionResponse {
  output?: {
    text?: string
  }
  groundingMetadata?: {
    groundingChunks?: Array<{ web?: { uri: string; title: string } }>
    webSearchQueries?: string[]
  }
}

export async function research(query: string): Promise<ResearchResult> {
  const apiKey = getApiKey()

  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      input: query,
      tools: [{ type: "google_search" }],
    }),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    throw new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.RESEARCH_FAILED, `Gemini error: ${response.status} ${errorBody}`)
  }

  const data: InteractionResponse = await response.json()

  const text = data.output?.text || ""
  if (!text) {
    throw new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.RESEARCH_FAILED, "Gemini returned no results")
  }

  const grounding = data.groundingMetadata
  const sources = (grounding?.groundingChunks || [])
    .filter((chunk) => chunk.web)
    .map((chunk) => ({
      url: chunk.web!.uri,
      title: chunk.web!.title,
    }))

  const queries = grounding?.webSearchQueries || []

  return { response: text, sources, queries }
}
