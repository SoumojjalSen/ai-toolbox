import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { aiRequestSchema } from "../schemas.js"
import { OutputFormat } from "../constants.js"
import { FORMAT_INSTRUCTIONS, convertMarkdownToEmailHtml } from "../formats.js"
import { generateAiResponse } from "../services/ai.js"
import { assertSkillExists } from "../skills.js"
import { buildMarketScan } from "../services/market/scan.js"
import { readHoldings } from "../services/market/holdings.js"
import { parseReportPicks, splitFindingsLog } from "../services/market/scorecard.js"
import { writeJson, writeText, todayIst, nseDate } from "../services/market/store.js"
import { fetchHolidays } from "../services/market/ipo.js"
import { log } from "../log.js"

// Data a skill needs that Claude can't fetch reliably itself — attached here so every caller (n8n, the local
// script, curl) sends the same small request and nothing is duplicated between them.
const SKILL_CONTEXT_BUILDERS: Record<string, () => Promise<string>> = {
  "market-analyst": async () => {
    const holdings = await readHoldings()
    return [holdings.text, await buildMarketScan(holdings.symbols)].filter(Boolean).join("\n\n")
  },
}

// Claude Code doesn't know the date, and IST is what every skill here means by "today"
function prependTodaysDate(prompt: string): string {
  const today = new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", weekday: "long", timeZone: "Asia/Kolkata" })
  return `Today is ${today} (IST).\n\n${prompt}`
}

async function appendSkillContext(prompt: string, skill?: string): Promise<string> {
  const buildSkillContext = skill ? SKILL_CONTEXT_BUILDERS[skill] : undefined
  return buildSkillContext ? `${prompt}\n\n${await buildSkillContext()}` : prompt
}

// "/market-analyst <prompt>" makes Claude Code load .claude/skills/market-analyst/SKILL.md natively
function prependSkillCommand(prompt: string, skill?: string): string {
  if (!skill) return prompt
  assertSkillExists(skill)
  return `/${skill} ${prompt}`
}

function appendFormatInstructions(prompt: string, format?: OutputFormat): string {
  if (format) return prompt + "\n\n" + FORMAT_INSTRUCTIONS[format]
  return prompt
}

const router = Router()

router.post(
  "/ai",
  asyncHandler(async (req, res) => {
    const { prompt, images, skill, system, format } = aiRequestSchema.parse(req.body)
    log(`ai: skill=${skill ?? "none"} images=${images?.length ?? 0} format=${format ?? "text"}`)

    // NSE holiday: no daily report (the next trading day's report covers it); weekly mode still runs
    if (skill === "market-analyst" && !/weekly/i.test(prompt) && (await fetchHolidays()).has(nseDate())) {
      log("ai: market-analyst skipped — NSE holiday")
      res.json({ response: "", sessionId: "", skipped: "NSE holiday" })
      return
    }
    const promptWithContext = await appendSkillContext(prependTodaysDate(prompt), skill)
    const fullPrompt = appendFormatInstructions(prependSkillCommand(promptWithContext, skill), format)
    const aiResponse = await generateAiResponse(fullPrompt, images, system)
    // the 9:09 pre-open alert (buy or skip) and the evening scorecard work from the report's actual picks; the findings
    // log is saved for tomorrow's news check and kept out of the email
    if (skill === "market-analyst") {
      const { report, findings } = splitFindingsLog(aiResponse.text)
      aiResponse.text = report
      await writeText(`reports/${todayIst()}.md`, report) // the evening scorecard checks every call in it
      const reportPicks = parseReportPicks(report)
      if (reportPicks.length) await writeJson(`report-picks/${todayIst()}.json`, reportPicks)
      if (findings.length) await writeJson(`findings/${todayIst()}.json`, findings)
    }
    // html: Claude wrote Markdown (see FORMAT_INSTRUCTIONS); styling is applied here
    const responseText = format === OutputFormat.HTML ? convertMarkdownToEmailHtml(aiResponse.text) : aiResponse.text
    res.json({ response: responseText, sessionId: aiResponse.sessionId })
  }),
)

export default router
