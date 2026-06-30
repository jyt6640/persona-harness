import { existsSync, readFileSync } from "node:fs"
import { isAbsolute, join } from "node:path"

import type { Phase0Scenario } from "../rules/rule-frontmatter.js"
import { DEFAULT_CONVENTION_LEVELS } from "./convention-registry.js"
import type { ConventionLevel } from "./convention-registry.js"
import { isRecord, stripJsonComments } from "./jsonc.js"

export type { ConventionLevel } from "./convention-registry.js"

export type HarnessConfig = {
  readonly conventions: Readonly<Record<string, ConventionLevel>>
  readonly enabled: boolean
  readonly rulesDir: string
  readonly evidenceDir: string
  readonly enforce: HarnessEnforceConfig
  readonly telemetry: HarnessTelemetryConfig
  readonly multiAgent: HarnessMultiAgentConfig
  readonly maxRulesPerInjection: number
  readonly evidenceMode: "metadata_only"
  readonly enabledDomains: readonly string[]
  readonly scenario: Phase0Scenario
}

export type HarnessEnforceConfig = {
  readonly executeVerification: boolean
  readonly idleContinuation: boolean
  readonly systemConstitution: boolean
  /**
   * Known no-op (SDK limitation): the OpenCode `permission.ask` API exposes only
   * `{ type, title, callID, metadata }` and not the proposed write content, while the
   * hook that does see content (`tool.execute.before`) cannot return a deny status.
   * Content-based write-time deny is therefore not cleanly feasible in this runtime.
   * Retained as an experimental opt-in; authoritative enforcement is closure-time
   * (finish gate + ast-grep conventions).
   */
  readonly writeDeny: boolean
}

export type HarnessTelemetryConfig = {
  readonly tokenUsage: boolean
}

export const DEFAULT_MULTI_AGENT_ROLES = ["test-writer", "jaeki", "roach"] as const

export type MultiAgentRole = (typeof DEFAULT_MULTI_AGENT_ROLES)[number]

export type HarnessMultiAgentConfig = {
  readonly enabled: boolean
  readonly roles: readonly MultiAgentRole[]
  readonly models: Readonly<Partial<Record<MultiAgentRole, string>>>
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
  conventions: DEFAULT_CONVENTION_LEVELS,
  enabled: true,
  rulesDir: ".persona/rules",
  evidenceDir: ".persona/evidence",
  enforce: {
    executeVerification: false,
    idleContinuation: false,
    systemConstitution: true,
    writeDeny: false,
  },
  telemetry: {
    tokenUsage: true,
  },
  multiAgent: {
    enabled: false,
    roles: DEFAULT_MULTI_AGENT_ROLES,
    models: {},
  },
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
    idleContinuation: readBoolean(value.idleContinuation, DEFAULT_CONFIG.enforce.idleContinuation),
    systemConstitution: readBoolean(value.systemConstitution, DEFAULT_CONFIG.enforce.systemConstitution),
    writeDeny: readBoolean(value.writeDeny, DEFAULT_CONFIG.enforce.writeDeny),
  }
}

function isMultiAgentRole(value: unknown): value is MultiAgentRole {
  return value === "test-writer" || value === "jaeki" || value === "roach"
}

function readMultiAgentRoles(value: unknown): readonly MultiAgentRole[] {
  if (!Array.isArray(value)) {
    return DEFAULT_CONFIG.multiAgent.roles
  }
  const roles = value.filter(isMultiAgentRole)
  return roles.length > 0 ? roles : DEFAULT_CONFIG.multiAgent.roles
}

function readMultiAgentModels(value: unknown): HarnessMultiAgentConfig["models"] {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.multiAgent.models
  }
  const models: Partial<Record<MultiAgentRole, string>> = {}
  for (const role of DEFAULT_MULTI_AGENT_ROLES) {
    const model = value[role]
    if (typeof model === "string" && model.trim() !== "") {
      models[role] = model
    }
  }
  return models
}

function readTelemetryConfig(value: unknown): HarnessTelemetryConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.telemetry
  }
  return {
    tokenUsage: readBoolean(value.tokenUsage, DEFAULT_CONFIG.telemetry.tokenUsage),
  }
}

function readMultiAgentConfig(value: unknown): HarnessMultiAgentConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.multiAgent
  }
  return {
    enabled: readBoolean(value.enabled, DEFAULT_CONFIG.multiAgent.enabled),
    roles: readMultiAgentRoles(value.roles),
    models: readMultiAgentModels(value.models),
  }
}

function readConventionLevel(value: unknown): ConventionLevel | undefined {
  return value === "block" || value === "report" || value === "warn" ? value : undefined
}

function readConventionLevels(value: unknown): Readonly<Record<string, ConventionLevel>> {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.conventions
  }
  const levels: Record<string, ConventionLevel> = { ...DEFAULT_CONFIG.conventions }
  for (const [id, rawLevel] of Object.entries(value)) {
    const level = readConventionLevel(rawLevel)
    if (level !== undefined) {
      levels[id] = level
    }
  }
  return levels
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
      conventions: readConventionLevels(parsed.conventions),
      enabled: readBoolean(parsed.enabled, DEFAULT_CONFIG.enabled),
      rulesDir: readString(parsed.rulesDir, DEFAULT_CONFIG.rulesDir),
      evidenceDir: readString(parsed.evidenceDir, DEFAULT_CONFIG.evidenceDir),
      enforce: readEnforceConfig(parsed.enforce),
      telemetry: readTelemetryConfig(parsed.telemetry),
      multiAgent: readMultiAgentConfig(parsed.multiAgent),
      maxRulesPerInjection: readPositiveInteger(parsed.maxRulesPerInjection, DEFAULT_CONFIG.maxRulesPerInjection),
      evidenceMode: readEvidenceMode(parsed.evidenceMode),
      enabledDomains: readStringArray(parsed.enabledDomains, DEFAULT_CONFIG.enabledDomains),
      scenario: readScenario(parsed.scenario, DEFAULT_CONFIG.scenario),
    },
    diagnostics: [],
  }
}
