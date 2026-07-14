import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createContinuationPromptLines } from "../src/cli/continuation-prompt.js"
import type { ClosureBlocker, ClosureStep, ClosureTicket } from "../src/cli/workflow-closure.js"
import { relayPromptLinesFor } from "../src/cli/workflow-relay-ui.js"
import type { HarnessRalphLoopConfig } from "../src/config/harness-config.js"
import { RalphLoopToolOutputContinuationTracker } from "../src/runtime/ralph-loop-tool-output.js"

const tempProjects: string[] = []

const BLOCKER: ClosureBlocker = {
  id: "verification-unknown",
  reason: "no structured execution evidence observed",
  source: ".persona/evidence",
}

const STEP: ClosureStep = {
  command: "npx ph workflow check",
  id: "workflow-check",
  kind: "cli-command",
  status: "pending",
}

const TICKET: ClosureTicket = {
  id: "req-1",
  path: ".persona/workflow/work/req-1/00-task-card.md",
  reviewArchiveCandidate: false,
  state: "active-work",
  technicalSignals: [],
  title: "Prompt regression fixture",
}

const RALPH_LOOP_CONFIG: HarnessRalphLoopConfig = {
  cooldownMs: 0,
  enabled: true,
  maxAttempts: 3,
  maxSessionAttempts: 9,
  toolOutputTrigger: true,
}

function createBlockedProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-prompt-regression-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  return projectDir
}

function assertNoBroadClaims(text: string): void {
  expect(text).not.toMatch(/\bguarantees?\b/i)
  expect(text).not.toMatch(/\breliable automatic\b/i)
  expect(text).not.toMatch(/\bproduction-ready delegation\b/i)
  expect(text).not.toMatch(/\btoken-saving\b/i)
  expect(text).not.toMatch(/\bproduct-efficacy\b/i)
  expect(text).not.toMatch(/\bapp-quality\b/i)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("prompt regression fixture", () => {
  it("keeps Role Checklist Relay as the primary relay framing with optional host subagents", () => {
    const prompt = relayPromptLinesFor("test-writer", TICKET, ".persona/workflow/work/req-1/roles/test-writer.md").join(
      "\n",
    )

    expect(prompt).toContain("PH Role Checklist Relay is a main-session role checklist rail")
    expect(prompt).toContain("host subagents are optional workers when available")
    expect(prompt).toContain("When the host exposes subagent/task invocation")
    expect(prompt).toContain("invoke the `test-writer` subagent via the task tool")
    expect(prompt).toContain("If host subagent invocation is unavailable or not taken")
    expect(prompt).toContain("complete this role checklist in the main session")
    expect(prompt).toContain("Record whether subagent invocation was used or unavailable")
    assertNoBroadClaims(prompt)
  })

  it("keeps ralph-loop blocker-depth wording retry-capped and non-autonomous", () => {
    const prompt = createContinuationPromptLines({
      blocker: BLOCKER,
      context: "ralph-loop",
      depth: { index: 1, total: 6 },
      step: STEP,
    }).join("\n")

    expect(prompt).toContain("[Persona Harness Ralph Loop]")
    expect(prompt).toContain("Closure blockers remain; do not claim completion.")
    expect(prompt).toContain("Blocker: verification-unknown (blocker 1/6)")
    expect(prompt).toContain("Next command: npx ph workflow check")
    expect(prompt).toContain("default-off, retry-capped continuation preview")
    expect(prompt).toContain("not a success guarantee or autonomous loop")
    expect(prompt).not.toContain("app quality")
    expect(prompt).not.toContain("completion guaranteed")
  })

  it("keeps tool-output ralph-loop delivery marker and blocker-depth prompt together", () => {
    const projectDir = createBlockedProject()
    const tracker = new RalphLoopToolOutputContinuationTracker({
      config: RALPH_LOOP_CONFIG,
      now: () => new Date("2026-07-04T00:00:00.000Z"),
      projectDir,
    })

    const result = tracker.appendIfEligible({
      args: { command: "npx ph workflow finish implement" },
      output: "Workflow finish failed: implement\nClosure blocker: verification-unknown",
      sessionID: "session-prompt-regression",
      tool: "bash",
    })

    expect(result.kind).toBe("appended")
    if (result.kind === "appended") {
      expect(result.output).toContain("[Persona Harness Ralph Loop Tool Continuation]")
      expect(result.output).toContain("[Persona Harness Ralph Loop]")
      expect(result.output).toContain("Blocker: verification-unknown (blocker 1/")
      expect(result.output).toContain("Fix only this blocker, then rerun `npx ph workflow finish implement`.")
      expect(result.output).toContain("not a success guarantee or autonomous loop")
      expect(result.output).not.toContain("token-saving")
      expect(result.output).not.toContain("product-efficacy")
    }
  })
})
