import { DEFAULT_CONTEXT_BUDGET, type ContextBudget } from "./context-budget.js"
import type { ContextConflict, ContextTarget } from "./context-envelope.js"

const INPUT_KEYS = ["budget", "resolution", "target"] as const
const TARGET_KEYS = ["fileRole", "language", "path"] as const
const BUDGET_KEYS = ["maxCapsules", "maxChars"] as const
const RESOLVED_KEYS = ["conflicts", "selected", "shadowed", "status"] as const
const BLOCKED_KEYS = ["conflicts", "reason", "selected", "shadowed", "status"] as const
const SELECTION_KEYS = ["id", "layer", "reason", "rule", "topic"] as const
const SHADOW_KEYS = ["id", "reason", "topic", "winnerId"] as const
const CONFLICT_KEYS = ["reason", "ruleIds", "topic"] as const
const MAX_CONTEXT_CAPSULES = 16
const MAX_CONTEXT_CHARS = 4_000

export type ParsedContextEnvelopeInput = {
  readonly budget: ContextBudget
  readonly resolution: ParsedContextResolution
  readonly target: ContextTarget
}

export type ParsedContextResolution =
  | {
      readonly status: "resolved"
      readonly selected: readonly ParsedContextSelection[]
      readonly shadowed: readonly ParsedContextShadow[]
      readonly conflicts: readonly []
    }
  | {
      readonly status: "blocked"
      readonly reason: "malformed-input" | "profile-unavailable" | "ambiguous-conflict" | "selection-overflow"
      readonly selected: readonly []
      readonly shadowed: readonly []
      readonly conflicts: readonly ContextConflict[]
    }

export type ParsedContextSelection = {
  readonly id: string
  readonly layer: string
  readonly reason: string
  readonly rule: string
  readonly topic: string
}

export type ParsedContextShadow = {
  readonly id: string
  readonly reason: "higher-precedence"
  readonly topic: string
  readonly winnerId: string
}

export function parseContextEnvelopeInput(value: unknown): ParsedContextEnvelopeInput | undefined {
  if (!isRecord(value) || !hasKnownKeys(value, INPUT_KEYS) || !Object.hasOwn(value, "resolution") || !Object.hasOwn(value, "target")) return undefined
  const target = parseTarget(value.target)
  const budget = parseBudget(value.budget)
  const resolution = parseResolution(value.resolution)
  if (target === undefined || budget === undefined || resolution === undefined) return undefined
  return { budget, resolution, target }
}

export function isSafeEnvelopeIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|https?:\/\/)/u.test(value)
}

function parseTarget(value: unknown): ContextTarget | undefined {
  if (!isRecord(value) || !hasKnownKeys(value, TARGET_KEYS) || !isSafeRelativePath(value.path)) return undefined
  const language = value.language
  const fileRole = value.fileRole
  if (!isOptionalIdentifier(language) || !isOptionalIdentifier(fileRole)) return undefined
  if (language !== undefined && fileRole !== undefined) return { fileRole, language, path: value.path }
  if (language !== undefined) return { language, path: value.path }
  if (fileRole !== undefined) return { fileRole, path: value.path }
  return { path: value.path }
}

function parseBudget(value: unknown): ContextBudget | undefined {
  if (value === undefined) return DEFAULT_CONTEXT_BUDGET
  if (!isRecord(value) || !hasExactKeys(value, BUDGET_KEYS)) return undefined
  if (!isBoundedInteger(value.maxCapsules, 1, MAX_CONTEXT_CAPSULES) || !isBoundedInteger(value.maxChars, 1, MAX_CONTEXT_CHARS)) return undefined
  return { maxCapsules: value.maxCapsules, maxChars: value.maxChars }
}

function parseResolution(value: unknown): ParsedContextResolution | undefined {
  if (!isRecord(value)) return undefined
  if (value.status === "resolved") {
    const selected = parseSelections(value.selected)
    const shadowed = parseShadows(value.shadowed)
    if (!hasExactKeys(value, RESOLVED_KEYS) || selected === undefined || shadowed === undefined || !isEmptyArray(value.conflicts)) return undefined
    return { conflicts: [], selected, shadowed, status: "resolved" }
  }
  if (value.status === "blocked") {
    const conflicts = parseConflicts(value.conflicts)
    if (!hasExactKeys(value, BLOCKED_KEYS) || !isBlockReason(value.reason) || !isEmptyArray(value.selected) || !isEmptyArray(value.shadowed) || conflicts === undefined) return undefined
    return { conflicts, reason: value.reason, selected: [], shadowed: [], status: "blocked" }
  }
  return undefined
}

function parseSelections(value: unknown): readonly ParsedContextSelection[] | undefined {
  if (!Array.isArray(value)) return undefined
  const selections: ParsedContextSelection[] = []
  for (const entry of value) {
    if (!isRecord(entry) || !hasExactKeys(entry, SELECTION_KEYS)
      || typeof entry.id !== "string" || typeof entry.layer !== "string" || typeof entry.reason !== "string"
      || typeof entry.rule !== "string" || typeof entry.topic !== "string") return undefined
    selections.push({ id: entry.id, layer: entry.layer, reason: entry.reason, rule: entry.rule, topic: entry.topic })
  }
  return selections
}

function parseShadows(value: unknown): readonly ParsedContextShadow[] | undefined {
  if (!Array.isArray(value)) return undefined
  const shadows: ParsedContextShadow[] = []
  for (const entry of value) {
    if (!isRecord(entry) || !hasExactKeys(entry, SHADOW_KEYS) || !isSafeEnvelopeIdentifier(entry.id)
      || entry.reason !== "higher-precedence" || !isSafeEnvelopeIdentifier(entry.topic) || !isSafeEnvelopeIdentifier(entry.winnerId)) return undefined
    shadows.push({ id: entry.id, reason: entry.reason, topic: entry.topic, winnerId: entry.winnerId })
  }
  return shadows
}

function parseConflicts(value: unknown): readonly ContextConflict[] | undefined {
  if (!Array.isArray(value)) return undefined
  const conflicts: ContextConflict[] = []
  for (const entry of value) {
    if (!isRecord(entry) || !hasExactKeys(entry, CONFLICT_KEYS) || entry.reason !== "same-layer-conflict"
      || !isSafeEnvelopeIdentifier(entry.topic) || !isSafeIdentifierArray(entry.ruleIds) || entry.ruleIds.length < 2) return undefined
    conflicts.push({ reason: entry.reason, ruleIds: [...entry.ruleIds].sort(), topic: entry.topic })
  }
  return conflicts.sort((left, right) => left.topic.localeCompare(right.topic))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys<T extends readonly string[]>(value: Record<string, unknown>, keys: T): boolean {
  return Object.keys(value).length === keys.length && hasKnownKeys(value, keys)
}

function hasKnownKeys<T extends readonly string[]>(value: Record<string, unknown>, keys: T): boolean {
  const expected = new Set(keys)
  return Object.keys(value).every((key) => expected.has(key))
}

function isEmptyArray(value: unknown): value is readonly [] {
  return Array.isArray(value) && value.length === 0
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
}

function isBlockReason(value: unknown): value is "malformed-input" | "profile-unavailable" | "ambiguous-conflict" | "selection-overflow" {
  return value === "malformed-input" || value === "profile-unavailable" || value === "ambiguous-conflict" || value === "selection-overflow"
}

function isOptionalIdentifier(value: unknown): value is string | undefined {
  return value === undefined || isSafeEnvelopeIdentifier(value)
}

function isSafeIdentifierArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => isSafeEnvelopeIdentifier(entry))
}

function isSafeRelativePath(value: unknown): value is string {
  return isSafeEnvelopeIdentifier(value) && !value.split(/[\\/]/u).some((segment) => segment === "." || segment === "..")
}
