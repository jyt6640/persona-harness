import { describe, expect, it } from "vitest"

import { ProductDeepInterviewTracker } from "../src/runtime/product-deep-interview.js"
import { detectTopLevelIntent } from "../src/runtime/top-level-intent-router.js"

describe("automatic Persona shared-skill activation", () => {
  it("activates the deep interview with one safe question for an ambiguous new-product request", () => {
    const intent = detectTopLevelIntent("I want to build a small neighbourhood booking product")
    const tracker = new ProductDeepInterviewTracker()
    const result = tracker.route("new-product", "I want to build a small neighbourhood booking product")

    expect(intent).toMatchObject({
      primary: "product-interview",
      activation: {
        decision: "automatic",
        skillId: "deep-interview",
        firstAction: "one-question-product-interview",
      },
    })
    expect(result).toMatchObject({ kind: "question", topic: "target-user" })
    expect(result?.block).toContain("Decision: activate")
    expect(result?.block).not.toContain("# Product Deep Interview")
    expect(result?.block).not.toContain("npx ph workflow")
  })

  it("recognizes create and make app requests as product discovery without treating exchange as a hang", () => {
    for (const message of [
      "Create an app for neighbours to exchange practical skills",
      "Make a service for local volunteers",
    ]) {
      expect(detectTopLevelIntent(message)).toMatchObject({
        primary: "product-interview",
        activation: {
          decision: "automatic",
          skillId: "deep-interview",
          firstAction: "one-question-product-interview",
        },
      })
    }

    expect(detectTopLevelIntent("The booking app hangs after checkout")).toMatchObject({
      primary: "debug",
      activation: { skillId: "debug" },
    })
  })

  it("activates brownfield discovery with a code-first first action", () => {
    const intent = detectTopLevelIntent("I want to improve an existing booking flow", {
      productMode: "brownfield-change-discovery",
    })
    const tracker = new ProductDeepInterviewTracker({ mode: "brownfield-change-discovery" })
    const result = tracker.route("brownfield", "I want to improve an existing booking flow")

    expect(intent).toMatchObject({
      primary: "product-interview",
      activation: {
        decision: "automatic",
        skillId: "deep-interview",
        firstAction: "code-first-change-discovery",
      },
    })
    expect(result?.block).toContain("Mode: brownfield-change-discovery")
    expect(result?.block).toContain("Decision: activate")
    expect(result?.block).toContain("No plan, ticket, workflow, branch, file, issue, or agent action has been created")
  })

  it("lets an explicit Persona skill command win over ambiguous product discovery", () => {
    const intent = detectTopLevelIntent("/persona debug I want to build a booking product that is failing")

    expect(intent).toMatchObject({
      primary: "debug",
      activation: {
        decision: "explicit",
        skillId: "debug",
        firstAction: "advisory-reference",
      },
    })
  })

  it("lets clear direct work bypass ambiguous product discovery", () => {
    const cases = [
      ["Implement BookingController for the existing service", "programming", "programming"],
      ["The booking flow fails; debug it", "debug", "debug"],
      ["Review the existing booking implementation", "review", "review"],
      ["Refactor the booking service", "refactor", "refactor"],
      ["git status for the booking repository", "git", "git"],
    ] as const

    for (const [message, primary, skillId] of cases) {
      expect(detectTopLevelIntent(message)).toMatchObject({
        primary,
        activation: {
          decision: "automatic",
          skillId,
          firstAction: "advisory-reference",
        },
      })
    }
  })

  it("suppresses new discovery for explicit skip, defer, or stop messages", () => {
    for (const message of [
      "skip product discovery for a booking product",
      "defer product discovery for a booking product",
      "stop product interview for a booking product",
    ]) {
      expect(detectTopLevelIntent(message)).toBeUndefined()
    }
  })

  it("fails closed for malformed or unavailable explicit Persona skill commands and falls back only for ordinary messages", () => {
    expect(detectTopLevelIntent("/persona")).toMatchObject({
      primary: "unavailable",
      reasonCode: "malformed-explicit-skill-command",
    })
    expect(detectTopLevelIntent("/persona unavailable-skill")).toMatchObject({
      primary: "unavailable",
      reasonCode: "unavailable-explicit-skill",
    })
    expect(detectTopLevelIntent("tell me what a booking flow is")).toBeUndefined()
  })
})
