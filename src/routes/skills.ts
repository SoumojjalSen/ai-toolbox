import { Router } from "express"
import { listSkills } from "../skills.js"

const router = Router()

router.get("/skills", (_req, res) => {
  res.json({ skills: listSkills() })
})

export default router
