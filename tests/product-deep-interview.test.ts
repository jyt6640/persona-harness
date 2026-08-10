import { describe, expect, it } from "vitest"

import { ProductDeepInterviewTracker } from "../src/runtime/product-deep-interview.js"

describe("product deep interview", () => {
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

  it("keeps brownfield discovery code-first without creating project state", () => {
    const tracker = new ProductDeepInterviewTracker({ mode: "brownfield-change-discovery" })

    const result = tracker.route("session-brownfield", "I want to improve an existing booking flow")

    expect(result).toMatchObject({ kind: "question", topic: "target-user" })
    expect(result?.block).toContain("Mode: brownfield-change-discovery")
    expect(result?.block).toContain("Read relevant existing code before asking for facts it already answers")
    expect(result?.block).toContain("No plan, ticket, workflow, branch, file, issue, or agent action has been created")
  })
})
