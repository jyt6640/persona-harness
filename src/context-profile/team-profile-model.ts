import type { ContextRule } from "../context-core/rule-types.js"

export const TEAM_PROFILE_SCHEMA = "persona-team-profile.v1" as const

export type TeamProfileRule = {
  readonly id: string
  readonly topic: string
  readonly rule: string
  readonly status: "active" | "pending" | "superseded"
  readonly fileRoles?: readonly string[]
  readonly languages?: readonly string[]
  readonly skillIds?: readonly string[]
}

export type TeamProfile = {
  readonly schemaVersion: typeof TEAM_PROFILE_SCHEMA
  readonly teamKey: string
  readonly rules: readonly TeamProfileRule[]
}

export type TeamProfileValidationCode = "team-profile-invalid-schema" | "team-profile-unsafe-content"

export class TeamProfileValidationError extends Error {
  readonly code: TeamProfileValidationCode

  constructor(code: TeamProfileValidationCode) {
    super(code)
    this.name = "TeamProfileValidationError"
    this.code = code
  }
}

const PROFILE_KEYS = ["rules", "schemaVersion", "teamKey"] as const
const RULE_KEYS = ["fileRoles", "id", "languages", "rule", "skillIds", "status", "topic"] as const
const MAX_RULES = 64
const MAX_RULE_TEXT_CHARS = 600
const MAX_SELECTOR_VALUES = 16

export function parseTeamProfile(value: unknown): TeamProfile {
  if (!isRecord(value) || !hasExactKeys(value, PROFILE_KEYS) || value.schemaVersion !== TEAM_PROFILE_SCHEMA || !isSafeIdentifier(value.teamKey)) {
    throw new TeamProfileValidationError("team-profile-invalid-schema")
  }
  if (!Array.isArray(value.rules) || value.rules.length > MAX_RULES) throw new TeamProfileValidationError("team-profile-invalid-schema")
  const rules = value.rules.map(parseRule)
  if (hasDuplicate(rules.map((rule) => rule.id)) || hasActiveTopicConflict(rules)) {
    throw new TeamProfileValidationError("team-profile-invalid-schema")
  }
  return { rules, schemaVersion: TEAM_PROFILE_SCHEMA, teamKey: value.teamKey }
}

export function toTeamContextRules(profile: TeamProfile): readonly ContextRule[] {
  return profile.rules.map((rule) => ({
    fileRoles: rule.fileRoles,
    id: rule.id,
    languages: rule.languages,
    rule: rule.rule,
    scope: { key: profile.teamKey, kind: "team" },
    skillIds: rule.skillIds,
    status: rule.status,
    topic: rule.topic,
  }))
}

function parseRule(value: unknown): TeamProfileRule {
  if (!isRecord(value) || !hasRequiredKnownKeys(value, RULE_KEYS, ["id", "rule", "status", "topic"])) {
    throw new TeamProfileValidationError("team-profile-invalid-schema")
  }
  if (!isSafeIdentifier(value.id) || !isSafeIdentifier(value.topic) || !isSafeRuleText(value.rule)) {
    throw new TeamProfileValidationError("team-profile-unsafe-content")
  }
  if (!isSafeSelector(value.fileRoles) || !isSafeSelector(value.languages) || !isSafeSelector(value.skillIds)) {
    throw new TeamProfileValidationError("team-profile-invalid-schema")
  }
  if (value.status !== "active" && value.status !== "pending" && value.status !== "superseded") {
    throw new TeamProfileValidationError("team-profile-invalid-schema")
  }
  return {
    fileRoles: value.fileRoles,
    id: value.id,
    languages: value.languages,
    rule: value.rule,
    skillIds: value.skillIds,
    status: value.status,
    topic: value.topic,
  }
}

function hasActiveTopicConflict(rules: readonly TeamProfileRule[]): boolean {
  const activeTopics = new Set<string>()
  for (const rule of rules) {
    if (rule.status !== "active") continue
    if (activeTopics.has(rule.topic)) return true
    activeTopics.add(rule.topic)
  }
  return false
}

function hasDuplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys<T extends readonly string[]>(value: Record<string, unknown>, keys: T): boolean {
  return Object.keys(value).length === keys.length && hasKnownKeys(value, keys)
}

function hasRequiredKnownKeys<T extends readonly string[]>(
  value: Record<string, unknown>,
  knownKeys: T,
  requiredKeys: readonly string[],
): boolean {
  return hasKnownKeys(value, knownKeys) && requiredKeys.every((key) => Object.hasOwn(value, key))
}

function hasKnownKeys<T extends readonly string[]>(value: Record<string, unknown>, keys: T): boolean {
  const expected = new Set(keys)
  return Object.keys(value).every((key) => expected.has(key))
}

function isSafeSelector(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.length <= MAX_SELECTOR_VALUES && value.every(isSafeIdentifier))
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|https?:\/\/)/u.test(value)
}

function isSafeRuleText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_RULE_TEXT_CHARS
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/(?:https?:\/\/|(?:api[_-]?key|access[_-]?token|token|credential|password|secret|authorization)\s*[:=])/iu.test(value)
    && !/(?:^|\s)(?:[A-Za-z]:[\\/]|[\\/]{1,2})[^\s]*/u.test(value)
    && !/(?:^|\n|\s)(?:bash|cmd|curl|fish|git|gradle|java|node|npm|npx|powershell|pwsh|python|rm|sh|wget|zsh)\b/iu.test(value)
    && !/(?:\b(?:send|post|transmit|upload|exfiltrat(?:e|ion)?)\b.*\b(?:credentials?|tokens?|secrets?|passwords?|data)\b|\b(?:credentials?|tokens?|secrets?|passwords?)\b.*\b(?:send|post|transmit|upload|exfiltrat(?:e|ion)?)\b)/iu.test(value)
    && !/\b(?:disable|bypass|override|weaken)\b.*\b(?:authority|authentication|evidence|guard|permission|policy|security|verification)\b/iu.test(value)
    && !/\b(?:my\s+(?:personal|private)|personal\s+preference)\b|(?:나의|개인)\s*(?:선호|취향|정보)/iu.test(value)
}
