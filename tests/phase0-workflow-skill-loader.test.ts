import { describe, expect, it } from "vitest"

import {
  loadWorkflowSkillBlock,
  workflowSkillPath,
} from "../src/runtime/workflow-skill-loader.js"

describe("OpenCode workflow skill adapter", () => {
  it("renders an advisory debug route from the Persona-owned core catalog", () => {
    const block = loadWorkflowSkillBlock("debug", "default", {
      detectedIntent: "debug",
      secondaryIntents: "programming",
      reason: "Failure signal detected.",
    })

    expect(workflowSkillPath("debug")).toBe("packages/shared-skills/skills/debug/SKILL.md")
    expect(block).toContain("[Persona Harness Debug Workflow]")
    expect(block).toContain("Detected intent: debug")
    expect(block).toContain("Secondary intents: programming")
    expect(block).toContain("Reason: Failure signal detected.")
    expect(block).toContain("Form at least three hypotheses")
    expect(block).toContain("Skill: debug")
    expect(block).toContain("does not create plans, tickets, branches, files, agents, or workflow state")
    expect(block).not.toContain("npx ph workflow")
  })

  it("routes requirements files to planning without injecting a command rail", () => {
    const block = loadWorkflowSkillBlock("requirements", "file", {
      detectedIntent: "requirement-implementation",
      reason: "README implementation request.",
      sourceFile: "README.md",
    })

    expect(block).toContain("[Persona Harness Requirements Workflow]")
    expect(block).toContain("Source context: README.md")
    expect(block).toContain("Skill: plan")
    expect(block).toContain("Handoff: ralplan")
    expect(block).toContain("The next handoff is explicit")
    expect(block).not.toContain("npx ph workflow")
  })

  it("routes programming to an advisory core skill", () => {
    const block = loadWorkflowSkillBlock("programming", "default", {
      detectedIntent: "programming",
      secondaryIntents: "none",
      reason: "Direct code creation or edit request detected.",
    })

    expect(workflowSkillPath("programming")).toBe("packages/shared-skills/skills/programming/SKILL.md")
    expect(block).toContain("[Persona Harness Programming Workflow]")
    expect(block).toContain("Intent classification: direct programming request.")
    expect(block).toContain("Read the relevant files first")
    expect(block).toContain("Skill: programming")
    expect(block).not.toContain("npx ph workflow")
  })
})
