import { Router } from "express"
import { mcpConfig, providers } from "../config.js"

const router = Router()

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    mcps: Object.keys(mcpConfig),
    providers: Object.keys(providers).filter((key) => typeof providers[key] !== "string"),
  })
})

export default router
