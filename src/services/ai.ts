import { spawn } from "child_process"
import { createInterface } from "readline"
import { ROOT } from "../config.js"
import { AppError } from "../errors.js"
import { HttpStatus, ErrorCode } from "../constants.js"
import { log } from "../log.js"

const CLAUDE_MODEL = "claude-opus-5-5"
// market-analyst with subagents takes ~13 min (2 Oct 2026: 6 min research + 6.5 min writing); 25 min leaves headroom
const CLAUDE_TIMEOUT_MS = 25 * 60 * 1000
// Web + skills + subagents only — no Bash/Read/Edit, so a prompt-injected web page can't touch the container.
// Subagents (.claude/agents) are limited to WebSearch/WebFetch in their own frontmatter.
const CLAUDE_ALLOWED_TOOLS = "WebSearch,WebFetch,Skill,Agent"

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

interface ClaudeContentBlock {
  type: string
  name?: string
}

interface ClaudeStreamEvent {
  type: string
  subtype?: string
  // set on events from inside a subagent: the id of the Agent tool_use that started it
  parent_tool_use_id?: string | null
  // on system task_started / task_notification events (subagent start / finish)
  tool_use_id?: string
  subagent_type?: string
  message?: { content?: ClaudeContentBlock[] | string }
  // only on "result" events
  is_error?: boolean
  result?: string
  session_id?: string
}

export interface AiResponse {
  text: string
  // Claude Code session file for this run — full research path, kept 7 days (see Dockerfile)
  sessionId: string
}

interface SubagentRun {
  subagentType: string
  startMs: number
  endMs?: number
  searchCount: number
  fetchCount: number
}

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000)
  return `${Math.floor(totalSeconds / 60)}m${String(totalSeconds % 60).padStart(2, "0")}s`
}

// Phase timings for docker logs: research (first subagent start → last end), writing (→ answer),
// then one line per subagent type. Times are when each event reached us — subagents may run in
// the background, so the Agent tool's own result isn't a reliable "finished" signal; task events are.
function logSubagentPhases(subagentRuns: SubagentRun[], runEndMs: number) {
  if (subagentRuns.length === 0) return
  const researchStartMs = Math.min(...subagentRuns.map((run) => run.startMs))
  const researchEndMs = Math.max(...subagentRuns.map((run) => run.endMs ?? runEndMs))
  log(`claude:   research ${formatDuration(researchEndMs - researchStartMs)} · writing ${formatDuration(runEndMs - researchEndMs)}`)

  const runsBySubagentType = new Map<string, SubagentRun[]>()
  for (const run of subagentRuns) runsBySubagentType.set(run.subagentType, [...(runsBySubagentType.get(run.subagentType) ?? []), run])
  for (const [subagentType, runs] of runsBySubagentType) {
    const durations = runs.map((run) => (run.endMs ?? runEndMs) - run.startMs)
    const durationText = runs.length === 1
      ? formatDuration(durations[0])
      : `×${runs.length} ${formatDuration(Math.min(...durations))}–${formatDuration(Math.max(...durations))}`
    const searchCount = runs.reduce((total, run) => total + run.searchCount, 0)
    const fetchCount = runs.reduce((total, run) => total + run.fetchCount, 0)
    log(`claude:   ${subagentType} ${durationText} · ${searchCount} searches · ${fetchCount} pages`)
  }
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
    // Ignore MCP servers from the user's Claude config — locally your Mac's Playwright etc. would load; the container has none
    "--strict-mcp-config",
    // Repo settings only — locally your Mac's plugins, hooks and personal skills would load; the container has none
    "--setting-sources", "project",
  ]
  if (systemPrompt) cliArgs.push("--append-system-prompt", systemPrompt)

  const imageBlocks = await Promise.all(
    imageUrls.map(async (imageUrl) => ({ type: "image", source: await convertImageUrlToBase64Source(imageUrl) })),
  )
  const messageContent = [...imageBlocks, { type: "text", text: prompt }]
  const stdinMessage = JSON.stringify({ type: "user", message: { role: "user", content: messageContent } })

  return new Promise((resolve, reject) => {
    // spawn + line reader (not execFile) so each event is timestamped as it arrives, for the phase timings
    const runStartMs = Date.now()
    const claudeProcess = spawn("claude", cliArgs, { cwd: ROOT, timeout: CLAUDE_TIMEOUT_MS })
    const subagentRunsByToolUseId = new Map<string, SubagentRun>()
    let finalResult: ClaudeStreamEvent | undefined
    let searchCount = 0
    let fetchCount = 0
    let stderrText = ""

    claudeProcess.stderr.on("data", (chunk) => (stderrText += chunk))
    createInterface({ input: claudeProcess.stdout }).on("line", (line) => {
      let streamEvent: ClaudeStreamEvent
      try {
        streamEvent = JSON.parse(line)
      } catch {
        return
      }
      // with background subagents a run can have several turns, each ending in a "result" — the last one is the answer
      if (streamEvent.type === "result") finalResult = streamEvent
      if (streamEvent.subtype === "task_started" && streamEvent.tool_use_id) {
        subagentRunsByToolUseId.set(streamEvent.tool_use_id, {
          subagentType: streamEvent.subagent_type ?? "general-purpose",
          startMs: Date.now(),
          searchCount: 0,
          fetchCount: 0,
        })
      }
      if (streamEvent.subtype === "task_notification" && streamEvent.tool_use_id) {
        const finishedSubagentRun = subagentRunsByToolUseId.get(streamEvent.tool_use_id)
        if (finishedSubagentRun) finishedSubagentRun.endMs ??= Date.now()
      }

      const parentSubagentRun = streamEvent.parent_tool_use_id ? subagentRunsByToolUseId.get(streamEvent.parent_tool_use_id) : undefined
      const contentBlocks = Array.isArray(streamEvent.message?.content) ? streamEvent.message.content : []
      for (const contentBlock of contentBlocks) {
        if (contentBlock.type === "tool_use" && contentBlock.name === "WebSearch") {
          searchCount++
          if (parentSubagentRun) parentSubagentRun.searchCount++
        }
        if (contentBlock.type === "tool_use" && contentBlock.name === "WebFetch") {
          fetchCount++
          if (parentSubagentRun) parentSubagentRun.fetchCount++
        }
      }
    })

    claudeProcess.on("error", (spawnError) =>
      reject(new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.PROVIDER_ERROR, `Claude error: ${spawnError.message}`)),
    )
    claudeProcess.on("close", () => {
      const sessionId = finalResult?.session_id ?? "none"
      const subagentRuns = [...subagentRunsByToolUseId.values()]
      const runSummary = `${searchCount} searches · ${fetchCount} pages · ${subagentRuns.length} subagents · session ${sessionId}`

      if (finalResult && !finalResult.is_error) {
        // our own clock: the result's duration_ms only covers the last turn
        log(`claude: done in ${formatDuration(Date.now() - runStartMs)} · ${runSummary}`)
        logSubagentPhases(subagentRuns, Date.now())
        return resolve({ text: finalResult.result || "", sessionId })
      }

      const timedOut = claudeProcess.killed ? `timed out after ${formatDuration(CLAUDE_TIMEOUT_MS)}` : ""
      const errorDetail = finalResult?.result || timedOut || stderrText.trim() || "no output"
      log(`claude: failed — ${errorDetail} · ${runSummary}`)
      logSubagentPhases(subagentRuns, Date.now())
      reject(new AppError(HttpStatus.BAD_GATEWAY, ErrorCode.PROVIDER_ERROR, `Claude error: ${errorDetail} (session ${sessionId})`))
    })
    claudeProcess.stdin.end(stdinMessage + "\n")
  })
}
