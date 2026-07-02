import { describe, expect, it } from "vitest"

import { formatReviewWorkflowBlock } from "../src/runtime/review-workflow-skill.js"
import { detectTopLevelIntent } from "../src/runtime/top-level-intent-router.js"

describe("formatReviewWorkflowBlock", () => {
  it("renders the required review rail discipline", () => {
    const intent = detectTopLevelIntent("이 코드 냉정하게 리뷰해줘")

    if (intent === undefined) {
      throw new Error("expected review intent")
    }

    const block = formatReviewWorkflowBlock(intent)

    expect(block).toContain("[Persona Harness Review Workflow]")
    expect(block).toContain("Detected intent: review")
    expect(block).toContain("Intent classification: review request.")
    expect(block).toContain("Do not modify code")
    expect(block).toContain("Write findings first")
    expect(block).toContain("file/line/evidence/impact")
    expect(block).toContain("Make fixes only when the user explicitly requests them")
    expect(block).toContain("This is not generated app product-quality certification")
  })
})
