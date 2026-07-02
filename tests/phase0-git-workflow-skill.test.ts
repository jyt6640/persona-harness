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
    expect(block).toContain("Intent classification: git work request.")
    expect(block).toContain("git status")
    expect(block).toContain("Inspect the diff")
    expect(block).toContain("Stage only relevant files")
    expect(block).toContain("atomic commit")
    expect(block).toContain("Push only when the user explicitly requested a push")
    expect(block).toContain("This is not implementation/debug/refactor work")
  })
})
