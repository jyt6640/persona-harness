import { describe, expect, it } from "vitest"

import {
  AUTH_DESIGN_DECISION_SLOTS,
  AuthDesignDecisionTracker,
  initialAuthDesignDecision,
  isAuthSecurityRequest,
} from "../src/runtime/auth-design-decision.js"

describe("auth design decision hold", () => {
  it("starts with every architecture slot unresolved and blocks both handoffs", () => {
    const tracker = new AuthDesignDecisionTracker()
    const result = tracker.route("session-auth", "Implement OAuth login for the service")

    expect(isAuthSecurityRequest("Implement OAuth login for the service")).toBe(true)
    expect(result).toMatchObject({
      kind: "design-required",
      decision: {
        state: "design-required",
        status: "design-required",
        approval: "not-accepted",
        allowImplementation: false,
        allowWorkflowProgression: false,
      },
      nextSlot: "provider",
    })
    expect(result?.kind === "design-required" ? result.decision.missingSlots : []).toEqual(AUTH_DESIGN_DECISION_SLOTS)
    expect(result?.kind === "design-required" ? result.block : "").toContain(
      "Respond with exactly one question ending in `?` about the named decision slot.",
    )
    expect(result?.kind === "design-required" ? result.block : "").toContain(
      "Do not provide a solution, implementation, plan, command, or file change.",
    )
  })

  it("keeps a bare approval blocked while any architecture slot is missing", () => {
    const tracker = new AuthDesignDecisionTracker()

    tracker.route("session-approval", "Add authentication to the service")
    const result = tracker.route("session-approval", "approve")

    expect(result).toMatchObject({
      kind: "design-required",
      decision: {
        state: "design-required",
        approval: "not-accepted",
        allowImplementation: false,
        allowWorkflowProgression: false,
      },
    })
    expect(tracker.isApproved("session-approval")).toBe(false)
  })

  it.each([
    "무슨 말인지 모르겠어. 쉽게 설명해줘.",
    "I do not understand what you mean. Please explain it.",
  ])("keeps callback unresolved when the user asks for an explanation: %s", (clarificationRequest) => {
    const tracker = new AuthDesignDecisionTracker()
    tracker.route("session-clarification", "Implement OAuth login for the service")
    tracker.route("session-clarification", "provider: GitHub")
    tracker.route("session-clarification", "domain: OAuthAccount")

    const clarification = tracker.route("session-clarification", clarificationRequest)

    expect(clarification).toMatchObject({
      kind: "clarification-required",
      nextSlot: "callback",
      decision: {
        answeredSlots: ["provider", "domain"],
        missingSlots: ["callback", "state", "layer", "type-exception", "global-scope"],
      },
    })
    if (clarification?.kind !== "clarification-required") {
      throw new Error("expected an auth design clarification route")
    }
    expect(clarification.block).toContain("The user's latest message is a clarification request, not an architecture decision.")
    expect(clarification.block).toContain("Do not record an answer, advance to another slot, or ask the next slot")
    expect(clarification.block).not.toContain("Next decision slot: state")

    const answer = tracker.route("session-clarification", "callback: /login/oauth2/code/github")
    expect(answer).toMatchObject({ kind: "design-required", nextSlot: "state" })
  })

  it("stops an active auth interview when the user says it is not needed", () => {
    const tracker = new AuthDesignDecisionTracker()
    tracker.route("session-natural-stop", "Implement OAuth login for the service")

    const stopped = tracker.route("session-natural-stop", "아니 지금 필요없는 인터뷰 하지마")

    expect(stopped).toMatchObject({ kind: "stopped" })
    expect(stopped?.kind === "stopped" ? stopped.block : "").toContain("State: stopped")
    expect(tracker.hasActiveSession("session-natural-stop")).toBe(false)
    expect(tracker.route("session-natural-stop", "Implement billing invoices now")).toBeUndefined()
    expect(tracker.route("session-natural-stop", "Implement OAuth login now")).toMatchObject({
      kind: "design-required",
      nextSlot: "provider",
    })
  })

  it("does not consume an explicit workflow dogfooding task as an auth decision", () => {
    const tracker = new AuthDesignDecisionTracker()
    tracker.route("session-dogfooding-switch", "Implement OAuth login for the service")

    const stopped = tracker.route(
      "session-dogfooding-switch",
      "workflow finish implement는 source-read-runtime-unavailable 환경 문제로 막혔지만, 구현·리뷰 보고서와 history archive는 모두 기록됐다. 이 문제를 feedback-dogfooding으로 기재하자.",
    )

    expect(stopped).toMatchObject({ kind: "stopped" })
    expect(tracker.hasActiveSession("session-dogfooding-switch")).toBe(false)
    expect(tracker.route("session-dogfooding-switch", "Implement billing invoices now")).toBeUndefined()
  })

  it.each(AUTH_DESIGN_DECISION_SLOTS)("keeps a conflicting %s decision blocked", (slot) => {
    const tracker = new AuthDesignDecisionTracker()
    tracker.route(`session-conflict-${slot}`, "Implement OAuth login for the service")
    tracker.route(`session-conflict-${slot}`, `${slot}: first-choice`)

    const conflict = tracker.route(`session-conflict-${slot}`, `${slot}: second-choice`)

    expect(conflict).toMatchObject({
      kind: "design-required",
      decision: {
        state: "design-required",
        approval: "not-accepted",
        allowImplementation: false,
        allowWorkflowProgression: false,
        conflictedSlots: [slot],
      },
    })
    expect(tracker.route(`session-conflict-${slot}`, "approve")).toMatchObject({
      kind: "design-required",
      decision: { conflictedSlots: [slot], allowImplementation: false },
    })
  })

  it("requires an explicit resolution command and never selects a conflicting value", () => {
    const tracker = new AuthDesignDecisionTracker()
    tracker.route("session-resolution", "Implement OAuth login for the service")
    tracker.route("session-resolution", "provider: first-choice")
    tracker.route("session-resolution", "provider: second-choice")

    const unresolved = tracker.route("session-resolution", "provider: third-choice")
    expect(unresolved).toMatchObject({ kind: "design-required", decision: { conflictedSlots: ["provider"] } })

    const resolved = tracker.route("session-resolution", "resolve provider: explicitly-chosen")
    expect(resolved).toMatchObject({ kind: "design-required", decision: { conflictedSlots: [], answeredSlots: ["provider"] } })
  })

  it("releases the existing handoff only after all named decisions and explicit approval", () => {
    const tracker = new AuthDesignDecisionTracker()
    tracker.route("session-complete", "Implement SSO for the service")

    for (const slot of AUTH_DESIGN_DECISION_SLOTS) {
      const result = tracker.route("session-complete", `${slot}: chosen-${slot}`)
      if (slot === "global-scope") {
        expect(result).toMatchObject({ kind: "approval-required" })
      }
    }

    const approved = tracker.route("session-complete", "approve")
    expect(approved).toMatchObject({
      kind: "approved",
      decision: {
        state: "approved",
        status: "approved",
        approval: "accepted",
        missingSlots: [],
        allowImplementation: true,
        allowWorkflowProgression: true,
      },
    })
    expect(tracker.isApproved("session-complete")).toBe(true)

    expect(tracker.route("session-complete", "Implement SSO now")).toEqual({ kind: "released" })
    expect(tracker.isApproved("session-complete")).toBe(true)
    expect(tracker.route("session-complete", "Update OAuth callback handling now")).toEqual({ kind: "released" })
    expect(tracker.isApproved("session-complete")).toBe(true)

    expect(tracker.route("session-complete", "Implement billing invoices now")).toBeUndefined()
    expect(tracker.isApproved("session-complete")).toBe(true)
    expect(tracker.route("session-fresh", "Implement OAuth login now")).toMatchObject({
      kind: "design-required",
      nextSlot: "provider",
    })
  })

  it("accepts an isolated one-character approval typo only after every decision is explicit", () => {
    const tracker = new AuthDesignDecisionTracker()
    tracker.route("session-approval-typo", "Implement OAuth login for the service")

    for (const slot of AUTH_DESIGN_DECISION_SLOTS) {
      tracker.route("session-approval-typo", `${slot}: chosen-${slot}`)
    }

    expect(tracker.route("session-approval-typo", "approver")).toMatchObject({
      kind: "approved",
      decision: { approval: "accepted", allowImplementation: true },
    })

    const incomplete = new AuthDesignDecisionTracker()
    incomplete.route("session-incomplete-typo", "Implement OAuth login for the service")
    expect(incomplete.route("session-incomplete-typo", "approver")).toMatchObject({
      kind: "design-required",
      decision: { approval: "not-accepted", allowImplementation: false },
    })

    const nonCommand = new AuthDesignDecisionTracker()
    nonCommand.route("session-non-command", "Implement OAuth login for the service")
    for (const slot of AUTH_DESIGN_DECISION_SLOTS) {
      nonCommand.route("session-non-command", `${slot}: chosen-${slot}`)
    }
    expect(nonCommand.route("session-non-command", "please approve this design")).toMatchObject({
      kind: "approval-required",
      decision: { approval: "not-accepted", allowImplementation: false },
    })
  })

  it("does not reflect decision values in the bounded state or block", () => {
    const tracker = new AuthDesignDecisionTracker()
    const secret = "provider: secret-provider-token"
    const result = tracker.route("session-private", `Implement OAuth login ${secret}`)

    expect(JSON.stringify(result)).not.toContain("secret-provider-token")
    expect(JSON.stringify(initialAuthDesignDecision())).not.toContain("secret-provider-token")
  })
})
