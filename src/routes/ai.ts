import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { aiRequestSchema } from "../schemas.js"
import { OutputFormat } from "../constants.js"
import { FORMAT_INSTRUCTIONS, convertMarkdownToEmailHtml } from "../formats.js"
import { generateAiResponse } from "../services/ai.js"
import { assertSkillExists } from "../skills.js"
import { buildMarketScan } from "../services/marketScan.js"
import { log } from "../log.js"

// Data a skill needs that Claude can't fetch reliably itself — attached here so every caller (n8n, the local
// script, curl) sends the same small request and nothing is duplicated between them.
const SKILL_CONTEXT_BUILDERS: Record<string, () => Promise<string>> = {
  "market-analyst": buildMarketScan,
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

    const promptWithContext = await appendSkillContext(prependTodaysDate(prompt), skill)
    const fullPrompt = appendFormatInstructions(prependSkillCommand(promptWithContext, skill), format)
    const aiResponse = await generateAiResponse(fullPrompt, images, system)
    // html: Claude wrote Markdown (see FORMAT_INSTRUCTIONS); styling is applied here
    const responseText = format === OutputFormat.HTML ? convertMarkdownToEmailHtml(aiResponse.text) : aiResponse.text
    res.json({ response: responseText, sessionId: aiResponse.sessionId })
  }),
)

export default router
