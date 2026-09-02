import {
  SOCRATIC_INTERVIEW_RECORD_VERSION,
  SOCRATIC_INTERVIEW_STATE_VERSION,
  SOCRATIC_INTERVIEW_TOPICS,
  socraticInterviewProgress,
  socraticInterviewTopicAt,
  type SocraticInterviewDecision,
  type SocraticInterviewDecisionRecord,
  type SocraticInterviewMode,
  type SocraticInterviewStep,
  type SocraticInterviewState,
  type SocraticInterviewTopic,
} from "./socratic-interview-contract.js"
import {
  isSocraticInterviewApproval,
  isSocraticInterviewClarification,
  isSocraticInterviewRecommendation,
  isSocraticInterviewStop,
} from "./socratic-interview-control.js"
import {
  isNonNegativeInteger,
  parseSocraticInterviewDecisionRecord,
  parseSocraticInterviewDecisions,
  parseSocraticInterviewState,
} from "./socratic-interview-schema.js"

const DEFER_PATTERN = /^(?:defer|skip|later|보류|넘겨)$/iu
const MAX_DECISION_CHARS = 600

export {
  SOCRATIC_INTERVIEW_RECORD_VERSION,
  SOCRATIC_INTERVIEW_STATE_VERSION,
  SOCRATIC_INTERVIEW_TOPICS,
  socraticInterviewTopicAt,
}
export {
  isSocraticInterviewApproval,
  isSocraticInterviewClarification,
  isSocraticInterviewRecommendation,
  isSocraticInterviewStop,
}
export {
  parseSocraticInterviewDecisionRecord,
  parseSocraticInterviewState,
}
export type {
  SocraticInterviewDecision,
  SocraticInterviewDecisionRecord,
  SocraticInterviewMode,
  SocraticInterviewStep,
  SocraticInterviewState,
  SocraticInterviewTopic,
}

export function createSocraticInterview(input: {
  readonly mode: SocraticInterviewMode
  readonly projectBinding: string
  readonly recordRevision: number
}): Extract<SocraticInterviewStep, { readonly kind: "question" }> {
  const state: SocraticInterviewState = {
    contractVersion: SOCRATIC_INTERVIEW_STATE_VERSION,
    decisions: [],
    mode: input.mode,
    projectBinding: input.projectBinding,
    recordRevision: input.recordRevision,
    topicIndex: 0,
  }
  return questionFor(state, true, false)
}

export function advanceSocraticInterview(stateInput: unknown, messageInput: string): SocraticInterviewStep {
  const parsed = parseSocraticInterviewState(stateInput)
  if (parsed.kind !== "valid") return { kind: "blocked", code: "socratic-interview-state-malformed" }
  const state = parsed.value
  const message = messageInput.trim()
  if (message.length === 0) return { kind: "blocked", code: "socratic-interview-input-invalid" }

  if (isSocraticInterviewStop(message)) return { kind: "stopped", progress: socraticInterviewProgress(state.topicIndex) }
  if (isSocraticInterviewRecommendation(message)) return recommendationFor(state)
  if (isSocraticInterviewClarification(message)) return explanationFor(state)
  if (isSocraticInterviewApproval(message)) {
    return state.topicIndex < SOCRATIC_INTERVIEW_TOPICS.length
      ? questionFor(state, false, true)
      : { kind: "approved", decisions: state.decisions, progress: 100 }
  }

  const topic = socraticInterviewTopicAt(state.topicIndex)
  if (topic === undefined) return approvalRequired(state)
  const decision = DEFER_PATTERN.test(message) ? "deferred" : message.slice(0, MAX_DECISION_CHARS)
  const next: SocraticInterviewState = {
    ...state,
    decisions: [...state.decisions, { decision, topic: topic.id }],
    topicIndex: state.topicIndex + 1,
  }
  return next.topicIndex >= SOCRATIC_INTERVIEW_TOPICS.length ? approvalRequired(next) : questionFor(next, false, false)
}

export function createSocraticInterviewDecisionRecord(
  decisions: readonly SocraticInterviewDecision[],
  revision: number,
): SocraticInterviewDecisionRecord | undefined {
  if (!isNonNegativeInteger(revision) || decisions.length !== SOCRATIC_INTERVIEW_TOPICS.length) return undefined
  const parsed = parseSocraticInterviewDecisions(decisions)
  if (parsed === undefined) return undefined
  return {
    approval: "explicit",
    decisions: parsed,
    recordVersion: SOCRATIC_INTERVIEW_RECORD_VERSION,
    revision,
  }
}

export function replaySocraticInterviewDecisionRecord(
  record: SocraticInterviewDecisionRecord,
): Extract<SocraticInterviewStep, { readonly kind: "approved" }> {
  return { kind: "approved", decisions: record.decisions, progress: 100 }
}

function recommendationFor(state: SocraticInterviewState): SocraticInterviewStep {
  const question = socraticInterviewTopicAt(state.topicIndex)
  return question === undefined
    ? approvalRequired(state)
    : { kind: "recommendation", progress: socraticInterviewProgress(state.topicIndex), question, state }
}

function explanationFor(state: SocraticInterviewState): SocraticInterviewStep {
  const question = socraticInterviewTopicAt(state.topicIndex)
  return question === undefined
    ? approvalRequired(state)
    : {
        kind: "explanation-required",
        explanation: question.explanation,
        progress: socraticInterviewProgress(state.topicIndex),
        question,
        state,
        topic: question.id,
      }
}

function questionFor(
  state: SocraticInterviewState,
  visibleActivation: boolean,
  approvalBlocked: boolean,
): Extract<SocraticInterviewStep, { readonly kind: "question" }> {
  const question = socraticInterviewTopicAt(state.topicIndex)
  if (question === undefined) throw new Error("Socratic interview question is unavailable for terminal state")
  return {
    approvalBlocked,
    kind: "question",
    progress: socraticInterviewProgress(state.topicIndex),
    question,
    state,
    visibleActivation,
  }
}

function approvalRequired(state: SocraticInterviewState): Extract<SocraticInterviewStep, { readonly kind: "approval-required" }> {
  return { kind: "approval-required", decisions: state.decisions, progress: 90, state }
}
