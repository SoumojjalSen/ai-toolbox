import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(__dirname, f), "utf8"));

const mcpConfig = load("config/mcps.json");
const providers = load("config/providers.json");
const denyTools = new Set(load("config/deny-tools.json"));

async function callMcp(serverName, toolName, args = {}) {
  const config = mcpConfig[serverName];
  if (!config) throw new Error(`Unknown MCP server: ${serverName}`);
  if (denyTools.has(toolName)) throw new Error(`Blocked tool: ${toolName}`);

  const client = new Client({ name: "flowpilot", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "mcp-remote@0.1.38", config.url, ...(config.callbackPort ? [String(config.callbackPort)] : [])],
  });
  await client.connect(transport);

  try {
    return await client.callTool({ name: toolName, arguments: args });
  } finally {
    try { await client.close(); } catch {}
  }
}

async function callAi(prompt, providerName) {
  const name = providerName || providers.default;
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown provider: ${name}`);

  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "";
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI provider ${name} error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

const app = express();
app.use(express.json());

app.get("/health", (_, res) => res.json({ status: "ok", mcps: Object.keys(mcpConfig), providers: Object.keys(providers).filter(k => k !== "default") }));

// List available tools for an MCP server
app.get("/mcp/:server/tools", async (req, res) => {
  const config = mcpConfig[req.params.server];
  if (!config) return res.status(404).json({ error: `Unknown MCP server: ${req.params.server}` });

  const client = new Client({ name: "flowpilot", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "mcp-remote@0.1.38", config.url, ...(config.callbackPort ? [String(config.callbackPort)] : [])],
  });
  await client.connect(transport);

  try {
    const tools = await client.listTools();
    const safe = tools.tools.filter(t => !denyTools.has(t.name));
    res.json({ server: req.params.server, tools: safe.map(t => ({ name: t.name, description: t.description })) });
  } finally {
    try { await client.close(); } catch {}
  }
});

// Call an MCP tool
app.post("/mcp/:server/:tool", async (req, res) => {
  try {
    const result = await callMcp(req.params.server, req.params.tool, req.body || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Call AI with a prompt
app.post("/ai", async (req, res) => {
  const { prompt, provider } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  try {
    const result = await callAi(prompt, provider);
    res.json({ response: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FlowPilot running on :${PORT}`));
