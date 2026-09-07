import { randomUUID } from "node:crypto"
import {
  findConflictingRule,
  historyEvent,
  parsePersonalizationCandidate,
  ruleFromCandidate,
  scopesOverlap,
  type PersonalizationCandidate,
  type PersonalizationDecisionAction,
  type PersonalizationHistoryEvent,
  type PersonalizationScope,
  type PersonalizationStoreDocument,
} from "./personalization-profile-model.js"
import {
  PersonalizationStoreError,
  readPersonalizationStore,
  writePersonalizationStore,
  type PersonalizationStoreOptions,
} from "./personalization-store-io.js"

export * from "./personalization-profile-model.js"
export * from "./personalization-store-io.js"
export { STARTER_PROFILE } from "../context-core/rule-types.js"

export type PersonalizationMutationResult = {
  readonly document: PersonalizationStoreDocument
  readonly event: PersonalizationHistoryEvent
  readonly status: "activated" | "conflict" | "pending" | "retained" | "exception" | "superseded" | "rollback"
}

export function proposePersonalizationCandidate(
  value: unknown,
  options: PersonalizationStoreOptions = {},
  explicitPending = false,
): PersonalizationMutationResult {
  let candidate: PersonalizationCandidate
  try {
    candidate = parsePersonalizationCandidate(value)
  } catch {
    throw new PersonalizationStoreError("personalization-candidate-invalid")
  }
  const current = readPersonalizationStore(options)
  if (current.profile.activeRules.some((rule) => rule.ruleId === `rule-${candidate.candidateId}`) || current.profile.pendingCandidates.some((item) => item.candidateId === candidate.candidateId)) {
    throw new PersonalizationStoreError("personalization-candidate-invalid")
  }
  const now = timestamp(options)
  const decisionId = createId(options, "decision")
  const eventId = createId(options, "event")
  const conflict = findConflictingRule(current.profile.activeRules, candidate)
  if (explicitPending) {
    const event = historyEvent(eventId, "pending", now, decisionId, candidate.candidateId, null)
    const document = withMutation(current, {
      action: "pending",
      candidate,
      decisionId,
      event,
      ruleId: null,
    })
    writePersonalizationStore(document, options)
    return { document, event, status: "pending" }
  }
  if (conflict !== undefined) {
    const event = historyEvent(eventId, "conflict", now, decisionId, candidate.candidateId, null)
    const document = withMutation(current, {
      action: "pending",
      candidate,
      decisionId,
      event,
      ruleId: null,
    })
    writePersonalizationStore(document, options)
    return { document, event, status: "conflict" }
  }
  const ruleId = `rule-${candidate.candidateId}`
  const rule = ruleFromCandidate(candidate, ruleId, now)
  const event = historyEvent(eventId, "activated", now, decisionId, candidate.candidateId, ruleId)
  const document = withMutation(current, { action: "activate", candidate, decisionId, event, removeCandidate: true, rule, ruleId })
  writePersonalizationStore(document, options)
  return { document, event, status: "activated" }
}

export function resolvePersonalizationCandidate(
  candidateId: string,
  action: Exclude<PersonalizationDecisionAction, "activate" | "rollback">,
  options: PersonalizationStoreOptions = {},
  exceptionScope?: PersonalizationScope,
): PersonalizationMutationResult {
  const current = readPersonalizationStore(options)
  const candidate = current.profile.pendingCandidates.find((item) => item.candidateId === candidateId)
  if (candidate === undefined) throw new PersonalizationStoreError("personalization-candidate-missing")
  const now = timestamp(options)
  const decisionId = createId(options, "decision")
  const eventId = createId(options, "event")
  if (action === "exception" && (exceptionScope === undefined || exceptionScope.kind === "personal")) throw new PersonalizationStoreError("personalization-resolution-invalid")
  const selectedScope = action === "exception" ? exceptionScope : candidate.scope
  const conflict = current.profile.activeRules.find((rule) => rule.topic === candidate.topic && selectedScope !== undefined && scopesOverlap(rule.scope, selectedScope))
  if (action === "exception" && conflict !== undefined) throw new PersonalizationStoreError("personalization-candidate-conflict")
  if (action === "supersede" && conflict === undefined) throw new PersonalizationStoreError("personalization-resolution-invalid")
  const ruleId = action === "exception" || action === "supersede" ? `rule-${candidate.candidateId}` : null
  const rule = ruleId === null ? undefined : ruleFromCandidate(candidate, ruleId, now, selectedScope)
  const eventName: PersonalizationHistoryEvent["event"] = action === "pending"
    ? "pending"
    : action === "retain"
      ? "retained"
      : action === "supersede"
        ? "superseded"
        : "exception"
  const event = historyEvent(eventId, eventName, now, decisionId, candidateId, ruleId)
  const document = withMutation(current, {
    action,
    candidate,
    decisionId,
    event,
    replaceRule: action === "supersede" ? conflict : undefined,
    rule,
    ruleId,
    removeCandidate: action !== "pending",
  })
  writePersonalizationStore(document, options)
  return { document, event, status: eventName }
}

export function rollbackPersonalizationRule(ruleId: string, options: PersonalizationStoreOptions = {}): PersonalizationMutationResult {
  const current = readPersonalizationStore(options)
  const rule = current.profile.activeRules.find((item) => item.ruleId === ruleId)
  if (rule === undefined) throw new PersonalizationStoreError("personalization-rule-missing")
  const now = timestamp(options)
  const decisionId = createId(options, "decision")
  const event = historyEvent(createId(options, "event"), "rollback", now, decisionId, null, ruleId)
  const document = withMutation(current, { action: "rollback", decisionId, event, removeRule: ruleId, ruleId })
  writePersonalizationStore(document, options)
  return { document, event, status: "rollback" }
}

function withMutation(
  current: PersonalizationStoreDocument,
  mutation: {
    readonly action: PersonalizationDecisionAction
    readonly candidate?: PersonalizationCandidate
    readonly decisionId: string
    readonly event: PersonalizationHistoryEvent
    readonly removeCandidate?: boolean
    readonly removeRule?: string
    readonly replaceRule?: { readonly ruleId: string }
    readonly rule?: ReturnType<typeof ruleFromCandidate>
    readonly ruleId: string | null
  },
): PersonalizationStoreDocument {
  const activeRules = current.profile.activeRules
    .filter((rule) => rule.ruleId !== mutation.removeRule && rule.ruleId !== mutation.replaceRule?.ruleId)
  const nextRules = mutation.rule === undefined ? activeRules : [...activeRules, mutation.rule]
  const removeCandidate = mutation.removeCandidate === true || mutation.action === "activate"
  const pendingCandidates = mutation.candidate === undefined || removeCandidate
    ? current.profile.pendingCandidates.filter((candidate) => candidate.candidateId !== mutation.candidate?.candidateId)
    : [...current.profile.pendingCandidates, mutation.candidate]
  const scope = mutation.rule?.scope ?? null
  const decision = {
    action: mutation.action,
    candidateId: mutation.candidate?.candidateId ?? null,
    decidedAt: mutation.event.occurredAt,
    decisionId: mutation.decisionId,
    ruleId: mutation.ruleId,
    schemaVersion: "personalization-decision.v1" as const,
    scope,
  }
  return {
    history: { events: [...current.history.events, mutation.event], schemaVersion: current.history.schemaVersion },
    profile: {
      activeRules: nextRules,
      decisions: [...current.profile.decisions, decision],
      pendingCandidates,
      schemaVersion: current.profile.schemaVersion,
    },
    schemaVersion: current.schemaVersion,
  }
}

function timestamp(options: PersonalizationStoreOptions): string {
  return (options.now ?? (() => new Date()))().toISOString()
}

function createId(options: PersonalizationStoreOptions, prefix: string): string {
  return `${prefix}-${(options.idFactory ?? randomUUID)()}`
}
