import { STARTER_PROFILE } from "../cli/personalization-profile-store.js"
import type { PersonalizationScope } from "../cli/personalization-profile-model.js"

export const EFFECTIVE_PROFILE_SCHEMA = "effective-profile.v1" as const

export type EffectiveProfileLayer = "invariant" | "task" | "project" | "personal" | "starter"

export type EffectiveProfileBlockReason =
  | "malformed-input"
  | "profile-unavailable"
  | "ambiguous-conflict"
  | "selection-overflow"

export type EffectiveProfileRuleInput = {
  readonly id: string
  readonly topic: string
  readonly rule: string
  readonly scope?: PersonalizationScope | null
  readonly fileRoles?: readonly string[]
  readonly skillIds?: readonly string[]
  readonly status?: "active" | "pending" | "superseded"
}

export type EffectiveProfileRelevance = {
  readonly topics: readonly string[]
  readonly fileRole: string
  readonly skillIds: readonly string[]
  readonly projectKey?: string
  readonly taskKey?: string
}

export type EffectiveProfileResolutionInput = {
  readonly productInvariants: readonly EffectiveProfileRuleInput[]
  readonly taskDecisions: readonly EffectiveProfileRuleInput[]
  readonly projectContracts: readonly EffectiveProfileRuleInput[]
  readonly personalRules: readonly EffectiveProfileRuleInput[]
  readonly starterDefaults: readonly EffectiveProfileRuleInput[]
  readonly relevance: EffectiveProfileRelevance
  readonly maxCapsules?: number
  readonly personalProfileAvailable?: boolean
}

export type EffectiveProfileCapsule = {
  readonly id: string
  readonly source: EffectiveProfileLayer
  readonly topic: string
  readonly rule: string
}

export type EffectiveProfileSelection = {
  readonly id: string
  readonly source: EffectiveProfileLayer
  readonly topic: string
  readonly reason: string
}

export type EffectiveProfileResolution =
  | {
      readonly status: "resolved"
      readonly capsules: readonly EffectiveProfileCapsule[]
      readonly selections: readonly EffectiveProfileSelection[]
    }
  | {
      readonly status: "blocked"
      readonly reason: EffectiveProfileBlockReason
      readonly capsules: readonly []
      readonly selections: readonly []
    }

type Candidate = {
  readonly rule: EffectiveProfileRuleInput
  readonly source: EffectiveProfileLayer
  readonly priority: number
  readonly reason: string
}

const INPUT_KEYS = [
  "maxCapsules",
  "personalProfileAvailable",
  "personalRules",
  "productInvariants",
  "projectContracts",
  "relevance",
  "starterDefaults",
  "taskDecisions",
] as const
const RELEVANCE_KEYS = ["fileRole", "projectKey", "skillIds", "taskKey", "topics"] as const
const RULE_KEYS = ["fileRoles", "id", "rule", "scope", "skillIds", "status", "topic"] as const
const SCOPE_KEYS = ["key", "kind"] as const
const MAX_CAPSULES = 16

const LAYER_DEFINITIONS: readonly {
  readonly key: keyof Pick<EffectiveProfileResolutionInput, "productInvariants" | "taskDecisions" | "projectContracts" | "personalRules" | "starterDefaults">
  readonly source: EffectiveProfileLayer
  readonly priority: number
}[] = [
  { key: "productInvariants", priority: 4, source: "invariant" },
  { key: "taskDecisions", priority: 3, source: "task" },
  { key: "projectContracts", priority: 2, source: "project" },
  { key: "personalRules", priority: 1, source: "personal" },
  { key: "starterDefaults", priority: 0, source: "starter" },
]

const PRODUCT_SAFETY_INVARIANTS: readonly EffectiveProfileRuleInput[] = [
  {
    id: "invariant-no-inference",
    rule: "Do not infer unknown or conflicting decisions; stop for explicit input.",
    status: "active",
    topic: "safety-no-inference",
  },
  {
    id: "invariant-no-sensitive-persistence",
    rule: "Keep raw prompts, output, source, credentials, and absolute paths out of profile state.",
    status: "active",
    topic: "safety-no-sensitive-persistence",
  },
]

export function createProductSafetyInvariants(): readonly EffectiveProfileRuleInput[] {
  return PRODUCT_SAFETY_INVARIANTS.map((rule) => ({ ...rule }))
}

export function createStarterProfileDefaults(): readonly EffectiveProfileRuleInput[] {
  return STARTER_PROFILE.map((rule, index) => ({
    id: `starter-${index + 1}`,
    rule,
    status: "active" as const,
    topic: `starter-${index + 1}`,
  }))
}

export function resolveEffectiveProfile(value: unknown): EffectiveProfileResolution {
  const parsed = parseInput(value)
  if (parsed === undefined) return blocked("malformed-input")
  if (parsed.personalProfileAvailable === false) return blocked("profile-unavailable")

  const candidates: Candidate[] = []
  for (const definition of LAYER_DEFINITIONS) {
    for (const rule of parsed[definition.key]) {
      if (rule.status !== undefined && rule.status !== "active") continue
      if (!matchesRelevance(rule, parsed.relevance)) continue
      candidates.push({
        priority: definition.priority,
        reason: selectionReason(rule),
        rule,
        source: definition.source,
      })
    }
  }

  const selected: Candidate[] = []
  const byTopic = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const topicCandidates = byTopic.get(candidate.rule.topic) ?? []
    topicCandidates.push(candidate)
    byTopic.set(candidate.rule.topic, topicCandidates)
  }
  for (const topicCandidates of byTopic.values()) {
    const highestPriority = Math.max(...topicCandidates.map((candidate) => candidate.priority))
    const highest = topicCandidates.filter((candidate) => candidate.priority === highestPriority)
    if (highest.length > 1) return blocked("ambiguous-conflict")
    selected.push(highest[0])
  }

  selected.sort((left, right) =>
    right.priority - left.priority
    || left.rule.topic.localeCompare(right.rule.topic)
    || left.rule.id.localeCompare(right.rule.id),
  )
  if (selected.length > (parsed.maxCapsules ?? 8)) return blocked("selection-overflow")

  return {
    capsules: selected.map(({ rule, source }) => ({ id: rule.id, rule: rule.rule, source, topic: rule.topic })),
    selections: selected.map(({ rule, reason, source }) => ({ id: rule.id, reason, source, topic: rule.topic })),
    status: "resolved",
  }
}

function parseInput(value: unknown): EffectiveProfileResolutionInput | undefined {
  if (!isRecord(value) || !hasExactKeys(value, INPUT_KEYS)) return undefined
  if (!isRuleArray(value.productInvariants) || !isRuleArray(value.taskDecisions)
    || !isRuleArray(value.projectContracts) || !isRuleArray(value.personalRules)
    || !isRuleArray(value.starterDefaults)) return undefined
  const relevance = parseRelevance(value.relevance)
  if (relevance === undefined) return undefined
  const maxCapsules = value.maxCapsules
  if (maxCapsules !== undefined && (typeof maxCapsules !== "number" || !Number.isInteger(maxCapsules) || maxCapsules < 1 || maxCapsules > MAX_CAPSULES)) {
    return undefined
  }
  const personalProfileAvailable = value.personalProfileAvailable
  if (personalProfileAvailable !== undefined && typeof personalProfileAvailable !== "boolean") return undefined
  return {
    maxCapsules,
    personalProfileAvailable,
    personalRules: value.personalRules,
    productInvariants: value.productInvariants,
    projectContracts: value.projectContracts,
    relevance,
    starterDefaults: value.starterDefaults,
    taskDecisions: value.taskDecisions,
  }
}

function parseRelevance(value: unknown): EffectiveProfileRelevance | undefined {
  if (!isRecord(value) || !hasExactKeys(value, RELEVANCE_KEYS)) return undefined
  if (!isStringArray(value.topics) || value.topics.length === 0 || value.topics.some((topic) => !isSafeIdentifier(topic))
    || !isSafeIdentifier(value.fileRole) || !isStringArray(value.skillIds)
    || value.skillIds.some((skill) => !isSafeIdentifier(skill))) return undefined
  if (value.projectKey !== undefined && !isSafeIdentifier(value.projectKey)) return undefined
  if (value.taskKey !== undefined && !isSafeIdentifier(value.taskKey)) return undefined
  return {
    fileRole: value.fileRole,
    projectKey: value.projectKey,
    skillIds: value.skillIds,
    taskKey: value.taskKey,
    topics: value.topics,
  }
}

function isRuleArray(value: unknown): value is EffectiveProfileRuleInput[] {
  return Array.isArray(value) && value.every((entry) => parseRule(entry) !== undefined)
}

function parseRule(value: unknown): EffectiveProfileRuleInput | undefined {
  if (!isRecord(value) || !hasExactKeys(value, RULE_KEYS)) return undefined
  if (!isSafeIdentifier(value.id) || !isSafeIdentifier(value.topic) || !isSafeRuleText(value.rule)) return undefined
  if (value.fileRoles !== undefined && (!isStringArray(value.fileRoles) || value.fileRoles.some((role) => !isSafeIdentifier(role)))) return undefined
  if (value.skillIds !== undefined && (!isStringArray(value.skillIds) || value.skillIds.some((skill) => !isSafeIdentifier(skill)))) return undefined
  if (value.status !== undefined && value.status !== "active" && value.status !== "pending" && value.status !== "superseded") return undefined
  const scope = parseScope(value.scope)
  if (value.scope !== undefined && scope === undefined) return undefined
  return {
    fileRoles: value.fileRoles,
    id: value.id,
    rule: value.rule,
    scope,
    skillIds: value.skillIds,
    status: value.status,
    topic: value.topic,
  }
}

function parseScope(value: unknown): PersonalizationScope | null | undefined {
  if (value === undefined || value === null) return value
  if (!isRecord(value) || !hasExactKeys(value, SCOPE_KEYS) || (value.kind !== "personal" && value.kind !== "project" && value.kind !== "task") || !isSafeIdentifier(value.key)) {
    return undefined
  }
  return { kind: value.kind, key: value.key }
}

function matchesRelevance(rule: EffectiveProfileRuleInput, relevance: EffectiveProfileRelevance): boolean {
  if (!relevance.topics.includes(rule.topic)) return false
  if (rule.scope !== undefined && rule.scope !== null) {
    if (rule.scope.kind === "project" && relevance.projectKey !== rule.scope.key) return false
    if (rule.scope.kind === "task" && relevance.taskKey !== rule.scope.key) return false
  }
  if (rule.fileRoles !== undefined && !rule.fileRoles.includes(relevance.fileRole)) return false
  if (rule.skillIds !== undefined && !rule.skillIds.some((skill) => relevance.skillIds.includes(skill))) return false
  return true
}

function selectionReason(rule: EffectiveProfileRuleInput): string {
  return [
    "topic",
    "scope",
    ...(rule.fileRoles !== undefined && rule.fileRoles.length > 0 ? ["file-role"] : []),
    ...(rule.skillIds !== undefined && rule.skillIds.length > 0 ? ["skill"] : []),
  ].join("+")
}

function blocked(reason: EffectiveProfileBlockReason): EffectiveProfileResolution {
  return { capsules: [], reason, selections: [], status: "blocked" }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys<T extends readonly string[]>(value: Record<string, unknown>, keys: T): boolean {
  const expected = new Set(keys)
  return Object.keys(value).every((key) => expected.has(key))
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(item))
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|https?:\/\/)/u.test(value)
}

function isSafeRuleText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1_000
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/(?:https?:\/\/|(?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=])/iu.test(value)
    && !/(?:^|\s)(?:[A-Za-z]:[\\/]|[\\/]{1,2})[^\s]*/u.test(value)
}
