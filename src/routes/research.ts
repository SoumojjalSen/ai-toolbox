import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { researchRequestSchema } from "../schemas.js"
import { research } from "../services/research.js"

const router = Router()

// Web-grounded research via Gemini — searches Google, reads full pages, returns sourced analysis
router.post(
  "/research",
  asyncHandler(async (req, res) => {
    const { query } = researchRequestSchema.parse(req.body)
    const result = await research(query)
    res.json(result)
  }),
)

export default router
