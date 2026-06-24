import { describe, expect, it } from "vitest"

import { formatDebugWorkflowBlock } from "../src/runtime/debug-workflow-skill.js"
import { detectTopLevelIntent } from "../src/runtime/top-level-intent-router.js"

describe("formatDebugWorkflowBlock", () => {
  it("renders the required debug rail discipline", () => {
    const intent = detectTopLevelIntent("왜 gradle build가 실패하지? 고쳐줘")

    if (intent === undefined) {
      throw new Error("expected debug intent")
    }

    const block = formatDebugWorkflowBlock(intent)

    expect(block).toContain("[Persona Harness Debug Workflow]")
    expect(block).toContain("Detected intent: debug")
    expect(block).toContain("의도 감지: 디버그 요청으로 판단함.")
    expect(block).toContain("실패를 먼저 재현한다")
    expect(block).toContain("최소 3개 가설")
    expect(block).toContain("evidence")
    expect(block).toContain("확인된 원인만 수정한다")
    expect(block).toContain("테스트/빌드/스모크")
    expect(block).toContain("generated app product quality 보증이 아니다")
  })
})
