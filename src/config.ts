import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { McpConfig, ProvidersConfig } from "./types.js"

// config/ and skills/ sit next to dist/, not inside it — go up one level to project root
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

// JSON.parse returns `any` — the `as T` cast is unavoidable without a runtime validator
function loadJson<T>(relativePath: string): T {
  const fullPath = join(ROOT, relativePath)
  return JSON.parse(readFileSync(fullPath, "utf8")) as T
}

export const pkg = loadJson<{ name: string; version: string }>("package.json")
export const mcpConfig = loadJson<McpConfig>("config/mcps.json")
export const providers = loadJson<ProvidersConfig>("config/providers.json")
export const denyTools = new Set(loadJson<string[]>("config/deny-tools.json"))
