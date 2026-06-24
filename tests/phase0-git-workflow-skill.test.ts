import { describe, expect, it } from "vitest"

import { formatGitWorkflowBlock } from "../src/runtime/git-workflow-skill.js"
import { detectTopLevelIntent } from "../src/runtime/top-level-intent-router.js"

describe("formatGitWorkflowBlock", () => {
  it("renders the required git rail discipline", () => {
    const intent = detectTopLevelIntent("커밋하고 푸쉬해")

    if (intent === undefined) {
      throw new Error("expected git intent")
    }

    const block = formatGitWorkflowBlock(intent)

    expect(block).toContain("[Persona Harness Git Workflow]")
    expect(block).toContain("Detected intent: git")
    expect(block).toContain("의도 감지: git 작업 요청으로 판단함.")
    expect(block).toContain("git status")
    expect(block).toContain("diff를 확인한다")
    expect(block).toContain("관련 파일만 stage")
    expect(block).toContain("atomic commit")
    expect(block).toContain("push는 사용자가 명시적으로 요청한 경우에만")
    expect(block).toContain("구현/debug/refactor rail이 아니다")
  })
})
