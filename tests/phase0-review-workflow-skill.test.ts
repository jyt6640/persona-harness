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
    expect(block).toContain("의도 감지: 리뷰 요청으로 판단함.")
    expect(block).toContain("수정하지 않는다")
    expect(block).toContain("Findings를 먼저 쓴다")
    expect(block).toContain("파일/라인/증거/영향")
    expect(block).toContain("수정은 사용자가 명시적으로 요청할 때만")
    expect(block).toContain("generated app product quality 보증이 아니다")
  })
})
