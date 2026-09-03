import {
  advanceSocraticInterview,
  createSocraticInterview,
  isBoundedSocraticInterviewText,
  socraticInterviewProgress,
  socraticInterviewTopicAt,
  SOCRATIC_INTERVIEW_TOPICS,
  type SocraticInterviewDecision,
  type SocraticInterviewMode,
  type SocraticInterviewState,
  type SocraticInterviewTopic,
} from "../interview/socratic-interview-core.js"
import { createOpenCodeSkillRoute } from "./opencode-skill-adapter.js"
import {
  isExplicitProductInterviewRequest,
  isProductInterviewStop,
} from "./product-interview-control.js"

const START_PATTERN = /(만들래|만들고\s*싶|기획해|구상해|서비스\s*만들|웹\s*서비스|기존\s*(?:서비스|제품|앱|흐름).*(?:개선|변경)|product\s+idea|want\s+to\s+(?:build|create|make|explore)|(?:build|create|make)\s+(?:an?|the)\s+(?:app|service|product)|new\s+(?:app|service|product)|(?:app|service|product)\s+idea|(?:improve|change)\s+(?:an?\s+)?existing(?:\s+\w+){0,2}\s+(?:app|service|product|flow))/iu
const STOPPED_BLOCK = "[Persona Harness Product Interview]\nProduct discovery is paused.\nNo project, workflow, issue, agent, or file state was changed."
const TRACKER_PROJECT_BINDING = "sha256:1c144066487b9a5f0aa8e52a5f0b84d4d8bc06811b2e6954dc5bef9faadfe40e"
const MAX_TRACKED_SESSIONS = 128
const MAX_SESSION_ID_CHARS = 256

export type ProductDeepInterviewMode = SocraticInterviewMode

export type ProductDeepInterviewOptions = {
  readonly mode?: ProductDeepInterviewMode
}

export type ProductDeepInterviewResult =
  | { readonly block: string; readonly kind: "question"; readonly progress: number; readonly topic: SocraticInterviewTopic; readonly visibleActivation: boolean }
  | { readonly block: string; readonly kind: "recommendation"; readonly progress: number; readonly topic: SocraticInterviewTopic }
  | { readonly block: string; readonly kind: "clarification-required"; readonly progress: number; readonly topic: SocraticInterviewTopic }
  | { readonly block: string; readonly kind: "approval-required"; readonly progress: 90 }
  | { readonly block: string; readonly handoff: "technical-intake"; readonly kind: "approved"; readonly progress: 100 }
  | { readonly block: string; readonly kind: "stopped"; readonly progress: number }

export function isProductDeepInterviewStart(message: string): boolean {
  return START_PATTERN.test(message.trim())
}

function renderQuestion(
  session: SocraticInterviewState,
  options: Readonly<{ readonly approvalBlocked: boolean; readonly visibleActivation: boolean }>,
): ProductDeepInterviewResult {
  const topic = socraticInterviewTopicAt(session.topicIndex)
  if (topic === undefined) return renderApprovalRequired(session)
  const progress = socraticInterviewProgress(session.topicIndex)
  return {
    kind: "question",
    progress,
    topic: topic.id,
    visibleActivation: options.visibleActivation,
    block: [
      "[Persona Harness Product Interview]",
      ...(options.visibleActivation
        ? [
            createOpenCodeSkillRoute({
              decision: "activate",
              firstAction: session.mode === "brownfield-change-discovery" ? "code-first-change-discovery" : "one-question-product-interview",
              skillId: "deep-interview",
              reason: "Product facts are still unresolved, so technical intake and planning remain deferred.",
            }),
            "",
            "(PH) Product Deep Interview active.",
          ]
        : []),
      "Current understanding: product discovery is in progress in this conversation.",
      ...(session.mode === "brownfield-change-discovery"
        ? [
            "First-action contract: inspect relevant existing code before asking for facts it already answers.",
            "Do not implement or create project state in this turn.",
          ]
        : [
            "Required first response: ask exactly one product question now, then wait for the user's answer.",
            "Do not propose a solution, implementation, technical plan, command, or file change in this turn.",
          ]),
      ...(session.mode === "brownfield-change-discovery"
        ? [
            "Mode: brownfield-change-discovery.",
            "Read relevant existing code before asking for facts it already answers.",
          ]
        : []),
      ...(options.approvalBlocked ? ["Approval is not available until this product decision is answered or deferred."] : []),
      `Progress: ${progress}%`,
      `Question: ${topic.question}`,
      `Recommendation: ${topic.recommendation}`,
      `Tradeoff: ${topic.tradeoff}`,
      "Reply freely, or use `recommend`, `defer`, or `stop`.",
      "No plan, ticket, workflow, branch, file, issue, or agent action has been created.",
    ].join("\n"),
  }
}

function renderRecommendation(session: SocraticInterviewState): ProductDeepInterviewResult {
  const topic = socraticInterviewTopicAt(session.topicIndex)
  if (topic === undefined) return renderApprovalRequired(session)
  return {
    kind: "recommendation",
    progress: socraticInterviewProgress(session.topicIndex),
    topic: topic.id,
    block: [
      "[Persona Harness Product Interview]",
      `Recommendation: ${topic.recommendation}`,
      `Tradeoff: ${topic.tradeoff}`,
      `Question: ${topic.question}`,
      "Reply freely, or use `defer` or `stop`.",
      "No project, workflow, issue, agent, or file state was changed.",
    ].join("\n"),
  }
}

function renderClarificationRequired(session: SocraticInterviewState): ProductDeepInterviewResult {
  const topic = socraticInterviewTopicAt(session.topicIndex)
  if (topic === undefined) return renderApprovalRequired(session)
  return {
    kind: "clarification-required",
    progress: socraticInterviewProgress(session.topicIndex),
    topic: topic.id,
    block: [
      "[Persona Harness Product Interview]",
      `Current topic: ${topic.id}`,
      "The user's latest message is a clarification request, not a product decision.",
      "Explain only the current question in plain language, then wait for the user's reply.",
      "Do not record an answer, advance to another topic, or ask a neighbouring question.",
      `Question to explain: ${topic.question}`,
      "No project, workflow, issue, agent, or file state was changed.",
    ].join("\n"),
  }
}

function approvalBriefLines(decisions: readonly SocraticInterviewDecision[]): readonly string[] {
  return [
    "Approval brief:",
    ...SOCRATIC_INTERVIEW_TOPICS.map((topic) => {
      const decision = decisions.find((candidate) => candidate.topic === topic.id)?.decision ?? "deferred"
      return `- ${topic.id}: ${decision === "deferred" ? "deferred" : "recorded"}`
    }),
    "Approval is explicit: reply `approve` to hand off to technical-intake, or `stop` to leave this interview without a handoff.",
  ]
}

function renderApprovalRequired(session: SocraticInterviewState): ProductDeepInterviewResult {
  return {
    kind: "approval-required",
    progress: 90,
    block: [
      "[Persona Harness Product Interview]",
      ...approvalBriefLines(session.decisions),
      "No plan, ticket, workflow, branch, file, issue, or agent action has been created.",
    ].join("\n"),
  }
}

function renderApproved(decisions: readonly SocraticInterviewDecision[]): ProductDeepInterviewResult {
  return {
    kind: "approved",
    handoff: "technical-intake",
    block: [
      "[Persona Harness Product Interview]",
      ...approvalBriefLines(decisions),
      "Approval received in this conversation only.",
      "Next explicit handoff: technical-intake.",
      "Sequence after an explicit technical brief: plan -> optional ralplan -> TDD -> implementation -> review.",
      "Optional adversarial review after planning: ralplan.",
      "The host adapter does not create or advance workflow state.",
    ].join("\n"),
    progress: 100,
  }
}

function renderStopped(progress: number): ProductDeepInterviewResult {
  return { kind: "stopped", block: STOPPED_BLOCK, progress }
}

export class ProductDeepInterviewTracker {
  private readonly sessions = new Map<string, SocraticInterviewState>()
  private readonly suppressedSessions = new Set<string>()

  constructor(private readonly options: ProductDeepInterviewOptions = {}) {}

  hasActiveSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  route(sessionId: string, message: string): ProductDeepInterviewResult | undefined {
    if (sessionId.length === 0 || sessionId.length > MAX_SESSION_ID_CHARS || !isBoundedSocraticInterviewText(message)) return undefined
    const normalized = message.trim()
    if (normalized.length === 0) return undefined

    const current = this.sessions.get(sessionId)
    if (current === undefined) {
      if (this.suppressedSessions.has(sessionId)) {
        if (!isExplicitProductInterviewRequest(normalized)) return undefined
        this.suppressedSessions.delete(sessionId)
      }
      if (!isProductDeepInterviewStart(normalized) && !isExplicitProductInterviewRequest(normalized)) return undefined
      if (this.sessions.size + this.suppressedSessions.size >= MAX_TRACKED_SESSIONS) return undefined
      const started = createSocraticInterview({
        mode: this.options.mode ?? "new-product",
        projectBinding: TRACKER_PROJECT_BINDING,
        recordRevision: 0,
      })
      if (started.kind !== "question") return undefined
      this.sessions.set(sessionId, started.state)
      return renderQuestion(started.state, {
        approvalBlocked: started.approvalBlocked,
        visibleActivation: started.visibleActivation,
      })
    }

    if (isProductInterviewStop(normalized)) {
      this.sessions.delete(sessionId)
      this.suppressedSessions.add(sessionId)
      return renderStopped(socraticInterviewProgress(current.topicIndex))
    }

    const next = advanceSocraticInterview(current, normalized)
    if (next.kind === "blocked") return undefined
    if (next.kind === "stopped") {
      this.sessions.delete(sessionId)
      this.suppressedSessions.add(sessionId)
      return renderStopped(next.progress)
    }
    if (next.kind === "approved") {
      this.sessions.delete(sessionId)
      return renderApproved(next.decisions)
    }

    this.sessions.set(sessionId, next.state)
    if (next.kind === "question") {
      return renderQuestion(next.state, {
        approvalBlocked: next.approvalBlocked,
        visibleActivation: next.visibleActivation,
      })
    }
    if (next.kind === "recommendation") return renderRecommendation(next.state)
    if (next.kind === "explanation-required") return renderClarificationRequired(next.state)
    return renderApprovalRequired(next.state)
  }
}
