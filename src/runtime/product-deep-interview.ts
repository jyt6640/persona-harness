import { createOpenCodeSkillRoute } from "./opencode-skill-adapter.js"

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

type ProductInterviewSession = {
  readonly answers: ReadonlyMap<ProductInterviewTopic, string>
  readonly topicIndex: number
}

export type ProductDeepInterviewResult =
  | { readonly kind: "question"; readonly topic: ProductInterviewTopic; readonly block: string }
  | { readonly kind: "recommendation"; readonly topic: ProductInterviewTopic; readonly block: string }
  | { readonly kind: "approval-required"; readonly block: string }
  | { readonly kind: "approved"; readonly handoff: "technical-intake"; readonly block: string }
  | { readonly kind: "stopped"; readonly block: string }

const START_PATTERN = /(만들래|만들고\s*싶|기획해|구상해|서비스\s*만들|웹\s*서비스|product\s+idea|want\s+to\s+(?:build|explore)|build\s+(?:an?|the)\s+(?:app|service|product)|new\s+(?:app|service|product)|(?:app|service|product)\s+idea)/iu
const APPROVAL_PATTERN = /^(?:승인|진행하자|시작하자|approve|proceed|go\s+ahead)$/iu
const STOP_PATTERN = /^(?:stop|pause|그만|중단)$/iu
const DEFER_PATTERN = /^(?:defer|skip|later|보류|넘겨)$/iu
const RECOMMEND_PATTERN = /^(?:recommend|recommendation|추천)$/iu

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
        decision: "suggest",
        skillId: "deep-interview",
        reason: "Product facts are still unresolved, so technical intake and planning remain deferred.",
      }),
      "",
      "Current understanding: product discovery is in progress in this conversation.",
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

function briefAnswer(session: ProductInterviewSession, topic: ProductInterviewTopic): string {
  return session.answers.get(topic) ?? "deferred"
}

function renderApprovalRequired(session: ProductInterviewSession): ProductDeepInterviewResult {
  return {
    kind: "approval-required",
    block: [
      "[Persona Harness Product Interview]",
      "Approval brief:",
      ...TOPICS.map((topic) => `- ${topic.id}: ${briefAnswer(session, topic.id)}`),
      "Approval is explicit: reply `approve` to hand off to technical-intake, or name a correction.",
      "No plan, ticket, workflow, branch, file, issue, or agent action has been created.",
    ].join("\n"),
  }
}

function startSession(): ProductInterviewSession {
  return { answers: new Map<ProductInterviewTopic, string>(), topicIndex: 0 }
}

export class ProductDeepInterviewTracker {
  private readonly sessions = new Map<string, ProductInterviewSession>()

  route(sessionId: string, message: string): ProductDeepInterviewResult | undefined {
    const normalized = message.trim()
    if (normalized.length === 0) {
      return undefined
    }

    const current = this.sessions.get(sessionId)
    if (current === undefined) {
      if (!START_PATTERN.test(normalized)) {
        return undefined
      }
      const started = startSession()
      this.sessions.set(sessionId, started)
      return renderQuestion(started)
    }

    if (STOP_PATTERN.test(normalized)) {
      this.sessions.delete(sessionId)
      return {
        kind: "stopped",
        block: [
          "[Persona Harness Product Interview]",
          "Product discovery is paused.",
          "No project, workflow, issue, agent, or file state was changed.",
        ].join("\n"),
      }
    }
    if (RECOMMEND_PATTERN.test(normalized)) {
      return renderRecommendation(current)
    }
    if (APPROVAL_PATTERN.test(normalized)) {
      if (current.topicIndex < TOPICS.length) {
        return renderQuestion(current, true)
      }
      this.sessions.delete(sessionId)
      return {
        kind: "approved",
        handoff: "technical-intake",
        block: [
          "[Persona Harness Product Interview]",
          renderApprovalRequired(current).block,
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
    const next: ProductInterviewSession = { answers, topicIndex: current.topicIndex + 1 }
    this.sessions.set(sessionId, next)
    return next.topicIndex >= TOPICS.length ? renderApprovalRequired(next) : renderQuestion(next)
  }
}
