import { readFileSync } from "fs"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import type { McpConfig } from "./types.js"

// config/ and skills/ sit next to dist/, not inside it — go up one level to project root
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..")

// JSON.parse returns `any` — the `as T` cast is unavoidable without a runtime validator
function readJsonFile<T>(relativeFilePath: string): T {
  const absoluteFilePath = join(ROOT, relativeFilePath)
  return JSON.parse(readFileSync(absoluteFilePath, "utf8")) as T
}

export const packageJson = readJsonFile<{ name: string; version: string }>("package.json")
export const mcpConnectorsConfig = readJsonFile<McpConfig>("config/mcps.json")
export const deniedToolNames = new Set(readJsonFile<string[]>("config/deny-tools.json"))
