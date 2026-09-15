import { z } from "zod"
import { OutputFormat } from "./constants.js"

export const aiRequestSchema = z.object({
  prompt: z.string().min(1),
  images: z.array(z.string()).optional(),
  provider: z.string().optional(),
  skill: z.string().optional(),
  system: z.string().optional(),
  format: z.enum([OutputFormat.HTML]).optional(),
})

export type AiRequest = z.infer<typeof aiRequestSchema>
