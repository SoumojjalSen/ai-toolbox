import { existsSync, readdirSync } from "fs"
import { join } from "path"
import { AppError } from "./errors.js"
import { HttpStatus, ErrorCode } from "./constants.js"
import { ROOT } from "./config.js"

// Native Claude Code skills: .claude/skills/<name>/SKILL.md. Claude Code loads them itself
// (cwd is ROOT), we only check the name exists so a typo is a 404, not a confused answer.
export const SKILLS_DIR = join(ROOT, ".claude", "skills")

function getSkillFilePath(skillName: string): string {
  return join(SKILLS_DIR, skillName, "SKILL.md")
}

export function assertSkillExists(skillName: string): void {
  if (!existsSync(getSkillFilePath(skillName))) {
    throw new AppError(HttpStatus.NOT_FOUND, ErrorCode.UNKNOWN_SKILL, `Unknown skill: ${skillName}`)
  }
}

export function listSkills(): string[] {
  if (!existsSync(SKILLS_DIR)) return []

  return readdirSync(SKILLS_DIR).filter((skillName) => existsSync(getSkillFilePath(skillName)))
}
