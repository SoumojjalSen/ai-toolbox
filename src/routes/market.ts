import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { buildMoverAlert } from "../services/market/alert.js"
import { buildEveningScorecard } from "../services/market/review.js"

const router = Router()

// n8n calls these on schedule and emails `html` when `count` > 0 (0 on holidays): market check 10:00 and 14:00,
// scorecard 19:30 once NSE's bhavcopy is out
router.get(
  "/market/alert",
  asyncHandler(async (_req, res) => {
    res.json(await buildMoverAlert())
  }),
)

router.get(
  "/market/scorecard",
  asyncHandler(async (_req, res) => {
    res.json(await buildEveningScorecard())
  }),
)

export default router
