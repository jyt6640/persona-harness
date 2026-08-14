import { describe, expect, it, vi } from "vitest"

vi.mock("../src/cli/workflow-closure.js", () => ({
  readWorkflowClosurePayload: () => ({}),
}))

vi.mock("../src/cli/workflow-closure-finish.js", () => ({
  workflowClosureFinishReasons: () => [],
  workflowFinishFollowUp: () => null,
}))

vi.mock("../src/cli/workflow-finish-authority.js", async () => {
  const actual = await vi.importActual<typeof import("../src/cli/workflow-finish-authority.js")>(
    "../src/cli/workflow-finish-authority.js",
  )
  return {
    ...actual,
    readWorkflowFinishAuthority: () => ({
      blocker: {
        id: "trusted-authority-required",
        reason: "A trusted external authority is required before completion can pass.",
        source: ".persona/evidence/finish-attestation",
      },
      completion: {
        blockers: [{
          code: "trusted-authority-required",
          summary: "A trusted external authority is required before completion can pass.",
        }],
        passed: false,
        state: "blocked",
      },
      status: "trusted",
    }),
  }
})

const { runWorkflowFinishResult } = await import("../src/cli/workflow-finish-runner.js")

describe("workflow finish completion decision", () => {
  it("blocks when the core decision is blocked even if a display status contradicts it", () => {
    const result = runWorkflowFinishResult("implement", "/fixture")

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Blocker: trusted-authority-required")
  })
})
