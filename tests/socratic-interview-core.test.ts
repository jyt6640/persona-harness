import { describe, expect, it } from "vitest"

import {
  advanceSocraticInterview,
  createSocraticInterview,
  type SocraticInterviewState,
} from "../src/interview/socratic-interview-core.js"

const PROJECT_BINDING = "sha256:4f7d9f6d4d08f763d22a74d6065b5e9eb44a6d5a32a9a570910072f6a0a0e8bf"

describe("portable Socratic interview core", () => {
  it("activates visibly, advances one decision at a time, and uses only ten-percent progress steps", () => {
    const started = createSocraticInterview({
      mode: "new-product",
      projectBinding: PROJECT_BINDING,
      recordRevision: 0,
    })

    expect(started).toMatchObject({
      kind: "question",
      progress: 10,
      visibleActivation: true,
    })
    expect(started.question.id).toBe("target-user")

    let state = started.state
    const answers = [
      "People booking a nearby shared workspace.",
      "They cannot tell whether a desk is available today.",
      "They can reserve a desk without sending messages.",
      "Search, select a desk, and confirm one booking.",
      "Availability and one confirmed booking.",
      "No payments or team administration in the first release.",
      "One completed booking from a new user.",
      "Start with one location and manual moderation.",
    ]

    for (const [index, answer] of answers.entries()) {
      const next = advanceSocraticInterview(state, answer)
      if (index === answers.length - 1) {
        expect(next).toMatchObject({ kind: "approval-required", progress: 90 })
        if (next.kind !== "approval-required") throw new Error("Expected approval-required state")
        state = next.state
        continue
      }
      expect(next).toMatchObject({ kind: "question", progress: (index + 2) * 10 })
      if (next.kind !== "question") throw new Error("Expected next question state")
      state = next.state
    }

    const approved = advanceSocraticInterview(state, "approver")
    expect(approved).toMatchObject({ kind: "approved", progress: 100 })
    if (approved.kind !== "approved") throw new Error("Expected approved decision")
    expect(approved.decisions).toHaveLength(8)
  })

  it("explains the unresolved question without advancing, then stops without an implicit restart state", () => {
    const started = createSocraticInterview({
      mode: "brownfield-change-discovery",
      projectBinding: PROJECT_BINDING,
      recordRevision: 3,
    })

    const explanation = advanceSocraticInterview(started.state, "무슨 말인지 모르겠어. 쉽게 설명해줘.")
    expect(explanation).toMatchObject({
      kind: "explanation-required",
      progress: 10,
      topic: "target-user",
    })
    if (explanation.kind !== "explanation-required") throw new Error("Expected clarification state")
    expect(explanation.state).toEqual(started.state)

    const stopped = advanceSocraticInterview(explanation.state, "stop")
    expect(stopped).toMatchObject({ kind: "stopped", progress: 10 })
    expect("state" in stopped).toBe(false)
  })

  it("rejects structurally invalid state before exposing a question or a decision", () => {
    const invalid = {
      contractVersion: "persona-socratic-interview-state.1",
      decisions: [],
      mode: "new-product",
      projectBinding: PROJECT_BINDING,
      recordRevision: 0,
      topicIndex: 2,
    } as unknown as SocraticInterviewState

    const result = advanceSocraticInterview(invalid, "A user answer")

    expect(result).toEqual({ kind: "blocked", code: "socratic-interview-state-malformed" })
  })
})
