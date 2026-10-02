import express from "express"
import type { Request, Response, NextFunction } from "express"
import healthRouter from "./routes/health.js"
import mcpRouter from "./routes/mcp.js"
import aiRouter from "./routes/ai.js"
import skillsRouter from "./routes/skills.js"
import { errorHandler } from "./errors.js"
import { packageJson } from "./config.js"
import { log } from "./log.js"

// Logs when a request starts too — /ai runs for minutes, so "finished" alone looks like nothing is happening
function requestLogger(req: Request, res: Response, next: NextFunction) {
  const requestStartMs = Date.now()
  log(`${req.method} ${req.path} started`)
  res.on("finish", () => {
    const durationSeconds = ((Date.now() - requestStartMs) / 1000).toFixed(1)
    log(`${req.method} ${req.path} ${res.statusCode} ${durationSeconds}s`)
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

const PORT = Number(process.env.PORT) || 8080
// Loopback only: /ai has no auth, so only processes on the same machine (n8n on the VM) may reach it
app.listen(PORT, "127.0.0.1", () => console.log(`${packageJson.name} running on 127.0.0.1:${PORT}`))
