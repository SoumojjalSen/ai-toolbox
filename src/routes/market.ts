import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { buildMoverAlert } from "../services/marketAlert.js"

const router = Router()

// n8n calls this at ~9:30 IST and emails `html` when `count` > 0 (0 on holidays and quiet mornings)
router.get(
  "/market/alert",
  asyncHandler(async (_req, res) => {
    res.json(await buildMoverAlert())
  }),
)

export default router
