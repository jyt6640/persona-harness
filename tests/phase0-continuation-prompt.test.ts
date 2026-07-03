import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { continuationPromptCoreLines, createContinuationPromptLines } from "../src/cli/continuation-prompt.js"
import { workflowClosureRailLines } from "../src/cli/workflow-closure-rail.js"
import { readWorkflowClosurePayload } from "../src/cli/workflow-closure.js"
import { runPersonaCli } from "../src/cli/index.js"
import { ContinuationUtteranceGate } from "../src/runtime/continuation-utterance-gate.js"

const tempProjects: string[] = []

function createBlockedProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-continuation-prompt-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  return projectDir
}

function promptLinesFrom(value: unknown): readonly string[] {
  if (typeof value !== "object" || value === null || !("promptLines" in value)) {
    return []
  }
  const promptLines = value.promptLines
  return Array.isArray(promptLines) && promptLines.every((line) => typeof line === "string") ? promptLines : []
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("shared continuation prompt body", () => {
  it("keeps workflow continue, closure next, idle, and ralph-loop on the same core blocker prompt", () => {
    const projectDir = createBlockedProject()
    const closure = readWorkflowClosurePayload("next", projectDir)
    const blocker = closure.state.blockers[0]
    if (blocker === undefined) {
      throw new Error("Expected a closure blocker fixture")
    }
    const step = closure.action === "next" ? closure.nextStep : null
    const core = continuationPromptCoreLines(blocker, step)

    const continueLines = workflowClosureRailLines(closure, "cli-continue")
    const closureNextLines = workflowClosureRailLines(closure, "closure-next")
    const idleLines = createContinuationPromptLines({ blocker, context: "idle", step })
    const ralph = runPersonaCli(["workflow", "ralph-loop", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const ralphPayload: unknown = JSON.parse(ralph.stdout)
    const ralphLines = promptLinesFrom(ralphPayload)

    for (const line of core) {
      expect(continueLines.join("\n")).toContain(line)
      expect(closureNextLines.join("\n")).toContain(line)
      expect(idleLines).toContain(line)
      expect(ralphLines).toContain(line)
    }
    expect(continueLines.join("\n")).toContain("[Persona Harness Closure Continuation]")
    expect(closureNextLines.join("\n")).toContain("[Persona Harness Closure Next]")
    expect(idleLines).toContain("[Persona Harness Idle Continuation]")
    expect(ralphLines).toContain("[Persona Harness Ralph Loop]")
  })
})

describe("ContinuationUtteranceGate", () => {
  it("blocks duplicate in-flight and consecutive same-blocker utterances", () => {
    const gate = new ContinuationUtteranceGate()
    const first = gate.tryBegin({ blockerId: "verification-unknown", maxAttempts: 3, sessionId: "session-1" })
    expect(first.kind).toBe("allowed")
    expect(gate.tryBegin({ blockerId: "verification-failed", maxAttempts: 3, sessionId: "session-1" })).toEqual({
      kind: "blocked",
      reason: "in-flight",
    })
    if (first.kind === "allowed") {
      first.complete()
    }
    expect(gate.tryBegin({ blockerId: "verification-unknown", maxAttempts: 3, sessionId: "session-1" })).toEqual({
      kind: "blocked",
      reason: "same-blocker",
    })
  })

  it("resets completed session state when blockers clear", () => {
    const gate = new ContinuationUtteranceGate()
    const first = gate.tryBegin({ blockerId: "verification-unknown", maxAttempts: 1, sessionId: "session-2" })
    expect(first.kind).toBe("allowed")
    if (first.kind === "allowed") {
      first.complete()
    }

    gate.reset("session-2")

    expect(gate.tryBegin({ blockerId: "verification-unknown", maxAttempts: 1, sessionId: "session-2" }).kind).toBe(
      "allowed",
    )
  })

  it("allows explicit same-blocker retry mode for retry-capped ralph-loop", () => {
    const gate = new ContinuationUtteranceGate()
    const first = gate.tryBegin({
      allowSameBlockerRetry: true,
      blockerId: "verification-unknown",
      maxAttempts: 2,
      sessionId: "session-3",
    })
    expect(first.kind).toBe("allowed")
    if (first.kind === "allowed") {
      first.complete()
    }

    const second = gate.tryBegin({
      allowSameBlockerRetry: true,
      blockerId: "verification-unknown",
      maxAttempts: 2,
      sessionId: "session-3",
    })
    expect(second.kind).toBe("allowed")
    if (second.kind === "allowed") {
      second.complete()
    }
    expect(gate.tryBegin({ allowSameBlockerRetry: true, blockerId: "verification-unknown", maxAttempts: 2, sessionId: "session-3" })).toEqual({
      kind: "blocked",
      reason: "retry-cap-reached",
    })
  })
})
