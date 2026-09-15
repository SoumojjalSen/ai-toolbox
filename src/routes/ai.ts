import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { aiRequestSchema } from "../schemas.js"
import { OutputFormat } from "../constants.js"
import { FORMAT_INSTRUCTIONS } from "../formats.js"
import { callAi } from "../services/ai.js"
import { loadSkill } from "../skills.js"
import type { ContentPart, MessageContent } from "../types.js"

function resolveSystemPrompt(skill?: string, system?: string): string | undefined {
  if (skill) return loadSkill(skill)
  return system
}

function buildPrompt(prompt: string, format?: OutputFormat): string {
  if (format) return prompt + "\n\n" + FORMAT_INSTRUCTIONS[format]
  return prompt
}

function buildContent(prompt: string, images?: string[]): MessageContent {
  if (!images?.length) return prompt

  return [
    ...images.map((url): ContentPart => ({ type: "image_url", image_url: { url } })),
    { type: "text", text: prompt },
  ]
}

const router = Router()

router.post(
  "/ai",
  asyncHandler(async (req, res) => {
    const { prompt, images, provider, skill, system, format } = aiRequestSchema.parse(req.body)

    const systemPrompt = resolveSystemPrompt(skill, system)
    const finalPrompt = buildPrompt(prompt, format)
    const content = buildContent(finalPrompt, images)

    const result = await callAi(content, provider, systemPrompt)
    res.json({ response: result })
  }),
)

export default router
