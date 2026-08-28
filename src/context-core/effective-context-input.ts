import type {
  EffectiveProfileRelevance,
  EffectiveProfileResolutionInput,
  EffectiveProfileRuleInput,
  EffectiveProfileScope,
} from "./rule-types.js"

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
export const MAX_EFFECTIVE_PROFILE_CAPSULES = 16

export function parseEffectiveProfileInput(value: unknown): EffectiveProfileResolutionInput | undefined {
  if (!isRecord(value) || !hasRecognizedKeys(value, INPUT_KEYS)) return undefined
  if (!isRuleArray(value.productInvariants) || !isRuleArray(value.taskDecisions)
    || !isRuleArray(value.projectContracts) || !isRuleArray(value.personalRules)
    || !isRuleArray(value.starterDefaults)) return undefined
  const relevance = parseRelevance(value.relevance)
  if (relevance === undefined) return undefined
  const maxCapsules = value.maxCapsules
  if (
    maxCapsules !== undefined
    && (typeof maxCapsules !== "number" || !Number.isInteger(maxCapsules) || maxCapsules < 1 || maxCapsules > MAX_EFFECTIVE_PROFILE_CAPSULES)
  ) return undefined
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

export function matchesEffectiveProfileRelevance(
  rule: EffectiveProfileRuleInput,
  relevance: EffectiveProfileRelevance,
): boolean {
  if (!relevance.topics.includes(rule.topic)) return false
  if (rule.scope !== undefined && rule.scope !== null) {
    if (rule.scope.kind === "project" && relevance.projectKey !== rule.scope.key) return false
    if (rule.scope.kind === "task" && relevance.taskKey !== rule.scope.key) return false
  }
  if (rule.fileRoles !== undefined && !rule.fileRoles.includes(relevance.fileRole)) return false
  return rule.skillIds === undefined || rule.skillIds.some((skill) => relevance.skillIds.includes(skill))
}

export function effectiveProfileSelectionReason(rule: EffectiveProfileRuleInput): string {
  return [
    "topic",
    "scope",
    ...(rule.fileRoles !== undefined && rule.fileRoles.length > 0 ? ["file-role"] : []),
    ...(rule.skillIds !== undefined && rule.skillIds.length > 0 ? ["skill"] : []),
  ].join("+")
}

function parseRelevance(value: unknown): EffectiveProfileRelevance | undefined {
  if (!isRecord(value) || !hasRecognizedKeys(value, RELEVANCE_KEYS)) return undefined
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
  if (!isRecord(value) || !hasRecognizedKeys(value, RULE_KEYS)) return undefined
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

function parseScope(value: unknown): EffectiveProfileScope | null | undefined {
  if (value === undefined || value === null) return value
  if (!isRecord(value) || !hasRecognizedKeys(value, SCOPE_KEYS)
    || (value.kind !== "personal" && value.kind !== "project" && value.kind !== "task")
    || !isSafeIdentifier(value.key)) return undefined
  return { kind: value.kind, key: value.key }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasRecognizedKeys<T extends readonly string[]>(value: Record<string, unknown>, keys: T): boolean {
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
