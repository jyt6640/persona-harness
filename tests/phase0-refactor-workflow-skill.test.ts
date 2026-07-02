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
    expect(block).toContain("Intent classification: refactor request.")
    expect(block).toContain("lock current public behavior first")
    expect(block).toContain("Do not add features")
    expect(block).toContain("small structural change")
    expect(block).toContain("rerun the same test/build/smoke command")
    expect(block).toContain("This is not the implementation/debug rail")
  })
})
