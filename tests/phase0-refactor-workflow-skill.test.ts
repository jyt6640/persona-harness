import { describe, expect, it } from "vitest"

import { formatRefactorWorkflowBlock } from "../src/runtime/refactor-workflow-skill.js"
import { detectTopLevelIntent } from "../src/runtime/top-level-intent-router.js"

describe("formatRefactorWorkflowBlock", () => {
  it("renders the required refactor rail discipline", () => {
    const intent = detectTopLevelIntent("구조 정리해줘")

    if (intent === undefined) {
      throw new Error("expected refactor intent")
    }

    const block = formatRefactorWorkflowBlock(intent)

    expect(block).toContain("[Persona Harness Refactor Workflow]")
    expect(block).toContain("Detected intent: refactor")
    expect(block).toContain("의도 감지: 리팩터링 요청으로 판단함.")
    expect(block).toContain("public behavior를 먼저 고정한다")
    expect(block).toContain("기능을 추가하지 않는다")
    expect(block).toContain("작은 구조 변경")
    expect(block).toContain("같은 테스트/빌드/스모크")
    expect(block).toContain("implementation/debug rail이 아니다")
  })
})
