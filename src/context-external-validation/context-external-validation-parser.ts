import {
  CONTEXT_EXTERNAL_VALIDATION_INITIAL_STATUS,
  CONTEXT_EXTERNAL_VALIDATION_PROTOCOL_SCHEMA,
  CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA,
} from "./context-external-validation-types.js"
import type {
  ContextExternalValidationCandidate,
  ContextExternalValidationObservation,
  ContextExternalValidationParticipant,
  ContextExternalValidationProtocol,
  ContextExternalValidationStatus,
} from "./context-external-validation-types.js"

const CANDIDATE_KEYS = ["commit", "packageVersion", "tarSha256"] as const
const PARTICIPANT_KEYS = ["id", "relationship"] as const
const PROTOCOL_KEYS = ["candidate", "cohort", "interventionPolicy", "maximumMinutesPerStart", "schemaVersion", "taskDigest", "tokenReference"] as const
const STATUS_KEYS = ["observations", "productVerdict", "protocol", "schemaVersion", "status"] as const
const OBSERVATION_KEYS = [
  "candidate",
  "conflictResolution",
  "contradictionIncreased",
  "correctionReduced",
  "durationMinutes",
  "intervention",
  "outcome",
  "overreachIncreased",
  "participantId",
  "policySurvived",
  "startState",
  "taskDigest",
  "taskRegressed",
  "tokenOverheadPermille",
] as const

const MINIMUM_COHORT_SIZE = 3
const MAXIMUM_COHORT_SIZE = 5
const MAXIMUM_MINUTES_PER_START = 240
const MAXIMUM_RECORDED_TOKEN_OVERHEAD_PERMILLE = 10_000

type ParsedObservationIdentity = {
  readonly candidate: ContextExternalValidationCandidate
  readonly participantId: string
  readonly taskDigest: string
}

export function parseContextExternalValidationProtocol(value: unknown): ContextExternalValidationProtocol | undefined {
  if (!isRecord(value) || !hasExactKeys(value, PROTOCOL_KEYS) || value.schemaVersion !== CONTEXT_EXTERNAL_VALIDATION_PROTOCOL_SCHEMA) return undefined

  const candidate = parseCandidate(value.candidate)
  const cohort = parseCohort(value.cohort)
  if (candidate === undefined || cohort === undefined || !isSha256(value.taskDigest)) return undefined
  if (value.tokenReference !== "same-task-context-off") return undefined
  if (value.interventionPolicy !== "none" && value.interventionPolicy !== "clarification-only") return undefined
  if (!isBoundedInteger(value.maximumMinutesPerStart, 1, MAXIMUM_MINUTES_PER_START)) return undefined

  return {
    candidate,
    cohort,
    interventionPolicy: value.interventionPolicy,
    maximumMinutesPerStart: value.maximumMinutesPerStart,
    schemaVersion: CONTEXT_EXTERNAL_VALIDATION_PROTOCOL_SCHEMA,
    taskDigest: value.taskDigest,
    tokenReference: "same-task-context-off",
  }
}

export function parseContextExternalValidationStatus(value: unknown): ContextExternalValidationStatus | undefined {
  if (!isRecord(value) || !hasExactKeys(value, STATUS_KEYS) || value.schemaVersion !== CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA) return undefined

  if (value.status === "not-started") {
    if (value.protocol !== null || !isEmptyArray(value.observations) || value.productVerdict !== "INCONCLUSIVE") return undefined
    return CONTEXT_EXTERNAL_VALIDATION_INITIAL_STATUS
  }

  const protocol = parseContextExternalValidationProtocol(value.protocol)
  const observations = parseObservations(value.observations)
  if (protocol === undefined || observations === undefined || !observationsMatchProtocol(observations, protocol)) return undefined

  if (value.status === "preregistered") {
    if (!isEmptyArray(observations) || value.productVerdict !== "INCONCLUSIVE") return undefined
    return { observations, productVerdict: "INCONCLUSIVE", protocol, schemaVersion: CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA, status: "preregistered" }
  }

  if (value.status === "observing") {
    if (observations.length === 0 || observations.length >= protocol.cohort.length || value.productVerdict !== "INCONCLUSIVE") return undefined
    return { observations, productVerdict: "INCONCLUSIVE", protocol, schemaVersion: CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA, status: "observing" }
  }

  if (value.status !== "completed" || !hasCompleteDenominator(observations, protocol.cohort)) return undefined
  if (value.productVerdict !== "PRODUCT_GO" && value.productVerdict !== "PRODUCT_NO_GO") return undefined
  return { observations, productVerdict: value.productVerdict, protocol, schemaVersion: CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA, status: "completed" }
}

function parseCandidate(value: unknown): ContextExternalValidationCandidate | undefined {
  if (!isRecord(value) || !hasExactKeys(value, CANDIDATE_KEYS)) return undefined
  if (!isCommit(value.commit) || !isPackageVersion(value.packageVersion) || !isSha256(value.tarSha256)) return undefined
  return { commit: value.commit, packageVersion: value.packageVersion, tarSha256: value.tarSha256 }
}

function parseCohort(value: unknown): readonly ContextExternalValidationParticipant[] | undefined {
  if (!Array.isArray(value) || value.length < MINIMUM_COHORT_SIZE || value.length > MAXIMUM_COHORT_SIZE) return undefined

  const cohort: ContextExternalValidationParticipant[] = []
  for (const entry of value) {
    const participant = parseParticipant(entry)
    if (participant === undefined) return undefined
    cohort.push(participant)
  }

  return isStrictlySortedUnique(cohort.map((participant) => participant.id)) ? cohort : undefined
}

function parseParticipant(value: unknown): ContextExternalValidationParticipant | undefined {
  if (!isRecord(value) || !hasExactKeys(value, PARTICIPANT_KEYS) || !isParticipantId(value.id)) return undefined
  if (value.relationship !== "independent" && value.relationship !== "past-collaborator" && value.relationship !== "disclosed-other") return undefined
  return { id: value.id, relationship: value.relationship }
}

function parseObservations(value: unknown): readonly ContextExternalValidationObservation[] | undefined {
  if (!Array.isArray(value) || value.length > MAXIMUM_COHORT_SIZE) return undefined

  const observations: ContextExternalValidationObservation[] = []
  for (const entry of value) {
    const observation = parseObservation(entry)
    if (observation === undefined) return undefined
    observations.push(observation)
  }

  return hasUnique(observations.map((observation) => observation.participantId)) ? observations : undefined
}

function parseObservation(value: unknown): ContextExternalValidationObservation | undefined {
  if (!isRecord(value) || !hasExactKeys(value, OBSERVATION_KEYS)) return undefined

  const candidate = parseCandidate(value.candidate)
  const participantId = value.participantId
  const taskDigest = value.taskDigest
  if (candidate === undefined || !isParticipantId(participantId) || !isSha256(taskDigest)) return undefined
  const identity: ParsedObservationIdentity = { candidate, participantId, taskDigest }

  if (value.startState === "accepted-start") return parseAcceptedStart(value, identity)
  if (value.startState === "declined-before-start" || value.startState === "withdrawn-before-start") {
    return parseUnstartedObservation(value, identity, value.startState)
  }
  return undefined
}

function parseAcceptedStart(
  value: Record<string, unknown>,
  identity: ParsedObservationIdentity,
): ContextExternalValidationObservation | undefined {
  const outcome = value.outcome
  const conflictResolution = value.conflictResolution
  const contradictionIncreased = value.contradictionIncreased
  const correctionReduced = value.correctionReduced
  const durationMinutes = value.durationMinutes
  const intervention = value.intervention
  const overreachIncreased = value.overreachIncreased
  const policySurvived = value.policySurvived
  const taskRegressed = value.taskRegressed
  const tokenOverheadPermille = value.tokenOverheadPermille
  if ((outcome !== "completed" && outcome !== "not-completed") || (conflictResolution !== "accurate" && conflictResolution !== "inaccurate")) return undefined
  if (!isBoolean(contradictionIncreased) || !isBoolean(correctionReduced) || !isBoundedInteger(durationMinutes, 1, MAXIMUM_MINUTES_PER_START)) return undefined
  if (!isBoolean(overreachIncreased) || !isBoolean(policySurvived) || !isBoolean(taskRegressed)) return undefined
  if (!isBoundedInteger(tokenOverheadPermille, 0, MAXIMUM_RECORDED_TOKEN_OVERHEAD_PERMILLE)) return undefined
  if (intervention !== "none" && intervention !== "declared-clarification") return undefined

  return {
    candidate: identity.candidate,
    conflictResolution,
    contradictionIncreased,
    correctionReduced,
    durationMinutes,
    intervention,
    overreachIncreased,
    outcome,
    participantId: identity.participantId,
    policySurvived,
    startState: "accepted-start",
    taskDigest: identity.taskDigest,
    taskRegressed,
    tokenOverheadPermille,
  }
}

function parseUnstartedObservation(
  value: Record<string, unknown>,
  identity: ParsedObservationIdentity,
  startState: "declined-before-start" | "withdrawn-before-start",
): ContextExternalValidationObservation | undefined {
  if (value.outcome !== "not-observed" || value.conflictResolution !== "not-observed" || value.intervention !== "none") return undefined
  if (value.contradictionIncreased !== null || value.correctionReduced !== null || value.durationMinutes !== null || value.overreachIncreased !== null) return undefined
  if (value.policySurvived !== null || value.taskRegressed !== null || value.tokenOverheadPermille !== null) return undefined

  return {
    candidate: identity.candidate,
    conflictResolution: "not-observed",
    contradictionIncreased: null,
    correctionReduced: null,
    durationMinutes: null,
    intervention: "none",
    overreachIncreased: null,
    outcome: "not-observed",
    participantId: identity.participantId,
    policySurvived: null,
    startState,
    taskDigest: identity.taskDigest,
    taskRegressed: null,
    tokenOverheadPermille: null,
  }
}

function observationsMatchProtocol(observations: readonly ContextExternalValidationObservation[], protocol: ContextExternalValidationProtocol): boolean {
  return observations.every((observation) => {
    if (!sameCandidate(observation.candidate, protocol.candidate) || observation.taskDigest !== protocol.taskDigest) return false
    if (!protocol.cohort.some((participant) => participant.id === observation.participantId)) return false
    if (observation.startState !== "accepted-start") return true
    if (observation.durationMinutes === null || observation.durationMinutes > protocol.maximumMinutesPerStart) return false
    return protocol.interventionPolicy === "clarification-only" || observation.intervention === "none"
  })
}

function hasCompleteDenominator(
  observations: readonly ContextExternalValidationObservation[],
  cohort: readonly ContextExternalValidationParticipant[],
): boolean {
  return observations.length === cohort.length && observations.every((observation, index) => observation.participantId === cohort[index]?.id)
}

function sameCandidate(left: ContextExternalValidationCandidate, right: ContextExternalValidationCandidate): boolean {
  return left.commit === right.commit && left.packageVersion === right.packageVersion && left.tarSha256 === right.tarSha256
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isEmptyArray(value: unknown): value is readonly [] {
  return Array.isArray(value) && value.length === 0
}

function isStrictlySortedUnique(values: readonly string[]): boolean {
  let previous: string | undefined
  for (const value of values) {
    if (previous !== undefined && previous >= value) return false
    previous = value
  }
  return true
}

function hasUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length
}

function isCommit(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value)
}

function isPackageVersion(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(value)
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value)
}

function isParticipantId(value: unknown): value is string {
  return typeof value === "string" && /^P-(?:0[1-9]|[1-9][0-9])$/u.test(value)
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= minimum && value <= maximum
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean"
}
