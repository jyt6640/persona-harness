import { DEFAULT_CONTEXT_BUDGET } from "../context-core/context-budget.js"
import { isRecord } from "./jsonc.js"

const CONTEXT_CONFIG_KEYS = ["enabled", "maxCapsules", "maxChars", "mode"] as const
const MAX_CONTEXT_CAPSULES = 16
const MAX_CONTEXT_CHARS = 4_000

export type ContextMode = "targeted"

export type HarnessContextConfig = {
  readonly enabled: boolean
  readonly maxCapsules: number
  readonly maxChars: number
  readonly mode: ContextMode
}

export type ContextConfigDiagnostic = {
  readonly code: "context-config-invalid"
  readonly message: "Context configuration is invalid; Context remains disabled."
}

export type ContextConfigLoadResult = {
  readonly config: HarnessContextConfig
  readonly diagnostics: readonly ContextConfigDiagnostic[]
}

export const DEFAULT_CONTEXT_CONFIG: Readonly<HarnessContextConfig> = Object.freeze({
  enabled: false,
  maxCapsules: DEFAULT_CONTEXT_BUDGET.maxCapsules,
  maxChars: DEFAULT_CONTEXT_BUDGET.maxChars,
  mode: "targeted",
})

export function parseContextConfig(value: unknown): ContextConfigLoadResult {
  if (value === undefined) {
    return { config: DEFAULT_CONTEXT_CONFIG, diagnostics: [] }
  }
  if (!isRecord(value) || !hasKnownKeys(value) || !hasValidValues(value)) {
    return invalidContextConfig()
  }
  return {
    config: {
      enabled: readBoolean(value.enabled, DEFAULT_CONTEXT_CONFIG.enabled),
      maxCapsules: readBoundedInteger(value.maxCapsules, DEFAULT_CONTEXT_CONFIG.maxCapsules),
      maxChars: readBoundedInteger(value.maxChars, DEFAULT_CONTEXT_CONFIG.maxChars),
      mode: "targeted",
    },
    diagnostics: [],
  }
}

function invalidContextConfig(): ContextConfigLoadResult {
  return {
    config: DEFAULT_CONTEXT_CONFIG,
    diagnostics: [
      {
        code: "context-config-invalid",
        message: "Context configuration is invalid; Context remains disabled.",
      },
    ],
  }
}

function hasKnownKeys(value: Record<string, unknown>): boolean {
  const knownKeys = new Set<string>(CONTEXT_CONFIG_KEYS)
  return Object.keys(value).every((key) => knownKeys.has(key))
}

function hasValidValues(value: Record<string, unknown>): boolean {
  return (value.enabled === undefined || typeof value.enabled === "boolean")
    && (value.mode === undefined || value.mode === "targeted")
    && (value.maxCapsules === undefined || isBoundedInteger(value.maxCapsules, 1, MAX_CONTEXT_CAPSULES))
    && (value.maxChars === undefined || isBoundedInteger(value.maxChars, 1, MAX_CONTEXT_CHARS))
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback
}

function readBoundedInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
}
