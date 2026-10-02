import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { aiRequestSchema } from "../schemas.js"
import { OutputFormat } from "../constants.js"
import { FORMAT_INSTRUCTIONS } from "../formats.js"
import { generateAiResponse } from "../services/ai.js"
import { assertSkillExists } from "../skills.js"

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

    const fullPrompt = appendFormatInstructions(prependSkillCommand(prompt, skill), format)
    const aiResponseText = await generateAiResponse(fullPrompt, images, system)
    res.json({ response: aiResponseText })
  }),
)

export default router
