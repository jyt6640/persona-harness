import { existsSync, readFileSync } from "node:fs"
import { isAbsolute, join } from "node:path"

import type { Phase0Scenario } from "../rules/rule-frontmatter.js"
import { isRecord, stripJsonComments } from "./jsonc.js"

export type HarnessConfig = {
  readonly enabled: boolean
  readonly rulesDir: string
  readonly evidenceDir: string
  readonly enforce: HarnessEnforceConfig
  readonly maxRulesPerInjection: number
  readonly evidenceMode: "metadata_only"
  readonly enabledDomains: readonly string[]
  readonly scenario: Phase0Scenario
}

export type HarnessEnforceConfig = {
  readonly executeVerification: boolean
}

export type HarnessConfigDiagnostic = {
  readonly code: "malformed_config" | "invalid_config"
  readonly message: string
  readonly path: string
}

export type HarnessConfigLoadResult = {
  readonly config: HarnessConfig
  readonly diagnostics: readonly HarnessConfigDiagnostic[]
}

const DEFAULT_CONFIG: HarnessConfig = {
  enabled: true,
  rulesDir: ".persona/rules",
  evidenceDir: ".persona/evidence",
  enforce: { executeVerification: false },
  maxRulesPerInjection: 12,
  evidenceMode: "metadata_only",
  enabledDomains: ["backend", "programming", "workflow"],
  scenario: "step1",
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

function readEnforceConfig(value: unknown): HarnessEnforceConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.enforce
  }
  return {
    executeVerification: readBoolean(value.executeVerification, DEFAULT_CONFIG.enforce.executeVerification),
  }
}

export function resolveConfiguredPath(projectDir: string, configuredPath: string): string {
  return isAbsolute(configuredPath) ? configuredPath : join(projectDir, configuredPath)
}

export function loadHarnessConfig(projectDir: string): HarnessConfig {
  return loadHarnessConfigResult(projectDir).config
}

export function loadHarnessConfigResult(projectDir: string): HarnessConfigLoadResult {
  const harnessPath = join(projectDir, ".persona", "harness.jsonc")
  if (!existsSync(harnessPath)) {
    return { config: DEFAULT_CONFIG, diagnostics: [] }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripJsonComments(readFileSync(harnessPath, "utf8")))
  } catch (error) {
    if (error instanceof SyntaxError) {
      return {
        config: DEFAULT_CONFIG,
        diagnostics: [
          {
            code: "malformed_config",
            message: `Failed to parse .persona/harness.jsonc: ${error.message}`,
            path: harnessPath,
          },
        ],
      }
    }
    throw error
  }

  if (!isRecord(parsed)) {
    return {
      config: DEFAULT_CONFIG,
      diagnostics: [
        {
          code: "invalid_config",
          message: ".persona/harness.jsonc must contain a JSON object.",
          path: harnessPath,
        },
      ],
    }
  }

  return {
    config: {
      enabled: readBoolean(parsed.enabled, DEFAULT_CONFIG.enabled),
      rulesDir: readString(parsed.rulesDir, DEFAULT_CONFIG.rulesDir),
      evidenceDir: readString(parsed.evidenceDir, DEFAULT_CONFIG.evidenceDir),
      enforce: readEnforceConfig(parsed.enforce),
      maxRulesPerInjection: readPositiveInteger(parsed.maxRulesPerInjection, DEFAULT_CONFIG.maxRulesPerInjection),
      evidenceMode: readEvidenceMode(parsed.evidenceMode),
      enabledDomains: readStringArray(parsed.enabledDomains, DEFAULT_CONFIG.enabledDomains),
      scenario: readScenario(parsed.scenario, DEFAULT_CONFIG.scenario),
    },
    diagnostics: [],
  }
}
