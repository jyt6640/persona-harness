import { createOpenCodeSkillRoute } from "./opencode-skill-adapter.js"
import {
  isExplicitProductInterviewRequest,
  isProductInterviewApproval,
  isProductInterviewClarification,
  isProductInterviewStop,
} from "./product-interview-control.js"

const TOPICS = [
  {
    id: "target-user",
    question: "Who is the first specific user this product should help?",
    recommendation: "Name one primary user group before describing features.",
    tradeoff: "A narrow first user makes the MVP easier to test; a broad audience can hide conflicting needs.",
  },
  {
    id: "problem",
    question: "What recurring problem does that user have today?",
    recommendation: "Describe the costly or frustrating moment, not the proposed feature.",
    tradeoff: "Problem-first framing prevents a polished solution from solving the wrong thing.",
  },
  {
    id: "outcome",
    question: "What observable outcome should improve for that user?",
    recommendation: "Choose a result the user can recognize without internal metrics.",
    tradeoff: "A concrete outcome keeps the plan honest; an ambitious outcome may require more discovery.",
  },
  {
    id: "journey",
    question: "What is the shortest user journey from need to that outcome?",
    recommendation: "State the first end-to-end path before listing screens or integrations.",
    tradeoff: "A short journey clarifies the MVP; edge cases can remain explicitly deferred.",
  },
  {
    id: "mvp",
    question: "Which smallest capabilities must exist for that journey to work?",
    recommendation: "Limit the MVP to the minimum user-visible capabilities.",
    tradeoff: "Fewer capabilities accelerate learning; omitted conveniences may need manual support at first.",
  },
  {
    id: "non-goals",
    question: "Which tempting capabilities are explicitly out of scope for the MVP?",
    recommendation: "Name at least one attractive exclusion.",
    tradeoff: "Clear non-goals protect focus; they may disappoint some early requests by design.",
  },
  {
    id: "success-signal",
    question: "What first signal would tell you this MVP is useful?",
    recommendation: "Use one observable behavior or outcome rather than a vanity metric.",
    tradeoff: "A simple signal supports early decisions; it may not predict long-term retention.",
  },
  {
    id: "constraints",
    question: "Which product constraints or risks must shape the first release?",
    recommendation: "Include timing, privacy, compliance, operations, or integration limits only when they change the product decision.",
    tradeoff: "Naming real constraints early avoids surprise rework; speculative technical choices can wait for technical intake.",
  },
] as const

type ProductInterviewTopic = (typeof TOPICS)[number]["id"]

export type ProductDeepInterviewMode = "new-product" | "brownfield-change-discovery"

type ProductInterviewSession = {
  readonly answers: ReadonlyMap<ProductInterviewTopic, string>
  readonly mode: ProductDeepInterviewMode
  readonly topicIndex: number
}

export type ProductDeepInterviewOptions = {
  readonly mode?: ProductDeepInterviewMode
}

export type ProductDeepInterviewResult =
  | { readonly kind: "question"; readonly topic: ProductInterviewTopic; readonly block: string }
  | { readonly kind: "recommendation"; readonly topic: ProductInterviewTopic; readonly block: string }
  | { readonly kind: "clarification-required"; readonly topic: ProductInterviewTopic; readonly block: string }
  | { readonly kind: "approval-required"; readonly block: string }
  | { readonly kind: "approved"; readonly handoff: "technical-intake"; readonly block: string }
  | { readonly kind: "stopped"; readonly block: string }

const START_PATTERN = /(만들래|만들고\s*싶|기획해|구상해|서비스\s*만들|웹\s*서비스|기존\s*(?:서비스|제품|앱|흐름).*(?:개선|변경)|product\s+idea|want\s+to\s+(?:build|create|make|explore)|(?:build|create|make)\s+(?:an?|the)\s+(?:app|service|product)|new\s+(?:app|service|product)|(?:app|service|product)\s+idea|(?:improve|change)\s+(?:an?\s+)?existing(?:\s+\w+){0,2}\s+(?:app|service|product|flow))/iu
const DEFER_PATTERN = /^(?:defer|skip|later|보류|넘겨)$/iu
const RECOMMEND_PATTERN = /^(?:recommend|recommendation|추천)$/iu
const STOPPED_BLOCK = "[Persona Harness Product Interview]\nProduct discovery is paused.\nNo project, workflow, issue, agent, or file state was changed."

export function isProductDeepInterviewStart(message: string): boolean {
  return START_PATTERN.test(message.trim())
}

function topicAt(index: number): (typeof TOPICS)[number] | undefined {
  return TOPICS[index]
}

function renderQuestion(session: ProductInterviewSession, approvalBlocked = false): ProductDeepInterviewResult {
  const topic = topicAt(session.topicIndex)
  if (topic === undefined) {
    return renderApprovalRequired(session)
  }

  return {
    kind: "question",
    topic: topic.id,
    block: [
      "[Persona Harness Product Interview]",
      createOpenCodeSkillRoute({
        decision: "activate",
        firstAction: session.mode === "brownfield-change-discovery" ? "code-first-change-discovery" : "one-question-product-interview",
        skillId: "deep-interview",
        reason: "Product facts are still unresolved, so technical intake and planning remain deferred.",
      }),
      "",
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
      ...(approvalBlocked ? ["Approval is not available until this product decision is answered or deferred."] : []),
      `Question: ${topic.question}`,
      `Recommendation: ${topic.recommendation}`,
      `Tradeoff: ${topic.tradeoff}`,
      "Reply freely, or use `recommend`, `defer`, or `stop`.",
      "No plan, ticket, workflow, branch, file, issue, or agent action has been created.",
    ].join("\n"),
  }
}

function renderRecommendation(session: ProductInterviewSession): ProductDeepInterviewResult {
  const topic = topicAt(session.topicIndex)
  if (topic === undefined) {
    return renderApprovalRequired(session)
  }
  return {
    kind: "recommendation",
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

function renderClarificationRequired(session: ProductInterviewSession): ProductDeepInterviewResult {
  const topic = topicAt(session.topicIndex)
  if (topic === undefined) {
    return renderApprovalRequired(session)
  }
  return {
    kind: "clarification-required",
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

function briefAnswer(session: ProductInterviewSession, topic: ProductInterviewTopic): string {
  return session.answers.get(topic) ?? "deferred"
}

function approvalBriefLines(session: ProductInterviewSession): readonly string[] {
  return [
    "Approval brief:",
    ...TOPICS.map((topic) => `- ${topic.id}: ${briefAnswer(session, topic.id)}`),
    "Approval is explicit: reply `approve` to hand off to technical-intake, or name a correction.",
  ]
}

function renderApprovalRequired(session: ProductInterviewSession): ProductDeepInterviewResult {
  return {
    kind: "approval-required",
    block: [
      "[Persona Harness Product Interview]",
      ...approvalBriefLines(session),
      "No plan, ticket, workflow, branch, file, issue, or agent action has been created.",
    ].join("\n"),
  }
}

function startSession(mode: ProductDeepInterviewMode): ProductInterviewSession {
  return { answers: new Map<ProductInterviewTopic, string>(), mode, topicIndex: 0 }
}

export class ProductDeepInterviewTracker {
  private readonly sessions = new Map<string, ProductInterviewSession>()
  private readonly suppressedSessions = new Set<string>()

  constructor(private readonly options: ProductDeepInterviewOptions = {}) {}

  hasActiveSession(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }

  route(sessionId: string, message: string): ProductDeepInterviewResult | undefined {
    const normalized = message.trim()
    if (normalized.length === 0) {
      return undefined
    }

    const current = this.sessions.get(sessionId)
    if (current === undefined) {
      if (this.suppressedSessions.has(sessionId)) {
        if (!isExplicitProductInterviewRequest(normalized)) {
          return undefined
        }
        this.suppressedSessions.delete(sessionId)
      }
      if (!isProductDeepInterviewStart(normalized)) {
        if (!isExplicitProductInterviewRequest(normalized)) {
          return undefined
        }
      }
      const started = startSession(this.options.mode ?? "new-product")
      this.sessions.set(sessionId, started)
      return renderQuestion(started)
    }

    if (isProductInterviewStop(normalized)) {
      this.sessions.delete(sessionId)
      this.suppressedSessions.add(sessionId)
      return { kind: "stopped", block: STOPPED_BLOCK }
    }
    if (RECOMMEND_PATTERN.test(normalized)) {
      return renderRecommendation(current)
    }
    if (isProductInterviewClarification(normalized)) {
      return renderClarificationRequired(current)
    }
    if (isProductInterviewApproval(normalized)) {
      if (current.topicIndex < TOPICS.length) {
        return renderQuestion(current, true)
      }
      this.sessions.delete(sessionId)
      return {
        kind: "approved",
        handoff: "technical-intake",
        block: [
          "[Persona Harness Product Interview]",
          ...approvalBriefLines(current),
          "Approval received in this conversation only.",
          "Next explicit handoff: technical-intake.",
          "Sequence after an explicit technical brief: plan -> optional ralplan -> TDD -> implementation -> review.",
          "Optional adversarial review after planning: ralplan.",
          "The host adapter does not create or advance workflow state.",
        ].join("\n"),
      }
    }

    const topic = topicAt(current.topicIndex)
    if (topic === undefined) {
      return renderApprovalRequired(current)
    }
    const answer = DEFER_PATTERN.test(normalized) ? "deferred" : normalized.slice(0, 600)
    const answers = new Map(current.answers)
    answers.set(topic.id, answer)
    const next: ProductInterviewSession = { answers, mode: current.mode, topicIndex: current.topicIndex + 1 }
    this.sessions.set(sessionId, next)
    return next.topicIndex >= TOPICS.length ? renderApprovalRequired(next) : renderQuestion(next)
  }
}
