import type {
  ContextRelevance,
  ContextRule,
  ContextScope,
  EffectiveContextInput,
} from "./rule-types.js"

const INPUT_KEYS = [
  "commonDefaults",
  "languageDefaults",
  "maxCapsules",
  "personalProfileAvailable",
  "personalRules",
  "productInvariants",
  "projectContracts",
  "relevance",
  "taskDecisions",
  "teamContracts",
] as const
const RELEVANCE_KEYS = ["fileRole", "language", "projectKey", "skillIds", "taskKey", "teamKey", "topics"] as const
const RULE_KEYS = ["fileRoles", "id", "languages", "rule", "scope", "skillIds", "status", "topic"] as const
const SCOPE_KEYS = ["key", "kind"] as const
export const MAX_CONTEXT_CAPSULES = 16

export function parseEffectiveContextInput(value: unknown): EffectiveContextInput | undefined {
  if (!isRecord(value) || !hasRecognizedKeys(value, INPUT_KEYS)) return undefined
  if (!isRuleArray(value.productInvariants) || !isRuleArray(value.taskDecisions)
    || !isRuleArray(value.projectContracts) || !isRuleArray(value.teamContracts)
    || !isRuleArray(value.personalRules) || !isRuleArray(value.languageDefaults)
    || !isRuleArray(value.commonDefaults)) return undefined
  const relevance = parseRelevance(value.relevance)
  if (relevance === undefined) return undefined
  if (!isValidMaxCapsules(value.maxCapsules) || !isValidAvailability(value.personalProfileAvailable)) return undefined
  return {
    commonDefaults: value.commonDefaults,
    languageDefaults: value.languageDefaults,
    maxCapsules: value.maxCapsules,
    personalProfileAvailable: value.personalProfileAvailable,
    personalRules: value.personalRules,
    productInvariants: value.productInvariants,
    projectContracts: value.projectContracts,
    relevance,
    taskDecisions: value.taskDecisions,
    teamContracts: value.teamContracts,
  }
}

export function matchesContextRelevance(rule: ContextRule, relevance: ContextRelevance): boolean {
  if (!relevance.topics.includes(rule.topic)) return false
  if (!matchesScope(rule.scope, relevance)) return false
  if (rule.fileRoles !== undefined && !rule.fileRoles.includes(relevance.fileRole)) return false
  if (rule.languages !== undefined && !rule.languages.includes(relevance.language)) return false
  return rule.skillIds === undefined || rule.skillIds.some((skill) => relevance.skillIds.includes(skill))
}

export function contextSelectionReason(rule: ContextRule): string {
  return [
    "topic",
    "scope",
    ...(rule.fileRoles !== undefined && rule.fileRoles.length > 0 ? ["file-role"] : []),
    ...(rule.languages !== undefined && rule.languages.length > 0 ? ["language"] : []),
    ...(rule.skillIds !== undefined && rule.skillIds.length > 0 ? ["skill"] : []),
  ].join("+")
}

function parseRelevance(value: unknown): ContextRelevance | undefined {
  if (!isRecord(value) || !hasRecognizedKeys(value, RELEVANCE_KEYS)) return undefined
  if (!isStringArray(value.topics) || value.topics.length === 0 || value.topics.some((topic) => !isSafeIdentifier(topic))
    || !isSafeIdentifier(value.fileRole) || !isSafeIdentifier(value.language)
    || !isStringArray(value.skillIds) || value.skillIds.some((skill) => !isSafeIdentifier(skill))) return undefined
  if (!isOptionalIdentifier(value.projectKey) || !isOptionalIdentifier(value.taskKey) || !isOptionalIdentifier(value.teamKey)) return undefined
  return {
    fileRole: value.fileRole,
    language: value.language,
    projectKey: value.projectKey,
    skillIds: value.skillIds,
    taskKey: value.taskKey,
    teamKey: value.teamKey,
    topics: value.topics,
  }
}

function isRuleArray(value: unknown): value is ContextRule[] {
  return Array.isArray(value) && value.every((entry) => parseRule(entry) !== undefined)
}

function parseRule(value: unknown): ContextRule | undefined {
  if (!isRecord(value) || !hasRecognizedKeys(value, RULE_KEYS)) return undefined
  if (!isSafeIdentifier(value.id) || !isSafeIdentifier(value.topic) || !isSafeRuleText(value.rule)) return undefined
  if (!isSafeIdentifierArray(value.fileRoles) || !isSafeIdentifierArray(value.languages) || !isSafeIdentifierArray(value.skillIds)) return undefined
  if (value.status !== undefined && value.status !== "active" && value.status !== "pending" && value.status !== "superseded") return undefined
  const scope = parseScope(value.scope)
  if (value.scope !== undefined && scope === undefined) return undefined
  return {
    fileRoles: value.fileRoles,
    id: value.id,
    languages: value.languages,
    rule: value.rule,
    scope,
    skillIds: value.skillIds,
    status: value.status,
    topic: value.topic,
  }
}

function parseScope(value: unknown): ContextScope | null | undefined {
  if (value === undefined || value === null) return value
  if (!isRecord(value) || !hasRecognizedKeys(value, SCOPE_KEYS)
    || (value.kind !== "project" && value.kind !== "task" && value.kind !== "team")
    || !isSafeIdentifier(value.key)) return undefined
  return { key: value.key, kind: value.kind }
}

function matchesScope(scope: ContextScope | null | undefined, relevance: ContextRelevance): boolean {
  if (scope === undefined || scope === null) return true
  if (scope.kind === "project") return relevance.projectKey === scope.key
  if (scope.kind === "task") return relevance.taskKey === scope.key
  return relevance.teamKey === scope.key
}

function isValidMaxCapsules(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_CONTEXT_CAPSULES)
}

function isValidAvailability(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean"
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

function isSafeIdentifierArray(value: unknown): value is string[] | undefined {
  return value === undefined || (isStringArray(value) && value.every((item) => isSafeIdentifier(item)))
}

function isOptionalIdentifier(value: unknown): value is string | undefined {
  return value === undefined || isSafeIdentifier(value)
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
