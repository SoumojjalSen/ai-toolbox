import { execFile } from "child_process"
import { ROOT } from "../config.js"
import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"
import { log } from "../log.js"

const CLAUDE_MODEL = "claude-opus-5-5"
// market-analyst takes ~7 min (30+ searches); 15 min leaves headroom on busy news days
const CLAUDE_TIMEOUT_MS = 15 * 60 * 1000
const CLAUDE_MAX_BUFFER = 64 * 1024 * 1024
// Web + skills only — no Bash/Read/Edit, so a prompt-injected web page can't touch the container
const CLAUDE_ALLOWED_TOOLS = "WebSearch,WebFetch,Skill"

// http(s) URLs are downloaded here, not by Anthropic: it can't reach localhost/private URLs
// (e.g. n8n binaries) and some sites block its fetcher.
async function convertImageUrlToBase64Source(imageUrl: string) {
  const dataUrlMatch = imageUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (dataUrlMatch) return { type: "base64", media_type: dataUrlMatch[1], data: dataUrlMatch[2] }

  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) {
    throw new AppError(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, `Image download failed: ${imageResponse.status} ${imageUrl}`)
  }
  const mediaType = imageResponse.headers.get("content-type")?.split(";")[0] || "image/png"
  const base64Data = Buffer.from(await imageResponse.arrayBuffer()).toString("base64")
  return { type: "base64", media_type: mediaType, data: base64Data }
}

interface ClaudeStreamEvent {
  type: string
  message?: { content?: Array<{ type: string; name?: string }> }
  // only on the final "result" event
  is_error?: boolean
  result?: string
  duration_ms?: number
  session_id?: string
}

export interface AiResponse {
  text: string
  // Claude Code session file for this run — full research path, kept 7 days (see Dockerfile)
  sessionId: string
}

// stream-json stdout is one JSON event per line; the last "result" event carries the answer
function parseClaudeOutput(stdout: string) {
  let finalResult: ClaudeStreamEvent | undefined
  let searchCount = 0
  let fetchCount = 0

  for (const line of stdout.split("\n")) {
    let streamEvent: ClaudeStreamEvent
    try {
      streamEvent = JSON.parse(line)
    } catch {
      continue
    }
    if (streamEvent.type === "result") finalResult = streamEvent
    for (const contentBlock of streamEvent.message?.content ?? []) {
      if (contentBlock.type !== "tool_use") continue
      if (contentBlock.name === "WebSearch") searchCount++
      if (contentBlock.name === "WebFetch") fetchCount++
    }
  }
  return { finalResult, searchCount, fetchCount }
}

// Headless Claude Code, authed by CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`).
// Prompt goes over stdin as stream-json so images and large prompts work.
// cwd is ROOT so Claude Code picks up the native skills in ROOT/.claude/skills.
// Each run's full path (searches, pages, answer) is Claude Code's session file, kept 7 days:
//   docker exec -it ai-toolbox claude --resume <sessionId>
export async function generateAiResponse(prompt: string, imageUrls: string[] = [], systemPrompt?: string): Promise<AiResponse> {
  const cliArgs = [
    "-p",
    "--input-format", "stream-json",
    "--output-format", "stream-json",
    "--verbose",
    "--model", CLAUDE_MODEL,
    "--tools", CLAUDE_ALLOWED_TOOLS,
    "--allowedTools", CLAUDE_ALLOWED_TOOLS,
  ]
  if (systemPrompt) cliArgs.push("--append-system-prompt", systemPrompt)

  const imageBlocks = await Promise.all(
    imageUrls.map(async (imageUrl) => ({ type: "image", source: await convertImageUrlToBase64Source(imageUrl) })),
  )
  const messageContent = [...imageBlocks, { type: "text", text: prompt }]
  const stdinMessage = JSON.stringify({ type: "user", message: { role: "user", content: messageContent } })

  return new Promise((resolve, reject) => {
    const claudeProcess = execFile(
      "claude",
      cliArgs,
      { cwd: ROOT, timeout: CLAUDE_TIMEOUT_MS, maxBuffer: CLAUDE_MAX_BUFFER },
      (processError, stdout, stderr) => {
        const { finalResult, searchCount, fetchCount } = parseClaudeOutput(stdout)
        const sessionId = finalResult?.session_id ?? "none"

        if (finalResult && !finalResult.is_error) {
          const durationSeconds = Math.round((finalResult.duration_ms ?? 0) / 1000)
          log(`claude: done in ${durationSeconds}s · ${searchCount} searches · ${fetchCount} pages · session ${sessionId}`)
          return resolve({ text: finalResult.result || "", sessionId })
        }

        const timedOut = processError?.killed ? `timed out after ${CLAUDE_TIMEOUT_MS / 1000}s` : ""
        const errorDetail = finalResult?.result || timedOut || stderr.trim() || processError?.message || "no output"
        log(`claude: failed — ${errorDetail} · session ${sessionId}`)
        reject(new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.PROVIDER_ERROR, `Claude error: ${errorDetail} (session ${sessionId})`))
      },
    )
    claudeProcess.stdin?.end(stdinMessage + "\n")
  })
}
