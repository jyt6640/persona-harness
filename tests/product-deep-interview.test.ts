import { describe, expect, it } from "vitest"

import { ProductDeepInterviewTracker } from "../src/runtime/product-deep-interview.js"

describe("product deep interview", () => {
  it("does not start product discovery for direct feedback or a bounded implementation task", () => {
    const tracker = new ProductDeepInterviewTracker()

    // Given: no active product interview.
    // When: the user gives direct, non-discovery tasks.
    const feedback = tracker.route(
      "session-direct-feedback",
      "workflow finish implement was blocked by an environment problem; record it as feedback dogfooding.",
    )
    const implementation = tracker.route("session-direct-implementation", "Implement CouponService")

    // Then: the interview route leaves each task for its normal handler.
    expect(feedback).toBeUndefined()
    expect(implementation).toBeUndefined()
    expect(tracker.hasActiveSession("session-direct-feedback")).toBe(false)
    expect(tracker.hasActiveSession("session-direct-implementation")).toBe(false)
  })

  it("asks one product question at a time and requires explicit approval before the technical handoff", () => {
    const tracker = new ProductDeepInterviewTracker()

    const started = tracker.route("session-1", "I want to build a service for neighbourhood skill swaps")
    expect(started).toMatchObject({ kind: "question", topic: "target-user" })
    expect(started?.block).toContain("Question:")
    expect(started?.block).toContain("Recommendation:")
    expect(started?.block).toContain("Tradeoff:")
    expect(started?.block).not.toContain("npx ph")

    const prematureApproval = tracker.route("session-1", "approve")
    expect(prematureApproval).toMatchObject({ kind: "question", topic: "target-user" })

    const answers = [
      "People who can exchange practical skills with nearby neighbours.",
      "They struggle to find trusted local help without a marketplace fee.",
      "Help users arrange a first safe exchange.",
      "Discover a neighbour, agree on a task, and confirm the exchange.",
      "Profiles, a local request board, and a simple request conversation.",
      "No payments, ratings marketplace, or city-wide logistics in the MVP.",
      "A completed first exchange in the first week.",
      "Start in one neighbourhood and keep moderation manual.",
    ]

    let result = prematureApproval
    for (const answer of answers) {
      result = tracker.route("session-1", answer)
    }

    expect(result).toMatchObject({ kind: "approval-required" })
    expect(result?.block).toContain("Approval brief")
    expect(result?.block).toContain("No plan, ticket, workflow, branch, file, issue, or agent action has been created")

    const approved = tracker.route("session-1", "approve")
    expect(approved).toMatchObject({ kind: "approved", handoff: "technical-intake" })
    expect(approved?.block).toContain("Next explicit handoff: technical-intake")
    expect(approved?.block).toContain("Optional adversarial review after planning: ralplan")
    expect(approved?.block.match(/\[Persona Harness Product Interview\]/g)).toHaveLength(1)
  })

  it("supports defer, recommendation, and stop without silently moving into implementation", () => {
    const tracker = new ProductDeepInterviewTracker()

    tracker.route("session-2", "I want to explore a small booking product")
    const recommendation = tracker.route("session-2", "recommend")
    expect(recommendation).toMatchObject({ kind: "recommendation", topic: "target-user" })

    const deferred = tracker.route("session-2", "defer")
    expect(deferred).toMatchObject({ kind: "question", topic: "problem" })

    const stopped = tracker.route("session-2", "stop")
    expect(stopped).toMatchObject({ kind: "stopped" })
    expect(stopped?.block).toContain("No project, workflow, issue, agent, or file state was changed")
    expect(tracker.route("session-2", "implement it now")).toBeUndefined()
  })

  it("suppresses automatic discovery after a natural-language stop until the user explicitly restarts it", () => {
    const tracker = new ProductDeepInterviewTracker()
    const sessionID = "session-natural-stop"

    // Given: an active product interview.
    tracker.route(sessionID, "I want to explore a small booking product")

    // When: the user rejects further interview questions, then later gives automatic and explicit restart candidates.
    const stopped = tracker.route(sessionID, "아니 지금 필요없는 인터뷰 하지마")
    const automaticRestart = tracker.route(sessionID, "I want to build a booking product")
    const explicitRestart = tracker.route(sessionID, "/persona deep-interview")

    // Then: the stop does not become an answer, automatic discovery stays off, and only the explicit command restarts it.
    expect(stopped).toMatchObject({ kind: "stopped" })
    expect(automaticRestart).toBeUndefined()
    expect(explicitRestart).toMatchObject({ kind: "question", topic: "target-user" })
  })

  it("ends an active interview when workflow feedback becomes the current task", () => {
    const tracker = new ProductDeepInterviewTracker()
    const sessionID = "session-feedback-switch"

    // Given: an active product interview.
    tracker.route(sessionID, "I want to explore a small booking product")

    // When: the user switches to a bounded feedback task.
    const stopped = tracker.route(
      sessionID,
      "workflow finish implement was blocked by an environment problem; record it as feedback dogfooding.",
    )

    // Then: the task is not stored as a product answer or followed by a neighbouring question.
    expect(stopped).toMatchObject({ kind: "stopped" })
    expect(tracker.hasActiveSession(sessionID)).toBe(false)
  })

  it("ends an active interview when the user defers the whole discovery task", () => {
    const tracker = new ProductDeepInterviewTracker()
    const sessionID = "session-task-defer"

    // Given: an active product interview.
    tracker.route(sessionID, "I want to explore a small booking product")

    // When: the user defers discovery rather than one question.
    const stopped = tracker.route(sessionID, "defer product discovery for this task")

    // Then: the bare-topic defer behavior remains separate from a task-level stop.
    expect(stopped).toMatchObject({ kind: "stopped" })
    expect(tracker.hasActiveSession(sessionID)).toBe(false)
  })

  it("holds the current topic when the user asks for an explanation", () => {
    const tracker = new ProductDeepInterviewTracker()
    const sessionID = "session-clarification"

    // Given: the first product decision is unresolved.
    tracker.route(sessionID, "I want to explore a small booking product")

    // When: the user asks what the current question means.
    const clarification = tracker.route(sessionID, "무슨 말인지 모르겠어. 쉽게 설명해줘.")

    // Then: the tracker asks the host to explain the same topic instead of advancing.
    expect(clarification).toMatchObject({ kind: "clarification-required", topic: "target-user" })
    expect(tracker.hasActiveSession(sessionID)).toBe(true)
  })

  it("accepts a one-character approval typo only at the terminal approval boundary", () => {
    const tracker = new ProductDeepInterviewTracker()
    const sessionID = "session-near-approval"
    const answers = [
      "People looking for simple local bookings.",
      "They cannot quickly find a reliable available slot.",
      "They can reserve a suitable slot with confidence.",
      "Choose a slot, confirm it, and receive the booking state.",
      "Available slots and a booking confirmation.",
      "No payments or marketplace features.",
      "A completed first booking.",
      "Start with manual moderation and one location.",
    ]

    // Given: an interview begins with unresolved facts.
    tracker.route(sessionID, "I want to explore a small booking product")

    // When: an approval typo arrives before, then after, the facts are complete.
    const premature = tracker.route(sessionID, "approver")
    for (const answer of answers) {
      tracker.route(sessionID, answer)
    }
    const approved = tracker.route(sessionID, "approver")

    // Then: the premature typo leaves the first topic unresolved, while the terminal one completes the handoff.
    expect(premature).toMatchObject({ kind: "question", topic: "target-user" })
    expect(approved).toMatchObject({ kind: "approved", handoff: "technical-intake" })
  })

  it("keeps brownfield discovery code-first without creating project state", () => {
    const tracker = new ProductDeepInterviewTracker({ mode: "brownfield-change-discovery" })

    const result = tracker.route("session-brownfield", "I want to improve an existing booking flow")

    expect(result).toMatchObject({ kind: "question", topic: "target-user" })
    expect(result?.block).toContain("Mode: brownfield-change-discovery")
    expect(result?.block).toContain("Read relevant existing code before asking for facts it already answers")
    expect(result?.block).toContain("No plan, ticket, workflow, branch, file, issue, or agent action has been created")
  })
})
