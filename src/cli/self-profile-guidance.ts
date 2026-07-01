import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord } from "../config/jsonc.js"

export function isPersonaHarnessPackageRepo(projectDir: string): boolean {
  const packageJsonPath = join(projectDir, "package.json")
  if (!existsSync(packageJsonPath)) {
    return false
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(packageJsonPath, "utf8"))
    return isRecord(parsed) && parsed.name === "persona-harness"
  } catch {
    return false
  }
}

export function personaHarnessSelfProfileGuidance(projectDir: string | undefined): readonly string[] {
  if (projectDir === undefined || !isPersonaHarnessPackageRepo(projectDir)) {
    return []
  }
  return [
    "Persona Harness package repository detected: this npm/CLI repo is PH source, while `.persona/project-profile.jsonc` may describe a Java/Spring workflow fixture.",
    "Do not force generated Java/Spring app files into the PH package repo; use a separate Java/Spring fixture workspace for PH workflow smokes, or change the profile only if this repo's intended product stack changed.",
  ]
}
