import type { ContextRule } from "../context-core/rule-types.js"

export const TEAM_PROFILE_V2_SCHEMA = "persona-context-team-profile.2" as const

export type TeamProfileV2Relevance = {
  readonly fileRoles?: readonly string[]
  readonly languages?: readonly string[]
  readonly skillIds?: readonly string[]
}

export type TeamProfileV2Rule = {
  readonly id: string
  readonly topic: string
  readonly text: string
  readonly status: "active" | "pending" | "superseded"
  readonly relevance?: TeamProfileV2Relevance
}

export type TeamProfileV2 = {
  readonly schemaVersion: typeof TEAM_PROFILE_V2_SCHEMA
  readonly teamKey: string
  readonly rules: readonly TeamProfileV2Rule[]
}

export type TeamContextLayerV2 = {
  readonly teamKey: string
  readonly teamContracts: readonly ContextRule[]
}

export type TeamProfileV2ValidationCode = "team-profile-v2-invalid-schema" | "team-profile-v2-unsafe-content"

export class TeamProfileV2ValidationError extends Error {
  readonly code: TeamProfileV2ValidationCode

  constructor(code: TeamProfileV2ValidationCode) {
    super(code)
    this.name = "TeamProfileV2ValidationError"
    this.code = code
  }
}

const PROFILE_KEYS = ["rules", "schemaVersion", "teamKey"] as const
const RULE_KEYS = ["id", "relevance", "status", "text", "topic"] as const
const RELEVANCE_KEYS = ["fileRoles", "languages", "skillIds"] as const
const MAX_RULES = 64
const MAX_RULE_TEXT_CHARS = 600
const MAX_SELECTOR_VALUES = 16

export function parseTeamProfileV2(value: unknown): TeamProfileV2 {
  if (!isRecord(value) || !hasExactKeys(value, PROFILE_KEYS) || value.schemaVersion !== TEAM_PROFILE_V2_SCHEMA || !isSafeIdentifier(value.teamKey)) {
    throw new TeamProfileV2ValidationError("team-profile-v2-invalid-schema")
  }
  if (!Array.isArray(value.rules) || value.rules.length > MAX_RULES) {
    throw new TeamProfileV2ValidationError("team-profile-v2-invalid-schema")
  }
  const rules = value.rules.map(parseRule)
  if (hasDuplicate(rules.map((rule) => rule.id)) || hasActiveTopicConflict(rules)) {
    throw new TeamProfileV2ValidationError("team-profile-v2-invalid-schema")
  }
  return { rules, schemaVersion: TEAM_PROFILE_V2_SCHEMA, teamKey: value.teamKey }
}

export function toTeamContextLayerV2(profile: TeamProfileV2): TeamContextLayerV2 {
  return {
    teamContracts: profile.rules.map((rule) => ({
      fileRoles: rule.relevance?.fileRoles,
      id: rule.id,
      languages: rule.relevance?.languages,
      rule: rule.text,
      scope: { key: profile.teamKey, kind: "team" },
      skillIds: rule.relevance?.skillIds,
      status: rule.status,
      topic: rule.topic,
    })),
    teamKey: profile.teamKey,
  }
}

function parseRule(value: unknown): TeamProfileV2Rule {
  if (!isRecord(value) || !hasRequiredKnownKeys(value, RULE_KEYS, ["id", "status", "text", "topic"])) {
    throw new TeamProfileV2ValidationError("team-profile-v2-invalid-schema")
  }
  if (!isSafeIdentifier(value.id) || !isSafeIdentifier(value.topic) || !isSafeRuleText(value.text)) {
    throw new TeamProfileV2ValidationError("team-profile-v2-unsafe-content")
  }
  if (value.status !== "active" && value.status !== "pending" && value.status !== "superseded") {
    throw new TeamProfileV2ValidationError("team-profile-v2-invalid-schema")
  }
  const relevance = parseRelevance(value.relevance)
  if (value.relevance !== undefined && relevance === undefined) {
    throw new TeamProfileV2ValidationError("team-profile-v2-invalid-schema")
  }
  return { id: value.id, relevance, status: value.status, text: value.text, topic: value.topic }
}

function parseRelevance(value: unknown): TeamProfileV2Relevance | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value) || !hasKnownKeys(value, RELEVANCE_KEYS) || Object.keys(value).length === 0) return undefined
  if (!isSafeSelector(value.fileRoles) || !isSafeSelector(value.languages) || !isSafeSelector(value.skillIds)) return undefined
  return { fileRoles: value.fileRoles, languages: value.languages, skillIds: value.skillIds }
}

function hasActiveTopicConflict(rules: readonly TeamProfileV2Rule[]): boolean {
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
  return value === undefined || (
    Array.isArray(value)
    && value.length > 0
    && value.length <= MAX_SELECTOR_VALUES
    && value.every(isSafeIdentifier)
    && !hasDuplicate(value)
  )
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2}|https?:\/\/)/u.test(value)
}

function isSafeRuleText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_RULE_TEXT_CHARS
    && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/(?:https?|ssh):\/\/|git@/iu.test(value)
    && !/(?:api[_-]?key|access[_-]?token|token|credential|password|secret|authorization|private\s+key)\s*[:=]/iu.test(value)
    && !/\bbearer\s+[A-Za-z0-9._-]+/iu.test(value)
    && !/(?:^|\s)(?:[A-Za-z]:[\\/]|[\\/]{1,2})[^\s]*/u.test(value)
    && !/(?:^|\s)(?:curl|wget|git\s+(?:clone|fetch|pull)|npm\s+(?:install|exec|run)|npx\s|node\s|python(?:3)?\s|gradle(?:w)?\s|mvn(?:w)?\s|maven\s|java\s|make\s|go\s+(?:test|build|run)\s|cargo\s|deno\s|ruby\s|php\s|perl\s|dotnet\s|bash\s|sh\s|zsh\s|pwsh\s|powershell\s|cmd(?:\.exe)?\s|\.\/)[^\s]*/iu.test(value)
    && !/\b(?:disable|bypass|override|weaken|turn\s+off)\b.{0,80}\b(?:authority|authentication|evidence|guard|permission|policy|security|verification)\b/iu.test(value)
    && !/\b(?:my\s+(?:personal|private)\s+(?:preference|profile|rule|setting)|personal\s+(?:preference|profile|setting))\b|(?:나의|개인)\s*(?:선호|취향|정보)/iu.test(value)
}
