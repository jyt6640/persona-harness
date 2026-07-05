import { describe, expect, it } from "vitest"

import { failedRunnerOutput } from "../src/cli/workflow-output.js"
import type { StructuredWorkflowRequiredFix } from "../src/cli/workflow-required-fix.js"

function structuredFix(overrides: Partial<StructuredWorkflowRequiredFix> = {}): StructuredWorkflowRequiredFix {
  return {
    blockerId: "review-report-missing",
    detail: [
      "Closure blocker: rendered-text-should-not-drive-summary",
      "Implementation report is filled but review report is template.",
      "Required next actions:",
      "- This rendered bullet should not drive the summary.",
    ].join("\n"),
    nextAction: "fill .persona/workflow/review-report.md after review/manual QA, then run `npx ph plan --report-filled review`",
    reason: "review report is template",
    source: ".persona/workflow/review-report.md",
    step: {
      commandAfterContent: "npx ph plan --report-filled review",
      id: "fill-review-report",
      kind: "human-or-model-content",
      status: "blocked",
    },
    type: "closure-blocker",
    ...overrides,
  }
}

describe("workflow failed finish summary", () => {
  it("derives blocker summary from structured fix fields instead of rendered detail text", () => {
    const result = failedRunnerOutput("finish", "implement", [structuredFix()])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Summary:")
    expect(result.stderr).toContain("- closure blockers: 1")
    expect(result.stderr).toContain("- first blocker: review-report-missing")
    expect(result.stderr).toContain("- first next action: fill .persona/workflow/review-report.md after review/manual QA")
    expect(result.stderr).not.toContain("- first blocker: rendered-text-should-not-drive-summary")
    expect(result.stderr).toContain("Required fixes:")
    expect(result.stderr).toContain("Closure blocker: rendered-text-should-not-drive-summary")
  })

  it("does not parse plain string fixes as closure blockers", () => {
    const result = failedRunnerOutput("finish", "implement", [
      [
        "Closure blocker: fake-rendered-blocker",
        "Required next actions:",
        "- This legacy string is rendered as a required fix only.",
      ].join("\n"),
    ])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("- required fixes: 1")
    expect(result.stderr).toContain("- first required fix: Closure blocker: fake-rendered-blocker")
    expect(result.stderr).toContain("- first next action: see first required fix below")
    expect(result.stderr).not.toContain("- closure blockers: 1")
    expect(result.stderr).not.toContain("- first blocker: fake-rendered-blocker")
  })
})
