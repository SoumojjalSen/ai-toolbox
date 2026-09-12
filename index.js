import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { readFileSync, existsSync, readdirSync } from "fs";
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

  const client = new Client({ name: "ai-toolbox", version: "1.0.0" });
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

function loadSkill(name) {
  const path = join(__dirname, "skills", `${name}.md`);
  if (!existsSync(path)) throw new Error(`Unknown skill: ${name}`);
  return readFileSync(path, "utf8");
}

async function callAi(content, providerName, systemPrompt) {
  const name = providerName || providers.default;
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown provider: ${name}`);

  const messages = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content });

  const apiKey = provider.apiKeyEnv ? process.env[provider.apiKeyEnv] : "";
  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      messages,
      max_tokens: 16384,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI provider ${name} error: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

const log = (method, path, extra = "") => console.log(`[${new Date().toISOString()}] ${method} ${path}${extra ? " " + extra : ""}`);

const app = express();
app.use(express.json({ limit: "50mb" }));

app.get("/health", (_, res) => res.json({ status: "ok", mcps: Object.keys(mcpConfig), providers: Object.keys(providers).filter(k => k !== "default") }));

// List available tools for an MCP server
app.get("/mcp/:server/tools", async (req, res) => {
  const config = mcpConfig[req.params.server];
  if (!config) return res.status(404).json({ error: `Unknown MCP server: ${req.params.server}` });

  const client = new Client({ name: "ai-toolbox", version: "1.0.0" });
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
  log("POST", `/mcp/${req.params.server}/${req.params.tool}`);
  try {
    const result = await callMcp(req.params.server, req.params.tool, req.body || {});
    log("POST", `/mcp/${req.params.server}/${req.params.tool}`, "200");
    res.json(result);
  } catch (err) {
    log("POST", `/mcp/${req.params.server}/${req.params.tool}`, `500 ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Call AI with a prompt (supports text, images, skills, and system prompts)
// Text:   { "prompt": "analyze this" }
// Image:  { "prompt": "what is this?", "images": ["data:image/png;base64,..."] }
// Skill:  { "prompt": "analyze my portfolio", "skill": "portfolio-analyst" }
// System: { "prompt": "analyze this", "system": "You are a financial expert..." }
app.post("/ai", async (req, res) => {
  const { prompt, images, provider, skill, system, format } = req.body;
  if (!prompt) return res.status(400).json({ error: "prompt required" });

  log("POST", "/ai", `skill=${skill || "none"} provider=${provider || "default"} format=${format || "text"}`);
  try {
    let systemPrompt = system || null;
    if (skill) systemPrompt = loadSkill(skill);

    let finalPrompt = prompt;
    if (format === "html") finalPrompt += "\n\nRespond in clean HTML with inline CSS suitable for email. Rules: max-width 600px, use percentage widths on tables (width:100%), font-size minimum 14px, no fixed pixel widths, wrap in a single-column layout. Tables must have overflow-x:auto wrapper div. Use bold, colors (green for positive, red for negative). No markdown.";

    let content;
    if (images?.length) {
      content = [
        ...images.map(img => ({ type: "image_url", image_url: { url: img } })),
        { type: "text", text: finalPrompt },
      ];
    } else {
      content = finalPrompt;
    }
    const start = Date.now();
    const result = await callAi(content, provider, systemPrompt);
    log("POST", "/ai", `200 ${((Date.now() - start) / 1000).toFixed(1)}s`);
    res.json({ response: result });
  } catch (err) {
    log("POST", "/ai", `500 ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// List available skills
app.get("/skills", (_, res) => {
  const skillsDir = join(__dirname, "skills");
  if (!existsSync(skillsDir)) return res.json({ skills: [] });
  const skills = readdirSync(skillsDir).filter(f => f.endsWith(".md")).map(f => f.replace(".md", ""));
  res.json({ skills });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`ai-toolbox running on :${PORT}`));
