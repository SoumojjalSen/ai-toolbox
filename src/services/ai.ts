import { execFile } from "child_process"
import { ROOT } from "../config.js"
import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"

const CLAUDE_MODEL = "claude-opus-5-5"
const CLAUDE_TIMEOUT_MS = 10 * 60 * 1000
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

// Headless Claude Code, authed by CLAUDE_CODE_OAUTH_TOKEN (from `claude setup-token`).
// Prompt goes over stdin as stream-json so images and large prompts work; the last stdout line is the result.
// cwd is ROOT so Claude Code picks up the native skills in ROOT/.claude/skills.
export async function generateAiResponse(prompt: string, imageUrls: string[] = [], systemPrompt?: string): Promise<string> {
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
        let finalResult: { is_error?: boolean; result?: string } | undefined
        try {
          finalResult = JSON.parse(stdout.trim().split("\n").at(-1) || "")
        } catch {}

        if (finalResult && !finalResult.is_error) return resolve(finalResult.result || "")

        const errorDetail = finalResult?.result || stderr.trim() || processError?.message || "no output"
        reject(new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.PROVIDER_ERROR, `Claude error: ${errorDetail}`))
      },
    )
    claudeProcess.stdin?.end(stdinMessage + "\n")
  })
}
