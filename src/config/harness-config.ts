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
  readonly features: HarnessFeaturesConfig
  readonly enforce: HarnessEnforceConfig
  readonly telemetry: HarnessTelemetryConfig
  readonly multiAgent: HarnessMultiAgentConfig
  readonly maxRulesPerInjection: number
  readonly evidenceMode: "metadata_only"
  readonly enabledDomains: readonly string[]
  readonly scenario: Phase0Scenario
}

export type HarnessFeaturesConfig = {
  readonly runtimeInjection: boolean
}

export type HarnessEnforceConfig = {
  readonly compaction: HarnessCompactionConfig
  readonly executeVerification: boolean
  readonly idleContinuation: boolean
  readonly ralphLoop: HarnessRalphLoopConfig
  readonly systemConstitution: boolean
  readonly tdd: boolean
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

export type HarnessCompactionConfig = {
  readonly cooldownMs: number
  readonly enabled: boolean
  readonly threshold: number
}

export type HarnessRalphLoopConfig = {
  readonly cooldownMs: number
  readonly enabled: boolean
  readonly maxAttempts: number
  readonly maxSessionAttempts: number
  readonly toolOutputTrigger: boolean
}

export type HarnessTelemetryConfig = {
  readonly tokenUsage: boolean
}

export const DEFAULT_MULTI_AGENT_ROLES = ["test-writer", "implementer", "reviewer"] as const

export type MultiAgentRole = (typeof DEFAULT_MULTI_AGENT_ROLES)[number]
type DeprecatedMultiAgentRole = "jaeki" | "roach"

const DEPRECATED_MULTI_AGENT_ROLE_ALIASES: Readonly<Record<DeprecatedMultiAgentRole, MultiAgentRole>> = {
  jaeki: "implementer",
  roach: "reviewer",
}

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
  features: {
    runtimeInjection: false,
  },
  enforce: {
    compaction: {
      cooldownMs: 600_000,
      enabled: false,
      threshold: 0.78,
    },
    executeVerification: false,
    idleContinuation: false,
    ralphLoop: {
      cooldownMs: 30_000,
      enabled: false,
      maxAttempts: 3,
      maxSessionAttempts: 9,
      toolOutputTrigger: false,
    },
    systemConstitution: false,
    tdd: false,
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

function readNonNegativeInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback
}

function readRatio(value: unknown, fallback: number): number {
  return typeof value === "number" && value > 0 && value <= 1 ? value : fallback
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
    compaction: readCompactionConfig(value.compaction),
    executeVerification: readBoolean(value.executeVerification, DEFAULT_CONFIG.enforce.executeVerification),
    idleContinuation: readBoolean(value.idleContinuation, DEFAULT_CONFIG.enforce.idleContinuation),
    ralphLoop: readRalphLoopConfig(value.ralphLoop),
    systemConstitution: readBoolean(value.systemConstitution, DEFAULT_CONFIG.enforce.systemConstitution),
    tdd: readBoolean(value.tdd, DEFAULT_CONFIG.enforce.tdd),
    writeDeny: readBoolean(value.writeDeny, DEFAULT_CONFIG.enforce.writeDeny),
  }
}

function readFeaturesConfig(value: unknown): HarnessFeaturesConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.features
  }
  return {
    runtimeInjection: readBoolean(value.runtimeInjection, DEFAULT_CONFIG.features.runtimeInjection),
  }
}

function readCompactionConfig(value: unknown): HarnessCompactionConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.enforce.compaction
  }
  return {
    cooldownMs: readPositiveInteger(value.cooldownMs, DEFAULT_CONFIG.enforce.compaction.cooldownMs),
    enabled: readBoolean(value.enabled, DEFAULT_CONFIG.enforce.compaction.enabled),
    threshold: readRatio(value.threshold, DEFAULT_CONFIG.enforce.compaction.threshold),
  }
}

function readRalphLoopConfig(value: unknown): HarnessRalphLoopConfig {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.enforce.ralphLoop
  }
  const maxAttempts = readPositiveInteger(value.maxAttempts, DEFAULT_CONFIG.enforce.ralphLoop.maxAttempts)
  const maxSessionAttempts = readPositiveInteger(value.maxSessionAttempts, maxAttempts * 3)
  return {
    cooldownMs: readNonNegativeInteger(value.cooldownMs, DEFAULT_CONFIG.enforce.ralphLoop.cooldownMs),
    enabled: readBoolean(value.enabled, DEFAULT_CONFIG.enforce.ralphLoop.enabled),
    maxAttempts,
    maxSessionAttempts: Math.max(maxSessionAttempts, maxAttempts),
    toolOutputTrigger: readBoolean(value.toolOutputTrigger, DEFAULT_CONFIG.enforce.ralphLoop.toolOutputTrigger),
  }
}

function isMultiAgentRole(value: unknown): value is MultiAgentRole {
  return value === "test-writer" || value === "implementer" || value === "reviewer"
}

function isDeprecatedMultiAgentRole(value: unknown): value is DeprecatedMultiAgentRole {
  return value === "jaeki" || value === "roach"
}

export function normalizeMultiAgentRole(value: unknown): MultiAgentRole | undefined {
  if (isMultiAgentRole(value)) {
    return value
  }
  return isDeprecatedMultiAgentRole(value) ? DEPRECATED_MULTI_AGENT_ROLE_ALIASES[value] : undefined
}

export function deprecatedMultiAgentRoleFor(role: MultiAgentRole): DeprecatedMultiAgentRole | undefined {
  for (const [deprecatedRole, normalizedRole] of Object.entries(DEPRECATED_MULTI_AGENT_ROLE_ALIASES)) {
    if (normalizedRole === role) {
      return isDeprecatedMultiAgentRole(deprecatedRole) ? deprecatedRole : undefined
    }
  }
  return undefined
}

function readMultiAgentRoles(value: unknown): readonly MultiAgentRole[] {
  if (!Array.isArray(value)) {
    return DEFAULT_CONFIG.multiAgent.roles
  }
  const roles: MultiAgentRole[] = []
  for (const item of value) {
    const role = normalizeMultiAgentRole(item)
    if (role !== undefined && !roles.includes(role)) {
      roles.push(role)
    }
  }
  return roles.length > 0 ? roles : DEFAULT_CONFIG.multiAgent.roles
}

function readMultiAgentModels(value: unknown): HarnessMultiAgentConfig["models"] {
  if (!isRecord(value)) {
    return DEFAULT_CONFIG.multiAgent.models
  }
  const models: Partial<Record<MultiAgentRole, string>> = {}
  for (const role of DEFAULT_MULTI_AGENT_ROLES) {
    const legacyRole = deprecatedMultiAgentRoleFor(role)
    const model = typeof value[role] === "string" ? value[role] : legacyRole === undefined ? undefined : value[legacyRole]
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

export function isRuntimeInjectionEnabled(config: HarnessConfig): boolean {
  return config.enabled && config.features.runtimeInjection
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
      features: readFeaturesConfig(parsed.features),
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
