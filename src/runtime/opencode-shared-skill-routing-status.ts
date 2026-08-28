import { lstatSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import {
  listPersonaSharedSkills,
  personaSharedSkillPath,
  type PersonaSharedSkill,
  type PersonaSharedSkillId,
} from "./persona-shared-skill-catalog.js"

const MAX_DESCRIPTION_CHARS = 240

export type OpenCodeSharedSkillRoutingConfig = {
  readonly configSafe: boolean
  readonly enabled: boolean
  readonly enabledDomains: readonly string[]
  readonly pluginConfigured: boolean
  readonly runtimeInjection: boolean
}

export type OpenCodeNativeSkillCatalogStatus = {
  readonly describedSkillCount: number
  readonly skillCount: number
  readonly state: "invalid" | "ready" | "unavailable"
}

export type OpenCodeSharedSkillRoutingStatus = {
  readonly adapterReachability: "unobserved"
  readonly automaticRoute: "configured" | "disabled" | "unavailable"
  readonly hostDelivery: "unobserved"
  readonly hostSelection: "unobserved"
  readonly nativeCatalog: OpenCodeNativeSkillCatalogStatus
  readonly schemaVersion: "opencode-shared-skill-routing-status.1"
}

export type OpenCodeSharedSkillRoutingStatusOptions = {
  readonly listSkills?: () => readonly PersonaSharedSkill[]
  readonly readSkill?: (skillId: PersonaSharedSkillId) => string
}

function packageRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
}

function readBundledSkill(skillId: PersonaSharedSkillId): string {
  const path = join(packageRoot(), personaSharedSkillPath(skillId))
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error("OpenCode shared-skill metadata is unavailable")
  }
  return readFileSync(path, "utf8")
}

function parseFrontmatter(source: string): Readonly<Record<string, string>> | undefined {
  const lines = source.split(/\r?\n/u)
  if (lines[0] !== "---") {
    return undefined
  }
  const end = lines.indexOf("---", 1)
  if (end < 1) {
    return undefined
  }

  const metadata: Record<string, string> = {}
  for (const line of lines.slice(1, end)) {
    if (line.trim() === "") {
      continue
    }
    const match = /^([a-z][a-z0-9-]*):[ \t]+(.+?)\s*$/u.exec(line)
    if (match === null) {
      return undefined
    }
    const key = match[1]
    const value = match[2]?.trim()
    if (key === undefined || value === undefined || value === "" || metadata[key] !== undefined) {
      return undefined
    }
    metadata[key] = value
  }
  return metadata
}

function hasOpenCodeDescription(source: string, skillId: PersonaSharedSkillId): boolean {
  const metadata = parseFrontmatter(source)
  const description = metadata?.description
  return metadata?.name === skillId
    && description !== undefined
    && description.trim() !== ""
    && description.length <= MAX_DESCRIPTION_CHARS
}

function inspectNativeCatalog(
  readSkill: (skillId: PersonaSharedSkillId) => string,
  listSkills: () => readonly PersonaSharedSkill[],
): OpenCodeNativeSkillCatalogStatus {
  let skills: readonly PersonaSharedSkill[]
  try {
    skills = listSkills()
  } catch {
    return {
      describedSkillCount: 0,
      skillCount: 0,
      state: "unavailable",
    }
  }
  let describedSkillCount = 0

  for (const skill of skills) {
    let source: string
    try {
      source = readSkill(skill.id)
    } catch {
      return {
        describedSkillCount: 0,
        skillCount: skills.length,
        state: "unavailable",
      }
    }
    if (hasOpenCodeDescription(source, skill.id)) {
      describedSkillCount += 1
    }
  }

  return {
    describedSkillCount,
    skillCount: skills.length,
    state: describedSkillCount === skills.length ? "ready" : "invalid",
  }
}

function automaticRouteState(
  config: OpenCodeSharedSkillRoutingConfig,
  nativeCatalog: OpenCodeNativeSkillCatalogStatus,
): OpenCodeSharedSkillRoutingStatus["automaticRoute"] {
  if (!config.configSafe || !config.pluginConfigured || nativeCatalog.state !== "ready") {
    return "unavailable"
  }
  return config.enabled
    && config.runtimeInjection
    && (config.enabledDomains.includes("product") || config.enabledDomains.includes("workflow"))
    ? "configured"
    : "disabled"
}

/**
 * Reports only what Persona can establish locally. The OpenCode native loader
 * owns model-side skill selection, so a CLI status must leave it unobserved.
 */
export function readOpenCodeSharedSkillRoutingStatus(
  config: OpenCodeSharedSkillRoutingConfig,
  options: OpenCodeSharedSkillRoutingStatusOptions = {},
): OpenCodeSharedSkillRoutingStatus {
  const nativeCatalog = inspectNativeCatalog(
    options.readSkill ?? readBundledSkill,
    options.listSkills ?? listPersonaSharedSkills,
  )
  return {
    adapterReachability: "unobserved",
    automaticRoute: automaticRouteState(config, nativeCatalog),
    hostDelivery: "unobserved",
    hostSelection: "unobserved",
    nativeCatalog,
    schemaVersion: "opencode-shared-skill-routing-status.1",
  }
}
