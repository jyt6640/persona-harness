import {
  SOCRATIC_INTERVIEW_RECORD_VERSION,
  SOCRATIC_INTERVIEW_STATE_VERSION,
  SOCRATIC_INTERVIEW_TOPICS,
  type SocraticInterviewDecision,
  type SocraticInterviewDecisionRecord,
  type SocraticInterviewMode,
  type SocraticInterviewRecordParseResult,
  type SocraticInterviewState,
  type SocraticInterviewStateParseResult,
} from "./socratic-interview-contract.js"

const PROJECT_BINDING_PATTERN = /^sha256:[a-f0-9]{64}$/u
export const MAX_SOCRATIC_INTERVIEW_DECISION_CHARS = 600

export function parseSocraticInterviewState(value: unknown): SocraticInterviewStateParseResult {
  if (!isRecord(value)) return { kind: "malformed" }
  if (value.contractVersion !== SOCRATIC_INTERVIEW_STATE_VERSION) {
    return typeof value.contractVersion === "string" ? { kind: "version-mismatch" } : { kind: "malformed" }
  }
  if (!hasExactKeys(value, ["contractVersion", "decisions", "mode", "projectBinding", "recordRevision", "topicIndex"])) {
    return { kind: "malformed" }
  }
  if (
    !isMode(value.mode)
    || !isProjectBinding(value.projectBinding)
    || !isNonNegativeInteger(value.recordRevision)
    || !isNonNegativeInteger(value.topicIndex)
    || !Array.isArray(value.decisions)
  ) {
    return { kind: "malformed" }
  }
  const decisions = parseSocraticInterviewDecisions(value.decisions)
  if (decisions === undefined || value.topicIndex !== decisions.length || value.topicIndex > SOCRATIC_INTERVIEW_TOPICS.length) {
    return { kind: "malformed" }
  }
  return {
    kind: "valid",
    value: {
      contractVersion: SOCRATIC_INTERVIEW_STATE_VERSION,
      decisions,
      mode: value.mode,
      projectBinding: value.projectBinding,
      recordRevision: value.recordRevision,
      topicIndex: value.topicIndex,
    },
  }
}

export function parseSocraticInterviewDecisionRecord(value: unknown): SocraticInterviewRecordParseResult {
  if (!isRecord(value)) return { kind: "malformed" }
  if (value.recordVersion !== SOCRATIC_INTERVIEW_RECORD_VERSION) {
    return typeof value.recordVersion === "string" ? { kind: "version-mismatch" } : { kind: "malformed" }
  }
  if (!hasExactKeys(value, ["approval", "decisions", "recordVersion", "revision"])) return { kind: "malformed" }
  if (value.approval !== "explicit" || !isNonNegativeInteger(value.revision) || !Array.isArray(value.decisions)) {
    return { kind: "malformed" }
  }
  const decisions = parseSocraticInterviewDecisions(value.decisions)
  if (decisions === undefined || decisions.length !== SOCRATIC_INTERVIEW_TOPICS.length) return { kind: "malformed" }
  return {
    kind: "valid",
    value: {
      approval: "explicit",
      decisions,
      recordVersion: SOCRATIC_INTERVIEW_RECORD_VERSION,
      revision: value.revision,
    },
  }
}

export function parseSocraticInterviewDecisions(value: readonly unknown[]): readonly SocraticInterviewDecision[] | undefined {
  if (value.length > SOCRATIC_INTERVIEW_TOPICS.length) return undefined
  const decisions: SocraticInterviewDecision[] = []
  for (const [index, candidate] of value.entries()) {
    if (!isRecord(candidate) || !hasExactKeys(candidate, ["decision", "topic"])) return undefined
    const topic = SOCRATIC_INTERVIEW_TOPICS[index]
    if (
      topic === undefined
      || candidate.topic !== topic.id
      || !isSocraticInterviewDecisionText(candidate.decision)
    ) {
      return undefined
    }
    decisions.push({ decision: candidate.decision, topic: topic.id })
  }
  return decisions
}

export function isBoundedSocraticInterviewText(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= MAX_SOCRATIC_INTERVIEW_DECISION_CHARS
    && !value.includes("\u0000")
}

export function isSocraticInterviewDecisionText(value: unknown): value is string {
  return isBoundedSocraticInterviewText(value) && value.trim().length > 0
}

export function hasExactKeys(value: Readonly<Record<string, unknown>>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort()
  const expectedKeys = [...expected].sort()
  return keys.length === expectedKeys.length && keys.every((key, index) => key === expectedKeys[index])
}

export function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
}

function isMode(value: unknown): value is SocraticInterviewMode {
  return value === "new-product" || value === "brownfield-change-discovery"
}

function isProjectBinding(value: unknown): value is string {
  return typeof value === "string" && PROJECT_BINDING_PATTERN.test(value)
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
