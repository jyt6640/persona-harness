export const PERSONALIZATION_CANDIDATE_SCHEMA = "personalization-candidate.v1" as const
export const PERSONALIZATION_RULE_SCHEMA = "personalization-rule.v1" as const
export const PERSONALIZATION_DECISION_SCHEMA = "personalization-decision.v1" as const
export const PERSONALIZATION_PROFILE_SCHEMA = "personalization-profile.v1" as const
export const PERSONALIZATION_HISTORY_SCHEMA = "personalization-history.v1" as const
export const PERSONALIZATION_STORE_SCHEMA = "personalization-store.v1" as const

export type PersonalizationScope = {
  readonly kind: "personal" | "project" | "task"
  readonly key: string
}

export type PersonalizationProvenance = {
  readonly kind: "user" | "review" | "workflow"
  readonly reference: string
}

export type PersonalizationCandidate = {
  readonly schemaVersion: typeof PERSONALIZATION_CANDIDATE_SCHEMA
  readonly candidateId: string
  readonly topic: string
  readonly rule: string
  readonly rationale: string
  readonly outcome: string
  readonly scope: PersonalizationScope
  readonly counterexample: string
  readonly tradeoffs: string
  readonly provenance: PersonalizationProvenance
}

export type PersonalizationRule = Omit<PersonalizationCandidate, "candidateId" | "schemaVersion"> & {
  readonly schemaVersion: typeof PERSONALIZATION_RULE_SCHEMA
  readonly ruleId: string
  readonly activatedAt: string
}

export type PersonalizationDecisionAction = "activate" | "retain" | "exception" | "supersede" | "pending" | "rollback"

export type PersonalizationDecision = {
  readonly schemaVersion: typeof PERSONALIZATION_DECISION_SCHEMA
  readonly decisionId: string
  readonly action: PersonalizationDecisionAction
  readonly candidateId: string | null
  readonly ruleId: string | null
  readonly scope: PersonalizationScope | null
  readonly decidedAt: string
}

export type PersonalizationProfile = {
  readonly schemaVersion: typeof PERSONALIZATION_PROFILE_SCHEMA
  readonly activeRules: readonly PersonalizationRule[]
  readonly pendingCandidates: readonly PersonalizationCandidate[]
  readonly decisions: readonly PersonalizationDecision[]
}

export type PersonalizationHistoryEvent = {
  readonly schemaVersion: typeof PERSONALIZATION_HISTORY_SCHEMA
  readonly eventId: string
  readonly event: "activated" | "conflict" | "pending" | "retained" | "exception" | "superseded" | "rollback"
  readonly candidateId: string | null
  readonly ruleId: string | null
  readonly decisionId: string
  readonly occurredAt: string
}

export type PersonalizationHistory = {
  readonly schemaVersion: typeof PERSONALIZATION_HISTORY_SCHEMA
  readonly events: readonly PersonalizationHistoryEvent[]
}

export type PersonalizationStoreDocument = {
  readonly schemaVersion: typeof PERSONALIZATION_STORE_SCHEMA
  readonly profile: PersonalizationProfile
  readonly history: PersonalizationHistory
}

export class PersonalizationValidationError extends Error {
  readonly code: "personalization-candidate-invalid" | "personalization-store-corrupt"

  constructor(code: PersonalizationValidationError["code"]) {
    super(code)
    this.name = "PersonalizationValidationError"
    this.code = code
  }
}

const CANDIDATE_KEYS = ["candidateId", "counterexample", "outcome", "provenance", "rationale", "rule", "schemaVersion", "scope", "topic", "tradeoffs"] as const
const PROFILE_KEYS = ["activeRules", "decisions", "pendingCandidates", "schemaVersion"] as const
const STORE_KEYS = ["history", "profile", "schemaVersion"] as const
const DECISION_KEYS = ["action", "candidateId", "decidedAt", "decisionId", "ruleId", "schemaVersion", "scope"] as const
const RULE_KEYS = [...CANDIDATE_KEYS.filter((key) => key !== "candidateId" && key !== "schemaVersion"), "activatedAt", "ruleId", "schemaVersion"] as const

export function emptyPersonalizationStore(): PersonalizationStoreDocument {
  return {
    history: { events: [], schemaVersion: PERSONALIZATION_HISTORY_SCHEMA },
    profile: { activeRules: [], decisions: [], pendingCandidates: [], schemaVersion: PERSONALIZATION_PROFILE_SCHEMA },
    schemaVersion: PERSONALIZATION_STORE_SCHEMA,
  }
}

export function parsePersonalizationCandidate(value: unknown): PersonalizationCandidate {
  if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS)) throw new PersonalizationValidationError("personalization-candidate-invalid")
  const candidate = parseCandidateFields(value)
  if (candidate === undefined) throw new PersonalizationValidationError("personalization-candidate-invalid")
  return candidate
}

export function parsePersonalizationStore(value: unknown): PersonalizationStoreDocument {
  if (!isRecord(value) || !hasExactKeys(value, STORE_KEYS) || value.schemaVersion !== PERSONALIZATION_STORE_SCHEMA) {
    throw new PersonalizationValidationError("personalization-store-corrupt")
  }
  const profile = parseProfile(value.profile)
  const history = parseHistory(value.history)
  if (profile === undefined || history === undefined) {
    throw new PersonalizationValidationError("personalization-store-corrupt")
  }
  const decisionIds = new Set(profile.decisions.map((decision) => decision.decisionId))
  if (history.events.some((event) => !decisionIds.has(event.decisionId))) {
    throw new PersonalizationValidationError("personalization-store-corrupt")
  }
  return { history, profile, schemaVersion: PERSONALIZATION_STORE_SCHEMA }
}

export function scopesOverlap(left: PersonalizationScope, right: PersonalizationScope): boolean {
  return left.kind === "personal" && right.kind === "personal"
    || left.kind !== "personal" && left.kind === right.kind && left.key === right.key
}

export function findConflictingRule(
  rules: readonly PersonalizationRule[],
  candidate: PersonalizationCandidate,
): PersonalizationRule | undefined {
  return rules.find((rule) => rule.topic === candidate.topic && scopesOverlap(rule.scope, candidate.scope))
}

export function ruleFromCandidate(candidate: PersonalizationCandidate, ruleId: string, activatedAt: string, scope = candidate.scope): PersonalizationRule {
  return {
    activatedAt,
    counterexample: candidate.counterexample,
    outcome: candidate.outcome,
    provenance: candidate.provenance,
    rationale: candidate.rationale,
    rule: candidate.rule,
    ruleId,
    schemaVersion: PERSONALIZATION_RULE_SCHEMA,
    scope,
    topic: candidate.topic,
    tradeoffs: candidate.tradeoffs,
  }
}

export function decisionRecord(
  decisionId: string,
  action: PersonalizationDecisionAction,
  decidedAt: string,
  candidateId: string | null,
  ruleId: string | null,
  scope: PersonalizationScope | null,
): PersonalizationDecision {
  return { action, candidateId, decidedAt, decisionId, ruleId, schemaVersion: PERSONALIZATION_DECISION_SCHEMA, scope }
}

export function historyEvent(
  eventId: string,
  event: PersonalizationHistoryEvent["event"],
  occurredAt: string,
  decisionId: string,
  candidateId: string | null,
  ruleId: string | null,
): PersonalizationHistoryEvent {
  return { candidateId, decisionId, event, eventId, occurredAt, ruleId, schemaVersion: PERSONALIZATION_HISTORY_SCHEMA }
}

function parseCandidateFields(value: Record<string, unknown>): PersonalizationCandidate | undefined {
  const scope = parseScope(value.scope)
  const provenance = parseProvenance(value.provenance)
  if (value.schemaVersion !== PERSONALIZATION_CANDIDATE_SCHEMA || scope === undefined || provenance === undefined) return undefined
  const candidateId = value.candidateId
  const topic = value.topic
  const rule = value.rule
  const rationale = value.rationale
  const outcome = value.outcome
  const counterexample = value.counterexample
  const tradeoffs = value.tradeoffs
  if (!isSafeText(candidateId, 80) || !isSafeText(topic, 80) || !isSafeText(rule, 600)
    || !isSafeText(rationale, 600) || !isSafeText(outcome, 600)
    || !isSafeText(counterexample, 600) || !isSafeText(tradeoffs, 600)) return undefined
  if (!isSafeIdentifier(candidateId) || !isSafeTopic(topic)) return undefined
  return {
    candidateId,
    counterexample,
    outcome,
    provenance,
    rationale,
    rule,
    schemaVersion: PERSONALIZATION_CANDIDATE_SCHEMA,
    scope,
    topic,
    tradeoffs,
  }
}

function parseProfile(value: unknown): PersonalizationProfile | undefined {
  if (!isRecord(value) || !hasExactKeys(value, PROFILE_KEYS) || value.schemaVersion !== PERSONALIZATION_PROFILE_SCHEMA) return undefined
  if (!Array.isArray(value.activeRules) || !Array.isArray(value.pendingCandidates) || !Array.isArray(value.decisions)) return undefined
  const activeRules = value.activeRules.map(parseRule)
  const pendingCandidates = value.pendingCandidates.map((candidate) => {
    try { return parsePersonalizationCandidate(candidate) } catch { return undefined }
  })
  const decisions = value.decisions.map(parseDecision)
  if (activeRules.some((rule) => rule === undefined) || pendingCandidates.some((candidate) => candidate === undefined) || decisions.some((decision) => decision === undefined)) return undefined
  const rules = activeRules as PersonalizationRule[]
  const pending = pendingCandidates as PersonalizationCandidate[]
  const parsedDecisions = decisions as PersonalizationDecision[]
  if (new Set(rules.map((rule) => rule.ruleId)).size !== rules.length
    || new Set(pending.map((candidate) => candidate.candidateId)).size !== pending.length
    || new Set(parsedDecisions.map((decision) => decision.decisionId)).size !== parsedDecisions.length) return undefined
  if (rules.some((rule, index) => rules.slice(index + 1).some((other) => rule.topic === other.topic && scopesOverlap(rule.scope, other.scope)))) return undefined
  return { activeRules: rules, decisions: parsedDecisions, pendingCandidates: pending, schemaVersion: PERSONALIZATION_PROFILE_SCHEMA }
}

function parseHistory(value: unknown): PersonalizationHistory | undefined {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== "events|schemaVersion" || value.schemaVersion !== PERSONALIZATION_HISTORY_SCHEMA || !Array.isArray(value.events)) return undefined
  const events = value.events.map((event) => parseHistoryEvent(event))
  if (events.some((event) => event === undefined)) return undefined
  const parsedEvents = events as PersonalizationHistoryEvent[]
  if (new Set(parsedEvents.map((event) => event.eventId)).size !== parsedEvents.length
    || new Set(parsedEvents.map((event) => event.decisionId)).size !== parsedEvents.length) return undefined
  return { events: parsedEvents, schemaVersion: PERSONALIZATION_HISTORY_SCHEMA }
}

function parseRule(value: unknown): PersonalizationRule | undefined {
  if (!isRecord(value) || !hasExactKeys(value, RULE_KEYS)) return undefined
  if (!isSafeIdentifier(value.ruleId) || !isSafeTimestamp(value.activatedAt)) return undefined
  const candidate = parseCandidateFields({ ...value, candidateId: value.ruleId, schemaVersion: PERSONALIZATION_CANDIDATE_SCHEMA })
  return candidate !== undefined
    ? ruleFromCandidate(candidate, value.ruleId, value.activatedAt)
    : undefined
}

function parseDecision(value: unknown): PersonalizationDecision | undefined {
  if (!isRecord(value) || !hasExactKeys(value, DECISION_KEYS) || !isSafeIdentifier(value.decisionId) || !isSafeTimestamp(value.decidedAt)) return undefined
  if (!["activate", "retain", "exception", "supersede", "pending", "rollback"].includes(String(value.action))) return undefined
  if (value.candidateId !== null && !isSafeIdentifier(value.candidateId)) return undefined
  if (value.ruleId !== null && !isSafeIdentifier(value.ruleId)) return undefined
  const scope = value.scope === null ? null : parseScope(value.scope)
  return scope === undefined ? undefined : { action: value.action as PersonalizationDecisionAction, candidateId: value.candidateId, decidedAt: value.decidedAt, decisionId: value.decisionId, ruleId: value.ruleId, schemaVersion: PERSONALIZATION_DECISION_SCHEMA, scope }
}

function parseHistoryEvent(value: unknown): PersonalizationHistoryEvent | undefined {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== "candidateId|decisionId|event|eventId|occurredAt|ruleId|schemaVersion") return undefined
  if (value.schemaVersion !== PERSONALIZATION_HISTORY_SCHEMA || value.event === "" || !isSafeIdentifier(value.eventId) || !isSafeIdentifier(value.decisionId) || !isSafeTimestamp(value.occurredAt)) return undefined
  if (value.candidateId !== null && !isSafeIdentifier(value.candidateId)) return undefined
  if (value.ruleId !== null && !isSafeIdentifier(value.ruleId)) return undefined
  const events = ["activated", "conflict", "pending", "retained", "exception", "superseded", "rollback"] as const
  if (!events.includes(value.event as typeof events[number])) return undefined
  return { candidateId: value.candidateId, decisionId: value.decisionId, event: value.event as typeof events[number], eventId: value.eventId, occurredAt: value.occurredAt, ruleId: value.ruleId, schemaVersion: PERSONALIZATION_HISTORY_SCHEMA }
}

function parseScope(value: unknown): PersonalizationScope | undefined {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== "key|kind" || !isSafeIdentifier(value.key)) return undefined
  if (value.kind === "personal" && value.key === "personal") return { key: value.key, kind: value.kind }
  return value.kind === "project" || value.kind === "task" ? { key: value.key, kind: value.kind } : undefined
}

function parseProvenance(value: unknown): PersonalizationProvenance | undefined {
  if (!isRecord(value) || Object.keys(value).sort().join("|") !== "kind|reference" || !isSafeIdentifier(value.reference)) return undefined
  return value.kind === "user" || value.kind === "review" || value.kind === "workflow" ? { kind: value.kind, reference: value.reference } : undefined
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}

function isSafeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= maxLength
    && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\r\n]/u.test(value)
    && !/```|(?:^|[\s("'])~[\\/]|(?:^|[\s("'])[A-Za-z]:[\\/]|(?:^|[\s("'])\/(?:[^/]|$)/u.test(value)
    && !/(?:^|[\s("'`])(?:sk-[A-Za-z0-9]|gh[pousr]_[A-Za-z0-9]|xox[baprs]-|AKIA[A-Z0-9]{12,})/u.test(value)
    && !/\b(?:password|passwd|api[ _-]?key|access[ _-]?token|token|secret)\s*[:=]/iu.test(value)
    && !/(?:https?|file):\/\//iu.test(value)
    && !/\b(?:function|class|interface|import|export|const|let|var)\s+[A-Za-z_$]/u.test(value)
    && !/[{};]|=>/u.test(value)
}

function isSafeIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(value)
}

function isSafeTopic(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9._-]{1,63}$/u.test(value)
}

function isSafeTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && value.length <= 40
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
