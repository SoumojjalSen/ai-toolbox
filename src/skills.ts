import { readFileSync, existsSync, readdirSync } from "fs"
import { join } from "path"
import { AppError } from "./errors.js"
import { HttpStatus, ErrorCode } from "./constants.js"
import { ROOT } from "./config.js"

const SKILLS_DIR = join(ROOT, "skills")
const SKILL_EXTENSION = ".md"

export function loadSkill(name: string): string {
  const skillPath = join(SKILLS_DIR, `${name}${SKILL_EXTENSION}`)

  if (!existsSync(skillPath)) {
    throw new AppError(HttpStatus.NOT_FOUND, ErrorCode.UNKNOWN_SKILL, `Unknown skill: ${name}`)
  }

  return readFileSync(skillPath, "utf8")
}

export function listSkills(): string[] {
  if (!existsSync(SKILLS_DIR)) return []

  return readdirSync(SKILLS_DIR)
    .filter((file) => file.endsWith(SKILL_EXTENSION))
    .map((file) => file.replace(SKILL_EXTENSION, ""))
}
