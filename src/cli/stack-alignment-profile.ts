import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type ProfileIntent = {
  readonly buildTool: string
  readonly framework: string
  readonly language: string
  readonly migrationStyle: string
  readonly persistenceTechnology: string
  readonly storage: string
}

const PROFILE_PATH = ".persona/project-profile.jsonc"

function stripJsonComments(input: string): string {
  let output = ""
  let index = 0
  let inString = false
  let escaped = false
  while (index < input.length) {
    const current = input[index]
    const next = input[index + 1]
    if (inString) {
      output += current
      if (escaped) escaped = false
      else if (current === "\\") escaped = true
      else if (current === "\"") inString = false
      index += 1
      continue
    }
    if (current === "\"") {
      inString = true
      output += current
      index += 1
      continue
    }
    if (current === "/" && next === "/") {
      while (index < input.length && input[index] !== "\n") index += 1
      continue
    }
    if (current === "/" && next === "*") {
      index += 2
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) index += 1
      index += 2
      continue
    }
    output += current
    index += 1
  }
  return output
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function readProfileIntent(projectDir: string): ProfileIntent | undefined {
  const profilePath = join(projectDir, PROFILE_PATH)
  if (!existsSync(profilePath)) return undefined
  const parsed: unknown = JSON.parse(stripJsonComments(readFileSync(profilePath, "utf8")))
  if (!isRecord(parsed) || parsed.schema !== "persona.project-profile.v1" || !isRecord(parsed.scope) || !isRecord(parsed.defaults)) {
    return undefined
  }
  if (parsed.scope.role !== "backend" || parsed.scope.mvp !== "java-spring-clean-code") return undefined
  const answers = new Map<string, string>()
  if (Array.isArray(parsed.questions)) {
    for (const question of parsed.questions) {
      if (isRecord(question) && typeof question.id === "string" && typeof question.answer === "string") {
        answers.set(question.id, question.answer.trim().toLowerCase())
      }
    }
  }
  return {
    buildTool: readString(parsed.defaults.buildTool),
    framework: readString(parsed.defaults.framework),
    language: readString(parsed.defaults.language),
    migrationStyle: answers.get("migration-style") ?? "",
    persistenceTechnology: answers.get("persistence-technology") ?? "",
    storage: answers.get("storage") ?? "",
  }
}
