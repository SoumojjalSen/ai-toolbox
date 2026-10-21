import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { buildMoverAlert } from "../services/market/alert.js"
import { buildEveningScorecard } from "../services/market/review.js"
import { buildIpoFinal } from "../services/market/ipo.js"

const router = Router()

// n8n calls these on schedule and emails `html` when `count` > 0 (0 on holidays): market check 10:00 and 14:00,
// IPO final call 16:15 (closing days only), scorecard 19:30 once NSE's daily price file is out
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

router.get(
  "/market/ipo-final",
  asyncHandler(async (_req, res) => {
    res.json(await buildIpoFinal())
  }),
)

export default router
