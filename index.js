import express from "express";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const load = (f) => JSON.parse(readFileSync(join(__dirname, f), "utf8"));

const mcpConfig = load("config/mcps.json");
const providers = load("config/providers.json");
const denyTools = new Set(load("config/deny-tools.json"));

const workflows = {};
for (const f of readdirSync(join(__dirname, "workflows"))) {
  if (f.endsWith(".json")) {
    const wf = load(`workflows/${f}`);
    workflows[wf.name] = wf;
  }
}

function template(str, ctx) {
  return str.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
    let val = ctx;
    for (const key of path.split(".")) val = val?.[key];
    return val !== undefined ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "";
  });
}

async function callMcp(serverName, toolName, args = {}) {
  const config = mcpConfig[serverName];
  if (!config) throw new Error(`Unknown MCP server: ${serverName}`);
  if (denyTools.has(toolName)) throw new Error(`Blocked tool: ${toolName}`);

  const client = new Client({ name: "flowpilot", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(config.url));
  await client.connect(transport);

  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    return result;
  } finally {
    await client.close();
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

async function executeStep(step, ctx) {
  switch (step.type) {
    case "mcp": {
      const args = step.args ? JSON.parse(template(JSON.stringify(step.args), ctx)) : {};
      return await callMcp(step.server, step.tool, args);
    }
    case "ai": {
      const prompt = template(step.prompt, ctx);
      return await callAi(prompt, step.provider);
    }
    case "filter": {
      const data = typeof ctx.prev === "string" ? JSON.parse(ctx.prev) : ctx.prev;
      return eval(`(${JSON.stringify(data)})${step.expression}`);
    }
    case "http": {
      const url = template(step.url, ctx);
      const res = await fetch(url, {
        method: step.method || "GET",
        headers: step.headers || {},
        body: step.body ? template(JSON.stringify(step.body), ctx) : undefined,
      });
      return await res.json();
    }
    default:
      throw new Error(`Unknown step type: ${step.type}`);
  }
}

async function runWorkflow(name, params = {}) {
  const wf = workflows[name];
  if (!wf) throw new Error(`Unknown workflow: ${name}`);

  const ctx = { params, prev: null, steps: {} };
  const log = [];

  for (const step of wf.steps) {
    const start = Date.now();
    try {
      const result = await executeStep(step, ctx);
      ctx.prev = result;
      if (step.id) ctx.steps[step.id] = result;
      log.push({ id: step.id, type: step.type, ms: Date.now() - start, ok: true });
    } catch (err) {
      log.push({ id: step.id, type: step.type, ms: Date.now() - start, ok: false, error: err.message });
      throw err;
    }
  }

  return { result: ctx.prev, log };
}

const app = express();
app.use(express.json());

app.get("/health", (_, res) => res.json({ status: "ok", workflows: Object.keys(workflows) }));

app.get("/workflows", (_, res) => res.json(workflows));

app.post("/run", async (req, res) => {
  const { workflow, params } = req.body;
  if (!workflow) return res.status(400).json({ error: "workflow name required" });

  try {
    const result = await runWorkflow(workflow, params || {});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FlowPilot running on :${PORT}`));
