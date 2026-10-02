import { Router } from "express"
import { mcpConnectorsConfig } from "../config.js"
import { listSkills } from "../skills.js"

const router = Router()

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mcps: Object.keys(mcpConnectorsConfig),
    skills: listSkills(),
  })
})

export default router
