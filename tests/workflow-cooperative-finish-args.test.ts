import { describe, expect, it } from "vitest"

import { parseWorkflowArgs } from "../src/cli/workflow-args.js"

describe("workflow cooperative Finish arguments", () => {
  it("selects cooperative assurance only when explicitly requested", () => {
    // Given: a public Finish command that opts in to cooperative assurance.
    const parsed = parseWorkflowArgs(["finish", "implement", "--assurance", "cooperative"])

    // When: argument parsing completes.
    // Then: the mode is preserved without enabling external fallback.
    expect(parsed).toEqual({
      assurance: "cooperative",
      ci: false,
      kind: "finish",
      reverify: false,
      runnerKind: "implement",
    })
  })

  it("keeps the default Finish assurance external", () => {
    // Given: the existing Finish command without an assurance option.
    const parsed = parseWorkflowArgs(["finish", "implement"])

    // When: argument parsing completes.
    // Then: default behavior cannot silently select cooperative authority.
    expect(parsed).toEqual({
      assurance: "external",
      ci: false,
      kind: "finish",
      reverify: false,
      runnerKind: "implement",
    })
  })

  it("rejects a cooperative request combined with the legacy reverification mode", () => {
    // Given: two distinct verification modes in one Finish command.
    const parsed = parseWorkflowArgs(["finish", "implement", "--assurance", "cooperative", "--reverify"])

    // When: argument parsing completes.
    // Then: no fallback or mixed-mode execution is accepted.
    expect(parsed).toEqual({
      kind: "invalid",
      message: "workflow finish implement --assurance cooperative does not accept --reverify or --ci.",
    })
  })
})
