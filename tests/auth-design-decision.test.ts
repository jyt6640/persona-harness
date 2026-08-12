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
    expect(tracker.isApproved("session-complete")).toBe(false)
  })

  it("does not reflect decision values in the bounded state or block", () => {
    const tracker = new AuthDesignDecisionTracker()
    const secret = "provider: secret-provider-token"
    const result = tracker.route("session-private", `Implement OAuth login ${secret}`)

    expect(JSON.stringify(result)).not.toContain("secret-provider-token")
    expect(JSON.stringify(initialAuthDesignDecision())).not.toContain("secret-provider-token")
  })
})
