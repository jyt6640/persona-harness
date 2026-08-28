import { parseEffectiveContextInput } from "../context-core/effective-context-v2-input.js"
import type { ContextEnvelopeBlockReason } from "../context-core/context-envelope.js"
import type { ContextLayer, ContextRule, EffectiveContextInput } from "../context-core/rule-types.js"
import {
  CONTEXT_COMPARISON_FIXTURE_SET,
  CONTEXT_COMPARISON_LAYERS,
  CONTEXT_COMPARISON_MANIFEST_SCHEMA,
  REQUIRED_CONTEXT_COMPARISON_FIXTURE_IDS,
  type ContextComparisonBudget,
  type ContextComparisonCandidate,
  type ContextComparisonConflict,
  type ContextComparisonExpectation,
  type ContextComparisonFixture,
  type ContextComparisonFixtureId,
  type ContextComparisonManifest,
  type ContextComparisonRuleReference,
  type ContextComparisonTarget,
} from "./context-comparison-types.js"

const FIXTURE_KEYS = ["budget", "claimScope", "context", "deliveryAttempts", "expectation", "id", "target", "task"] as const
const MANIFEST_KEYS = ["fixtureSet", "fixtures", "schemaVersion"] as const
const TARGET_KEYS = ["fileRole", "language", "path"] as const
const EXPECTATION_KEYS = ["blockReason", "conflicts", "envelopeStatus", "resolutionStatus", "selected", "shadowed"] as const
const RULE_REFERENCE_KEYS = ["id", "layer"] as const
const CONFLICT_KEYS = ["reason", "ruleIds", "topic"] as const
const BUDGET_KEYS = ["maxCapsules", "maxChars"] as const
const BLOCK_REASONS = ["malformed-input", "resolution-blocked", "budget-exceeded", "unsafe-content"] as const
const CONTEXT_INPUT_KEYS = [
  "productInvariants",
  "taskDecisions",
  "projectContracts",
  "teamContracts",
  "personalRules",
  "languageDefaults",
  "commonDefaults",
] as const

export function parseContextComparisonManifest(value: unknown): ContextComparisonManifest | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, MANIFEST_KEYS) || value.schemaVersion !== CONTEXT_COMPARISON_MANIFEST_SCHEMA) return undefined
  if (value.fixtureSet !== CONTEXT_COMPARISON_FIXTURE_SET || !Array.isArray(value.fixtures)) return undefined
  const fixtures = value.fixtures.map(parseFixture)
  if (fixtures.some((fixture) => fixture === undefined)) return undefined
  const parsed = fixtures as readonly ContextComparisonFixture[]
  return hasRequiredFixtureSet(parsed)
    ? { fixtureSet: value.fixtureSet, fixtures: parsed, schemaVersion: CONTEXT_COMPARISON_MANIFEST_SCHEMA }
    : undefined
}

export function parseContextComparisonCandidate(value: unknown): ContextComparisonCandidate | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, ["commit", "packageVersion"])) return undefined
  if (typeof value.commit !== "string" || !/^[0-9a-f]{7,64}$/u.test(value.commit)) return undefined
  if (typeof value.packageVersion !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value.packageVersion)) return undefined
  return { commit: value.commit, packageVersion: value.packageVersion }
}

export function contextComparisonRules(input: EffectiveContextInput): readonly { readonly layer: ContextLayer; readonly rule: ContextRule }[] {
  return CONTEXT_INPUT_KEYS.flatMap((key) => input[key].map((rule) => ({ layer: layerFor(key), rule })))
}

function parseFixture(value: unknown): ContextComparisonFixture | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, FIXTURE_KEYS)) return undefined
  const id = parseFixtureId(value.id)
  const target = parseTarget(value.target)
  const context = parseEffectiveContextInput(value.context)
  const expectation = parseExpectation(value.expectation)
  const budget = parseBudget(value.budget)
  if (id === undefined || target === undefined || context === undefined || expectation === undefined || budget === undefined) return undefined
  if (!isSafeText(value.task, 500) || (value.claimScope !== "context-resolution" && value.claimScope !== "core-portability-only")) return undefined
  if (value.deliveryAttempts !== 1 && value.deliveryAttempts !== 2) return undefined
  if (!hasUniqueRuleIds(context)) return undefined
  return { budget, claimScope: value.claimScope, context, deliveryAttempts: value.deliveryAttempts, expectation, id, target, task: value.task }
}

function parseBudget(value: unknown): ContextComparisonBudget | undefined {
  if (value === undefined) return { maxCapsules: 8, maxChars: 1_600 }
  if (!isRecord(value) || !hasOnlyKeys(value, BUDGET_KEYS)) return undefined
  const maxCapsules = value.maxCapsules
  const maxChars = value.maxChars
  if (typeof maxCapsules !== "number" || !Number.isInteger(maxCapsules) || maxCapsules < 1 || maxCapsules > 8) return undefined
  if (typeof maxChars !== "number" || !Number.isInteger(maxChars) || maxChars < 1 || maxChars > 1_600) return undefined
  return { maxCapsules, maxChars }
}

function parseFixtureId(value: unknown): ContextComparisonFixtureId | undefined {
  return REQUIRED_CONTEXT_COMPARISON_FIXTURE_IDS.includes(value as ContextComparisonFixtureId) ? value as ContextComparisonFixtureId : undefined
}

function parseTarget(value: unknown): ContextComparisonTarget | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, TARGET_KEYS)) return undefined
  if (!isSafeIdentifier(value.fileRole) || !isSafeIdentifier(value.language) || !isSafeRelativePath(value.path)) return undefined
  return { fileRole: value.fileRole, language: value.language, path: value.path }
}

function parseExpectation(value: unknown): ContextComparisonExpectation | undefined {
  if (!isRecord(value) || !hasOnlyKeys(value, EXPECTATION_KEYS)) return undefined
  const selected = parseRuleReferences(value.selected)
  const shadowed = parseRuleReferences(value.shadowed)
  const conflicts = parseConflicts(value.conflicts)
  if (selected === undefined || shadowed === undefined || conflicts === undefined) return undefined
  if (value.resolutionStatus !== "blocked" && value.resolutionStatus !== "resolved") return undefined
  if (value.envelopeStatus !== "blocked" && value.envelopeStatus !== "resolved") return undefined
  const blockReason = parseBlockReason(value.blockReason)
  if ((value.envelopeStatus === "blocked" && blockReason === undefined) || (value.envelopeStatus === "resolved" && value.blockReason !== undefined)) return undefined
  return {
    ...(blockReason === undefined ? {} : { blockReason }),
    conflicts,
    envelopeStatus: value.envelopeStatus,
    resolutionStatus: value.resolutionStatus,
    selected,
    shadowed,
  }
}

function parseRuleReferences(value: unknown): readonly ContextComparisonRuleReference[] | undefined {
  if (!Array.isArray(value)) return undefined
  const references = value.map((entry) => {
    if (!isRecord(entry) || !hasOnlyKeys(entry, RULE_REFERENCE_KEYS)) return undefined
    if (!isSafeIdentifier(entry.id) || !isContextLayer(entry.layer)) return undefined
    return { id: entry.id, layer: entry.layer }
  })
  return references.some((entry) => entry === undefined) ? undefined : references as readonly ContextComparisonRuleReference[]
}

function parseConflicts(value: unknown): readonly ContextComparisonConflict[] | undefined {
  if (!Array.isArray(value)) return undefined
  const conflicts = value.map((entry) => {
    if (!isRecord(entry) || !hasOnlyKeys(entry, CONFLICT_KEYS) || entry.reason !== "same-layer-conflict") return undefined
    if (!isSafeIdentifier(entry.topic) || !Array.isArray(entry.ruleIds) || entry.ruleIds.length < 2 || entry.ruleIds.some((id) => !isSafeIdentifier(id))) return undefined
    const ruleIds = [...entry.ruleIds].sort()
    if (ruleIds.join("\u0000") !== entry.ruleIds.join("\u0000")) return undefined
    return { reason: "same-layer-conflict" as const, ruleIds, topic: entry.topic }
  })
  return conflicts.some((entry) => entry === undefined) ? undefined : conflicts as readonly ContextComparisonConflict[]
}

function parseBlockReason(value: unknown): ContextEnvelopeBlockReason | undefined {
  return BLOCK_REASONS.includes(value as ContextEnvelopeBlockReason) ? value as ContextEnvelopeBlockReason : undefined
}

function hasRequiredFixtureSet(fixtures: readonly ContextComparisonFixture[]): boolean {
  const ids = fixtures.map((fixture) => fixture.id).sort()
  const required = [...REQUIRED_CONTEXT_COMPARISON_FIXTURE_IDS].sort()
  return ids.length === required.length && ids.every((id, index) => id === required[index])
}

function hasUniqueRuleIds(input: EffectiveContextInput): boolean {
  const seen = new Set<string>()
  for (const { rule } of contextComparisonRules(input)) {
    if (seen.has(rule.id)) return false
    seen.add(rule.id)
  }
  return true
}

function layerFor(key: (typeof CONTEXT_INPUT_KEYS)[number]): ContextLayer {
  if (key === "productInvariants") return "invariant"
  if (key === "taskDecisions") return "task"
  if (key === "projectContracts") return "project"
  if (key === "teamContracts") return "team"
  if (key === "personalRules") return "personal"
  if (key === "languageDefaults") return "language"
  return "common"
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys)
  return Object.keys(value).every((key) => allowed.has(key))
}

function isContextLayer(value: unknown): value is ContextLayer {
  return CONTEXT_COMPARISON_LAYERS.includes(value as ContextLayer)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{0,119}$/u.test(value)
}

function isSafeRelativePath(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 240
    && !value.startsWith("/") && !value.includes("\\") && !value.split("/").includes("..")
    && !/[\u0000-\u001f\u007f]/u.test(value)
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f\u007f]/u.test(value)
}
