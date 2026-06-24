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
    expect(block).toContain("의도 감지: 직접 프로그래밍 요청으로 판단함.")
    expect(block).toContain("관련 파일을 먼저 읽는다")
    expect(block).toContain("기존 프로젝트 구조와 naming을 따른다")
    expect(block).toContain("요청 범위를 벗어난 기능 추가")
    expect(block).toContain("검증하지 못한 항목은 완료처럼 말하지 않는다")
    expect(block).toContain("requirements/debug/review/refactor/git rail을 대체하지 않는다")
  })
})
