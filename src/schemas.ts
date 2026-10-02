import { z } from "zod"
import { OutputFormat } from "./constants.js"

export const aiRequestSchema = z.object({
  prompt: z.string().min(1),
  images: z.array(z.string()).optional(),
  // Becomes a "/<skill>" command, so only plain names — no paths, spaces or other commands
  skill: z.string().regex(/^[a-z0-9-]+$/).optional(),
  system: z.string().optional(),
  format: z.enum([OutputFormat.HTML]).optional(),
})

