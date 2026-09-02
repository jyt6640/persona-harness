export const SOCRATIC_INTERVIEW_STATE_VERSION = "persona-socratic-interview-state.1"
export const SOCRATIC_INTERVIEW_RECORD_VERSION = "persona-socratic-interview-record.1"

export const SOCRATIC_INTERVIEW_TOPICS = [
  {
    id: "target-user",
    question: "Who is the first specific person this product should help?",
    explanation: "Name one concrete kind of person first. For example, say 'a student looking for a quiet desk' instead of 'everyone'.",
    recommendation: "Name one primary user group before describing features.",
    tradeoff: "A narrow first user makes the MVP easier to test; a broad audience can hide conflicting needs.",
  },
  {
    id: "problem",
    question: "What recurring problem does that person have today?",
    explanation: "Describe the frustrating moment they already face, not the feature you want to build.",
    recommendation: "Describe the costly or frustrating moment, not the proposed feature.",
    tradeoff: "Problem-first framing prevents a polished solution from solving the wrong thing.",
  },
  {
    id: "outcome",
    question: "What visible result should improve for that person?",
    explanation: "Choose something the person can notice themselves after using the product.",
    recommendation: "Choose a result the user can recognize without internal metrics.",
    tradeoff: "A concrete outcome keeps the plan honest; an ambitious outcome may require more discovery.",
  },
  {
    id: "journey",
    question: "What is the shortest path from that problem to the result?",
    explanation: "List the smallest end-to-end journey, such as 'find, choose, confirm', before adding extra screens.",
    recommendation: "State the first end-to-end path before listing screens or integrations.",
    tradeoff: "A short journey clarifies the MVP; edge cases can remain explicitly deferred.",
  },
  {
    id: "mvp",
    question: "What is the smallest set of capabilities needed for that path to work?",
    explanation: "Keep only the user-visible capabilities required to finish the first journey.",
    recommendation: "Limit the MVP to the minimum user-visible capabilities.",
    tradeoff: "Fewer capabilities accelerate learning; omitted conveniences may need manual support at first.",
  },
  {
    id: "non-goals",
    question: "Which tempting capabilities are explicitly out of scope for this first version?",
    explanation: "Name features that sound useful but are deliberately not part of the first release.",
    recommendation: "Name at least one attractive exclusion.",
    tradeoff: "Clear non-goals protect focus; they may disappoint some early requests by design.",
  },
  {
    id: "success-signal",
    question: "What first signal would show that the MVP is useful?",
    explanation: "Pick one behavior or outcome that tells you a real person got value.",
    recommendation: "Use one observable behavior or outcome rather than a vanity metric.",
    tradeoff: "A simple signal supports early decisions; it may not predict long-term retention.",
  },
  {
    id: "constraints",
    question: "Which real product constraints or risks must shape the first release?",
    explanation: "Mention timing, privacy, operations, or integration limits only when they change the product decision.",
    recommendation: "Include timing, privacy, compliance, operations, or integration limits only when they change the product decision.",
    tradeoff: "Naming real constraints early avoids surprise rework; speculative technical choices can wait for technical intake.",
  },
] as const

export type SocraticInterviewTopicDefinition = (typeof SOCRATIC_INTERVIEW_TOPICS)[number]
export type SocraticInterviewTopic = SocraticInterviewTopicDefinition["id"]
export type SocraticInterviewMode = "new-product" | "brownfield-change-discovery"

export type SocraticInterviewDecision = {
  readonly decision: string
  readonly topic: SocraticInterviewTopic
}

export type SocraticInterviewState = {
  readonly contractVersion: typeof SOCRATIC_INTERVIEW_STATE_VERSION
  readonly decisions: readonly SocraticInterviewDecision[]
  readonly mode: SocraticInterviewMode
  readonly projectBinding: string
  readonly recordRevision: number
  readonly topicIndex: number
}

export type SocraticInterviewDecisionRecord = {
  readonly approval: "explicit"
  readonly decisions: readonly SocraticInterviewDecision[]
  readonly recordVersion: typeof SOCRATIC_INTERVIEW_RECORD_VERSION
  readonly revision: number
}

export type SocraticInterviewStateParseResult =
  | { readonly kind: "valid"; readonly value: SocraticInterviewState }
  | { readonly kind: "version-mismatch" }
  | { readonly kind: "malformed" }

export type SocraticInterviewRecordParseResult =
  | { readonly kind: "valid"; readonly value: SocraticInterviewDecisionRecord }
  | { readonly kind: "version-mismatch" }
  | { readonly kind: "malformed" }

export type SocraticInterviewStep =
  | { readonly kind: "blocked"; readonly code: "socratic-interview-state-malformed" | "socratic-interview-input-invalid" }
  | {
      readonly kind: "question"
      readonly approvalBlocked: boolean
      readonly progress: number
      readonly question: SocraticInterviewTopicDefinition
      readonly state: SocraticInterviewState
      readonly visibleActivation: boolean
    }
  | {
      readonly kind: "recommendation"
      readonly progress: number
      readonly question: SocraticInterviewTopicDefinition
      readonly state: SocraticInterviewState
    }
  | {
      readonly kind: "explanation-required"
      readonly explanation: string
      readonly progress: number
      readonly question: SocraticInterviewTopicDefinition
      readonly state: SocraticInterviewState
      readonly topic: SocraticInterviewTopic
    }
  | {
      readonly kind: "approval-required"
      readonly decisions: readonly SocraticInterviewDecision[]
      readonly progress: 90
      readonly state: SocraticInterviewState
    }
  | {
      readonly kind: "approved"
      readonly decisions: readonly SocraticInterviewDecision[]
      readonly progress: 100
    }
  | { readonly kind: "stopped"; readonly progress: number }

export function socraticInterviewTopicAt(index: number): SocraticInterviewTopicDefinition | undefined {
  return SOCRATIC_INTERVIEW_TOPICS[index]
}

export function socraticInterviewProgress(topicIndex: number): number {
  return topicIndex >= SOCRATIC_INTERVIEW_TOPICS.length ? 90 : (topicIndex + 1) * 10
}
