import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord, stripJsonComments } from "../config/jsonc.js"
import type { ProjectReadBoundary } from "../io/bootstrap-write-boundary.js"

export type ProfileIntent = {
  readonly applicationType: string
  readonly architectureStyle: string
  readonly buildTool: string
  readonly framework: string
  readonly language: string
  readonly migrationStyle: string
  readonly persistenceTechnology: string
  readonly storage: string
}

const PROFILE_PATH = ".persona/project-profile.jsonc"

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : ""
}

export function readProfileIntent(
  projectDir: string,
  projectReadBoundary?: ProjectReadBoundary,
): ProfileIntent | undefined {
  const text = projectReadBoundary === undefined
    ? readProfileText(projectDir)
    : projectReadBoundary.readProjectFile(PROFILE_PATH)?.toString("utf8")
  if (text === undefined) return undefined
  const parsed: unknown = JSON.parse(stripJsonComments(text))
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
    applicationType: answers.get("application-type") ?? "",
    architectureStyle: answers.get("architecture-style") ?? "",
    buildTool: readString(parsed.defaults.buildTool),
    framework: readString(parsed.defaults.framework),
    language: readString(parsed.defaults.language),
    migrationStyle: answers.get("migration-style") ?? "",
    persistenceTechnology: answers.get("persistence-technology") ?? "",
    storage: answers.get("storage") ?? "",
  }
}

function readProfileText(projectDir: string): string | undefined {
  const profilePath = join(projectDir, PROFILE_PATH)
  return existsSync(profilePath) ? readFileSync(profilePath, "utf8") : undefined
}
