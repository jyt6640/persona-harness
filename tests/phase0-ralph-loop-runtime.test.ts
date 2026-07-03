import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Event } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { IdleContinuationClient, IdlePromptAsyncOptions } from "../src/runtime/idle-continuation.js"
import { readRalphLoopState, ralphLoopStatePath } from "../src/runtime/ralph-loop-state.js"

const tempProjects: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-ralph-loop-runtime-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeHarnessConfig(projectDir: string, config: Record<string, unknown>): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify(config, null, 2)}\n`)
}

function writeBlockedWorkflow(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
}

function writeStructuredVerificationEvidence(projectDir: string, status: number, text: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({ command: "npx ph bearshell ./gradlew test", status, tool: "bearshell", toolOutput: text }, null, 2)}\n`,
  )
}

function writeFilledReports(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    ["Status: filled", "- README ranges read: all", "- Project profile ranges read: all", "- `npx ph bearshell ./gradlew test`", "BUILD SUCCESSFUL"].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    ["Status: filled", "- `npx ph bearshell ./gradlew bootRun`", "Tomcat started on port 8080"].join("\n"),
  )
}

function writePassableWorkflow(projectDir: string): void {
  writeBlockedWorkflow(projectDir)
  writeStructuredVerificationEvidence(
    projectDir,
    0,
    "gradlew test\nBUILD SUCCESSFUL\ngradlew build\nBUILD SUCCESSFUL\nTomcat started on port 8080",
  )
  writeFilledReports(projectDir)
}

function fillImplementationReport(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    ["Status: filled", "- `npx ph bearshell ./gradlew test`", "BUILD SUCCESSFUL"].join("\n"),
  )
}

function fillReviewReport(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    ["Status: filled", "- `npx ph bearshell ./gradlew bootRun`", "Tomcat started on port 8080"].join("\n"),
  )
}

function writeRalphLoopConfig(projectDir: string, extra: Record<string, unknown> = {}): void {
  writeHarnessConfig(projectDir, {
    enforce: {
      idleContinuation: true,
      ralphLoop: { cooldownMs: 0, enabled: true, maxAttempts: 3, maxSessionAttempts: 9 },
    },
    ...extra,
  })
}

function fakeClient(calls: IdlePromptAsyncOptions[]): IdleContinuationClient {
  return {
    session: {
      promptAsync: (options) => {
        calls.push(options)
      },
    },
  }
}

function sessionEvent(projectDir: string, type: "session.created" | "session.updated", sessionID: string, parentID?: string): Event {
  const base = {
    directory: projectDir,
    id: sessionID,
    projectID: "project",
    time: { created: 1, updated: 1 },
    title: sessionID,
    version: "1",
  }
  const info = parentID === undefined ? base : { ...base, parentID }
  return { properties: { info }, type }
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("Phase 0 ralph-loop runtime continuation", () => {
  it("does nothing by default and does not write state", async () => {
    const projectDir = createProject()
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })
    const output = {
      metadata: {},
      output: "Workflow finish failed: implement\nClosure blocker: verification-unknown",
      title: "finish",
    }

    await hooks.event?.({ event: { properties: { sessionID: "session-default" }, type: "session.idle" } })
    await hooks["tool.execute.after"]?.(
      {
        args: { command: "npx ph workflow finish implement" },
        callID: "call-default",
        sessionID: "session-default",
        tool: "bash",
      },
      output,
    )

    expect(calls).toEqual([])
    expect(output.output).not.toContain("[Persona Harness Ralph Loop Tool Continuation]")
    expect(existsSync(ralphLoopStatePath(projectDir))).toBe(false)
  })

  it("appends tool-output ralph-loop continuation for eligible PH blocker output", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, {
      enforce: {
        ralphLoop: { cooldownMs: 0, enabled: true, maxAttempts: 3, maxSessionAttempts: 9, toolOutputTrigger: true },
      },
    })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })
    const output = {
      metadata: {},
      output: "Workflow finish failed: implement\n\nRequired fixes:\n- Closure blocker: verification-unknown",
      title: "finish",
    }

    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-tool-output") })
    await hooks["tool.execute.after"]?.(
      {
        args: { command: "npx ph workflow finish implement" },
        callID: "call-tool-output",
        sessionID: "session-tool-output",
        tool: "bash",
      },
      output,
    )
    await hooks.event?.({ event: { properties: { sessionID: "session-tool-output" }, type: "session.idle" } })

    expect(output.output).toContain("[Persona Harness Ralph Loop Tool Continuation]")
    expect(output.output).toContain("[Persona Harness Ralph Loop]")
    expect(output.output).toContain("Closure blockers remain; do not claim completion.")
    expect(readRalphLoopState(projectDir).sessions["session-tool-output"]?.attemptsUsed).toBe(1)
    expect(calls).toEqual([])
  })

  it("does not append tool-output continuation to arbitrary tool output", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, {
      enforce: {
        ralphLoop: { cooldownMs: 0, enabled: true, maxAttempts: 3, maxSessionAttempts: 9, toolOutputTrigger: true },
      },
    })
    writeBlockedWorkflow(projectDir)
    const hooks = createPhase0Hooks({ projectDir })
    const output = {
      metadata: {},
      output: "Workflow finish failed: implement\nClosure blocker: verification-unknown",
      title: "not finish",
    }

    await hooks["tool.execute.after"]?.(
      {
        args: { command: "npm test" },
        callID: "call-arbitrary-output",
        sessionID: "session-arbitrary-output",
        tool: "bash",
      },
      output,
    )

    expect(output.output).not.toContain("[Persona Harness Ralph Loop Tool Continuation]")
    expect(readRalphLoopState(projectDir).sessions["session-arbitrary-output"]).toBeUndefined()
    expect(
      existsSync(join(projectDir, ".persona", "evidence", "session-injection-skips", "session-arbitrary-output.json")),
    ).toBe(false)
  })

  it("fails closed for subagent and unknown tool-output continuation sessions", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, {
      enforce: {
        ralphLoop: { cooldownMs: 0, enabled: true, maxAttempts: 3, maxSessionAttempts: 9, toolOutputTrigger: true },
      },
      multiAgent: { enabled: false },
    })
    writeBlockedWorkflow(projectDir)
    const hooks = createPhase0Hooks({ projectDir })
    const subagentOutput = {
      metadata: {},
      output: "Workflow finish failed: implement\nClosure blocker: verification-unknown",
      title: "subagent finish",
    }
    const unknownOutput = {
      metadata: {},
      output: "Workflow finish failed: implement\nClosure blocker: verification-unknown",
      title: "unknown finish",
    }

    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-subagent-tool", "session-main") })
    await hooks["tool.execute.after"]?.(
      {
        args: { command: "npx ph workflow finish implement" },
        callID: "call-subagent-tool",
        sessionID: "session-subagent-tool",
        tool: "bash",
      },
      subagentOutput,
    )
    await hooks["tool.execute.after"]?.(
      {
        args: { command: "npx ph workflow finish implement" },
        callID: "call-unknown-tool",
        sessionID: "session-unknown-tool",
        tool: "bash",
      },
      unknownOutput,
    )

    expect(subagentOutput.output).not.toContain("[Persona Harness Ralph Loop Tool Continuation]")
    expect(unknownOutput.output).not.toContain("[Persona Harness Ralph Loop Tool Continuation]")
    expect(readRalphLoopState(projectDir).sessions["session-subagent-tool"]).toBeUndefined()
    expect(readRalphLoopState(projectDir).sessions["session-unknown-tool"]).toBeUndefined()
  })

  it("emits ralph-loop continuation only for classified main sessions when multi-agent is enabled", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, { multiAgent: { enabled: true } })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-subagent", "session-main") })
    await hooks.event?.({ event: { properties: { sessionID: "session-subagent" }, type: "session.idle" } })
    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-main") })
    await hooks.event?.({ event: { properties: { sessionID: "session-main" }, type: "session.idle" } })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.path.id).toBe("session-main")
    expect(calls[0]?.body.parts[0]?.text).toContain("[Persona Harness Ralph Loop]")
    expect(readRalphLoopState(projectDir).sessions["session-main"]?.attemptsUsed).toBe(1)
  })

  it("fails closed for unknown sessions when multi-agent is enabled", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, { multiAgent: { enabled: true } })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: { properties: { sessionID: "session-unknown" }, type: "session.idle" } })

    expect(calls).toEqual([])
    expect(readRalphLoopState(projectDir).sessions["session-unknown"]).toBeUndefined()
  })

  it("persists attempts across hook instances and sends one capped summary", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, { enforce: { ralphLoop: { cooldownMs: 0, enabled: true, maxAttempts: 2 } } })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    async function runFreshIdle(): Promise<void> {
      const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })
      await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-restart") })
      await hooks.event?.({ event: { properties: { sessionID: "session-restart" }, type: "session.idle" } })
    }

    await runFreshIdle()
    await runFreshIdle()
    await runFreshIdle()
    await runFreshIdle()

    expect(calls).toHaveLength(3)
    expect(calls[0]?.body.parts[0]?.text).toContain("[Persona Harness Ralph Loop]")
    expect(calls[1]?.body.parts[0]?.text).toContain("[Persona Harness Ralph Loop]")
    expect(calls[2]?.body.parts[0]?.text).toContain("Retry cap reached")
    const sessionState = readRalphLoopState(projectDir).sessions["session-restart"]
    expect(sessionState).toMatchObject({ attemptsUsed: 2, capped: true, capSummaryNotified: true })
  })

  it("does not cap prematurely across three resolved blockers", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir)
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-blocker-change") })
    await hooks.event?.({ event: { properties: { sessionID: "session-blocker-change" }, type: "session.idle" } })
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew test\nBUILD SUCCESSFUL\ngradlew build\nBUILD SUCCESSFUL")
    await hooks.event?.({ event: { properties: { sessionID: "session-blocker-change" }, type: "session.idle" } })
    fillImplementationReport(projectDir)
    await hooks.event?.({ event: { properties: { sessionID: "session-blocker-change" }, type: "session.idle" } })
    fillReviewReport(projectDir)
    await hooks.event?.({ event: { properties: { sessionID: "session-blocker-change" }, type: "session.idle" } })

    const sessionState = readRalphLoopState(projectDir).sessions["session-blocker-change"]
    expect(calls).toHaveLength(3)
    expect(sessionState?.attemptsUsed).toBe(3)
    expect(sessionState?.blockerAttempts["verification-unknown"]?.attempts).toBe(1)
    expect(sessionState?.blockerAttempts["implementation-report-missing"]?.attempts).toBe(1)
    expect(sessionState?.blockerAttempts["review-report-missing"]?.attempts).toBe(1)
    expect(sessionState?.capped).toBe(false)
    expect(sessionState?.lastStopReason).toBe("no-blockers")
  })

  it("caps a same-blocker session after the per-blocker retry budget and sends one summary", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir)
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    async function runFreshIdle(): Promise<void> {
      const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })
      await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-same-blocker") })
      await hooks.event?.({ event: { properties: { sessionID: "session-same-blocker" }, type: "session.idle" } })
    }

    for (let index = 0; index < 5; index += 1) {
      await runFreshIdle()
    }

    const sessionState = readRalphLoopState(projectDir).sessions["session-same-blocker"]
    expect(calls).toHaveLength(4)
    expect(calls.filter((call) => call.body.parts[0]?.text.includes("Retry cap reached"))).toHaveLength(1)
    expect(sessionState).toMatchObject({ attemptsUsed: 3, capped: true, capSummaryNotified: true })
    expect(sessionState?.blockerAttempts["verification-unknown"]?.attempts).toBe(3)
  })

  it("caps the whole session after maxSessionAttempts and sends one summary", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, {
      enforce: { ralphLoop: { cooldownMs: 0, enabled: true, maxAttempts: 3, maxSessionAttempts: 3 } },
    })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-session-cap") })
    await hooks.event?.({ event: { properties: { sessionID: "session-session-cap" }, type: "session.idle" } })
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew test\nBUILD SUCCESSFUL\ngradlew build\nBUILD SUCCESSFUL")
    await hooks.event?.({ event: { properties: { sessionID: "session-session-cap" }, type: "session.idle" } })
    fillImplementationReport(projectDir)
    await hooks.event?.({ event: { properties: { sessionID: "session-session-cap" }, type: "session.idle" } })
    await hooks.event?.({ event: { properties: { sessionID: "session-session-cap" }, type: "session.idle" } })

    const sessionState = readRalphLoopState(projectDir).sessions["session-session-cap"]
    expect(calls).toHaveLength(4)
    expect(calls.filter((call) => call.body.parts[0]?.text.includes("Retry cap reached"))).toHaveLength(1)
    expect(sessionState).toMatchObject({ attemptsUsed: 3, capped: true, capSummaryNotified: true })
  })

  it("stops when closure blockers are exhausted", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir)
    writePassableWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-pass") })
    await hooks.event?.({ event: { properties: { sessionID: "session-pass" }, type: "session.idle" } })

    expect(calls).toEqual([])
    expect(readRalphLoopState(projectDir).sessions["session-pass"]?.lastStopReason).toBe("no-blockers")
  })

  it("takes priority over ordinary idle continuation when enabled", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir)
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-mutual-exclusion") })
    await hooks.event?.({ event: { properties: { sessionID: "session-mutual-exclusion" }, type: "session.idle" } })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.body.parts[0]?.text).toContain("[Persona Harness Ralph Loop]")
    expect(calls[0]?.body.parts[0]?.text).not.toContain("[Persona Harness Idle Continuation]")
  })

  it("does not utter into known subagent or unknown sessions when multi-agent is disabled", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, { multiAgent: { enabled: false } })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-subagent-no-multi", "session-main") })
    await hooks.event?.({ event: { properties: { sessionID: "session-subagent-no-multi" }, type: "session.idle" } })
    await hooks.event?.({ event: { properties: { sessionID: "session-unknown-no-multi" }, type: "session.idle" } })

    expect(calls).toEqual([])
  })

  it("skips the first unknown idle and can utter after late main-session classification", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir)
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: { properties: { sessionID: "session-late-classified" }, type: "session.idle" } })
    await hooks.event?.({ event: sessionEvent(projectDir, "session.created", "session-late-classified") })
    await hooks.event?.({ event: { properties: { sessionID: "session-late-classified" }, type: "session.idle" } })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.path.id).toBe("session-late-classified")
  })
})
