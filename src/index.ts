import express from "express"
import type { Request, Response, NextFunction } from "express"
import healthRouter from "./routes/health.js"
import mcpRouter from "./routes/mcp.js"
import aiRouter from "./routes/ai.js"
import skillsRouter from "./routes/skills.js"
import { errorHandler } from "./errors.js"
import { pkg } from "./config.js"

function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  res.on("finish", () => {
    const duration = ((Date.now() - start) / 1000).toFixed(1)
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${duration}s`)
  })
  next()
}

// 50mb to support base64-encoded images in /ai requests
const JSON_BODY_LIMIT = "50mb"

const app = express()

app.use(express.json({ limit: JSON_BODY_LIMIT }))
app.use(requestLogger)

app.use(healthRouter)
app.use(mcpRouter)
app.use(aiRouter)
app.use(skillsRouter)

app.use(errorHandler)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`${pkg.name} running on :${PORT}`))
