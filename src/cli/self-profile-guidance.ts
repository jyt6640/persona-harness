import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { isRecord } from "../config/jsonc.js"
import type { ProjectReadSnapshot } from "../io/project-read-snapshot.js"

export function isPersonaHarnessPackageRepo(projectDir: string, snapshot?: ProjectReadSnapshot): boolean {
  if (snapshot !== undefined) {
    const text = snapshot.readText("package.json", 1024 * 1024)
    return text === undefined ? false : isPersonaHarnessPackageText(text)
  }
  const packageJsonPath = join(projectDir, "package.json")
  if (!existsSync(packageJsonPath)) {
    return false
  }
  try {
    return isPersonaHarnessPackageText(readFileSync(packageJsonPath, "utf8"))
  } catch {
    return false
  }
}

function isPersonaHarnessPackageText(text: string): boolean {
  try {
    const parsed: unknown = JSON.parse(text)
    return isRecord(parsed) && parsed.name === "persona-harness"
  } catch {
    return false
  }
}

export function personaHarnessSelfProfileGuidance(
  projectDir: string | undefined,
  snapshot?: ProjectReadSnapshot,
): readonly string[] {
  if (projectDir === undefined || !isPersonaHarnessPackageRepo(projectDir, snapshot)) {
    return []
  }
  return [
    "Persona Harness package repository detected: this npm/CLI repo is PH source, while `.persona/project-profile.jsonc` may describe a Java/Spring workflow fixture.",
    "Do not force generated Java/Spring app files into the PH package repo; use a separate Java/Spring fixture workspace for PH workflow smokes, or change the profile only if this repo's intended product stack changed.",
  ]
}
