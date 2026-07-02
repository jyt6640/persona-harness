import { describe, expect, it } from "vitest"

import {
  loadWorkflowSkillBlock,
  workflowSkillPath,
} from "../src/runtime/workflow-skill-loader.js"

describe("workflow skill loader", () => {
  it("loads runtime blocks from PH-owned workflow skill files", () => {
    const block = loadWorkflowSkillBlock("debug", "default", {
      detectedIntent: "debug",
      secondaryIntents: "programming",
      reason: "Failure signal detected.",
    })

    expect(workflowSkillPath("debug")).toBe("packages/shared-skills/skills/workflow/debug/SKILL.md")
    expect(block).toContain("[Persona Harness Debug Workflow]")
    expect(block).toContain("Detected intent: debug")
    expect(block).toContain("Secondary intents: programming")
    expect(block).toContain("Reason: Failure signal detected.")
    expect(block).toContain("Form at least three hypotheses")
  })

  it("loads requirements file workflow blocks with source-file placeholders", () => {
    const block = loadWorkflowSkillBlock("requirements", "file", {
      detectedIntent: "requirement-implementation",
      selectedSkillPath: workflowSkillPath("requirements"),
      reason: "README implementation request.",
      sourceFile: "README.md",
    })

    expect(block).toContain("[Persona Harness Requirements Workflow]")
    expect(block).toContain("Selected skill: workflow-requirements")
    expect(block).toContain("Requirements file: `README.md`")
    expect(block).toContain("npx ph workflow split README.md")
    expect(block).toContain("bounded subset/current ticket")
    expect(block).toContain("leave remaining tickets pending for continuation")
    expect(block).toContain("do not claim the whole backlog")
    expect(block).toContain("npx ph plan --report-filled implementation")
    expect(block).toContain("npx ph plan --report-filled review")
    expect(block).toContain("npx ph workflow check")
    expect(block).toContain("Do not archive req tickets until review confirms requirements are satisfied.")
    expect(block).toContain("bounded bootRun/manual QA")
    expect(block).toContain("stop the app")
    expect(block).toContain("observed result")
    expect(block).toContain("verification limitation/blocker")
    expect(block).toContain("instead of looping")
    expect(block).toContain("npx ph workflow finish implement")
  })

  it("loads the programming fallback workflow block", () => {
    const block = loadWorkflowSkillBlock("programming", "default", {
      detectedIntent: "programming",
      secondaryIntents: "none",
      reason: "Direct code creation or edit request detected.",
    })

    expect(workflowSkillPath("programming")).toBe(
      "packages/shared-skills/skills/workflow/programming/SKILL.md",
    )
    expect(block).toContain("[Persona Harness Programming Workflow]")
    expect(block).toContain("Intent classification: direct programming request.")
    expect(block).toContain("Read the relevant files first")
  })
})
