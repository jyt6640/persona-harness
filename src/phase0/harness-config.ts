import { existsSync, readFileSync } from "node:fs"
import { isAbsolute, join } from "node:path"

import type { Phase0Scenario } from "./rule-frontmatter.js"

export type HarnessConfig = {
  readonly enabled: boolean
  readonly rulesDir: string
  readonly evidenceDir: string
  readonly maxRulesPerInjection: number
  readonly evidenceMode: "metadata_only"
  readonly enabledDomains: readonly string[]
  readonly scenario: Phase0Scenario
}

const DEFAULT_CONFIG: HarnessConfig = {
  enabled: true,
  rulesDir: ".persona/rules",
  evidenceDir: ".persona/evidence",
  maxRulesPerInjection: 12,
  evidenceMode: "metadata_only",
  enabledDomains: ["backend"],
  scenario: "step1",
}

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
      if (escaped) {
        escaped = false
      } else if (current === "\\") {
        escaped = true
      } else if (current === "\"") {
        inString = false
      }
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
      while (index < input.length && input[index] !== "\n") {
        index += 1
      }
      continue
    }

    if (current === "/" && next === "*") {
      index += 2
      while (index < input.length && !(input[index] === "*" && input[index + 1] === "/")) {
        index += 1
      }
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

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() !== "" ? value : fallback
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback
}

function readStringArray(value: unknown, fallback: readonly string[]): readonly string[] {
  if (!Array.isArray(value)) {
    return fallback
  }
  const strings = value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
  return strings.length > 0 ? strings : fallback
}

function readScenario(value: unknown, fallback: Phase0Scenario): Phase0Scenario {
  return value === "step2-3" ? "step2-3" : fallback
}

function readEvidenceMode(value: unknown): "metadata_only" {
  return value === "metadata_only" ? "metadata_only" : DEFAULT_CONFIG.evidenceMode
}

export function resolveConfiguredPath(projectDir: string, configuredPath: string): string {
  return isAbsolute(configuredPath) ? configuredPath : join(projectDir, configuredPath)
}

export function loadHarnessConfig(projectDir: string): HarnessConfig {
  const harnessPath = join(projectDir, ".persona", "harness.jsonc")
  if (!existsSync(harnessPath)) {
    return DEFAULT_CONFIG
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(harnessPath, "utf8")))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return DEFAULT_CONFIG
    }
    throw error
  }

  if (!isRecord(parsed)) {
    return DEFAULT_CONFIG
  }

  return {
    enabled: readBoolean(parsed.enabled, DEFAULT_CONFIG.enabled),
    rulesDir: readString(parsed.rulesDir, DEFAULT_CONFIG.rulesDir),
    evidenceDir: readString(parsed.evidenceDir, DEFAULT_CONFIG.evidenceDir),
    maxRulesPerInjection: readPositiveInteger(parsed.maxRulesPerInjection, DEFAULT_CONFIG.maxRulesPerInjection),
    evidenceMode: readEvidenceMode(parsed.evidenceMode),
    enabledDomains: readStringArray(parsed.enabledDomains, DEFAULT_CONFIG.enabledDomains),
    scenario: readScenario(parsed.scenario, DEFAULT_CONFIG.scenario),
  }
}
