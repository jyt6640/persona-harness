import { existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"

import type { ConventionLevel } from "../config/convention-registry.js"

export function collectConventionFiles(projectDir: string): readonly string[] {
  const conventionsDir = join(projectDir, ".persona", "conventions")
  if (!existsSync(conventionsDir)) {
    return []
  }
  const files: string[] = []
  for (const entry of readdirSync(conventionsDir)) {
    const entryPath = join(conventionsDir, entry)
    const stat = statSync(entryPath)
    if (stat.isFile() && /\.(ya?ml)$/iu.test(entry)) {
      files.push(entryPath)
    }
  }
  return files.sort()
}

export function readYamlScalar(source: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  const match = new RegExp(`^${escapedKey}:\\s*['"]?([^'"\\r\\n#]+)`, "imu").exec(source)
  return match?.[1]?.trim()
}

export function readIndentedYamlScalar(source: string, parentKey: string, key: string): string | undefined {
  const parentPattern = new RegExp(`^${parentKey.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}:\\s*$`, "iu")
  const childPattern = new RegExp(`^\\s+${key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}:\\s*['"]?([^'"\\r\\n#]*)`, "iu")
  let inParent = false
  for (const line of source.split("\n")) {
    if (parentPattern.test(line)) {
      inParent = true
      continue
    }
    if (inParent && /^\S/u.test(line)) {
      return undefined
    }
    if (inParent) {
      const match = childPattern.exec(line)
      if (match?.[1] !== undefined) {
        return match[1].trim()
      }
    }
  }
  return undefined
}

export function readPersonaMeta(source: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  const match = new RegExp(`^\\s*#\\s*persona-harness-${escapedKey}:\\s*(.+)$`, "imu").exec(source)
  return match?.[1]?.trim()
}

export function readPersonaListMeta(source: string, key: string): readonly string[] {
  const value = readPersonaMeta(source, key)
  if (value === undefined) {
    return []
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

export function readLevel(value: string | undefined): ConventionLevel {
  return value === "block" || value === "warn" || value === "report" ? value : "report"
}

export function readBooleanMeta(value: string | undefined): boolean {
  return value?.toLowerCase() === "true"
}

export function slugFor(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "")
}
