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
    expect(block).toContain("Intent classification: debug request.")
    expect(block).toContain("Reproduce the failure first")
    expect(block).toContain("Form at least three hypotheses")
    expect(block).toContain("evidence")
    expect(block).toContain("Fix only the confirmed cause")
    expect(block).toContain("Rerun relevant tests/build/smoke")
    expect(block).toContain("This is not generated app product-quality certification")
  })
})
