import { describe, expect, it } from "vitest"

import { formatProgrammingWorkflowBlock } from "../src/runtime/programming-workflow-skill.js"
import { detectTopLevelIntent } from "../src/runtime/top-level-intent-router.js"

describe("formatProgrammingWorkflowBlock", () => {
  it("renders the required direct programming rail discipline", () => {
    const intent = detectTopLevelIntent("CouponService 만들어줘")

    if (intent === undefined) {
      throw new Error("expected programming intent")
    }

    const block = formatProgrammingWorkflowBlock(intent)

    expect(block).toContain("[Persona Harness Programming Workflow]")
    expect(block).toContain("Detected intent: programming")
    expect(block).toContain("Intent classification: direct programming request.")
    expect(block).toContain("Read the relevant files first")
    expect(block).toContain("Follow the existing project structure and naming")
    expect(block).toContain("Do not add features, refactor, or change policy outside the requested scope")
    expect(block).toContain("Do not describe unverified items as complete")
    expect(block).toContain("This does not replace requirements/debug/review/refactor/git rails")
  })
})
