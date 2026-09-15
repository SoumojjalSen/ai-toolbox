import { Router } from "express"
import { asyncHandler } from "../errors.js"
import { invokeMcpTool, listMcpTools } from "../services/mcp.js"

interface ConnectorParams { connector: string }
interface McpToolInvokeParams { connector: string; tool: string }

const router = Router()

router.get(
  "/mcp/:connector/tools",
  asyncHandler<ConnectorParams>(async (req, res) => {
    const tools = await listMcpTools(req.params.connector)
    res.json({ connector: req.params.connector, tools })
  }),
)

router.post(
  "/mcp/:connector/:tool",
  asyncHandler<McpToolInvokeParams>(async (req, res) => {
    const result = await invokeMcpTool(req.params.connector, req.params.tool, req.body || {})
    res.json(result)
  }),
)

export default router
