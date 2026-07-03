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

function writeRalphLoopConfig(projectDir: string, extra: Record<string, unknown> = {}): void {
  writeHarnessConfig(projectDir, {
    enforce: {
      idleContinuation: true,
      ralphLoop: { cooldownMs: 0, enabled: true, maxAttempts: 3 },
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

    await hooks.event?.({ event: { properties: { sessionID: "session-default" }, type: "session.idle" } })

    expect(calls).toEqual([])
    expect(existsSync(ralphLoopStatePath(projectDir))).toBe(false)
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

    await createPhase0Hooks({ client: fakeClient(calls), projectDir }).event?.({
      event: { properties: { sessionID: "session-restart" }, type: "session.idle" },
    })
    await createPhase0Hooks({ client: fakeClient(calls), projectDir }).event?.({
      event: { properties: { sessionID: "session-restart" }, type: "session.idle" },
    })
    await createPhase0Hooks({ client: fakeClient(calls), projectDir }).event?.({
      event: { properties: { sessionID: "session-restart" }, type: "session.idle" },
    })
    await createPhase0Hooks({ client: fakeClient(calls), projectDir }).event?.({
      event: { properties: { sessionID: "session-restart" }, type: "session.idle" },
    })

    expect(calls).toHaveLength(3)
    expect(calls[0]?.body.parts[0]?.text).toContain("[Persona Harness Ralph Loop]")
    expect(calls[1]?.body.parts[0]?.text).toContain("[Persona Harness Ralph Loop]")
    expect(calls[2]?.body.parts[0]?.text).toContain("Retry cap reached")
    const sessionState = readRalphLoopState(projectDir).sessions["session-restart"]
    expect(sessionState).toMatchObject({ attemptsUsed: 2, capped: true, capSummaryNotified: true })
  })

  it("tracks blocker-specific attempts while preserving the session cap", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir, { enforce: { ralphLoop: { cooldownMs: 0, enabled: true, maxAttempts: 2 } } })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: { properties: { sessionID: "session-blocker-change" }, type: "session.idle" } })
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew test\nBUILD SUCCESSFUL\ngradlew build\nBUILD SUCCESSFUL")
    await hooks.event?.({ event: { properties: { sessionID: "session-blocker-change" }, type: "session.idle" } })

    const sessionState = readRalphLoopState(projectDir).sessions["session-blocker-change"]
    expect(calls).toHaveLength(2)
    expect(sessionState?.attemptsUsed).toBe(2)
    expect(sessionState?.blockerAttempts["verification-unknown"]?.attempts).toBe(1)
    expect(sessionState?.blockerAttempts["implementation-report-missing"]?.attempts).toBe(1)
    expect(sessionState?.capped).toBe(true)
  })

  it("stops when closure blockers are exhausted", async () => {
    const projectDir = createProject()
    writeRalphLoopConfig(projectDir)
    writePassableWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

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

    await hooks.event?.({ event: { properties: { sessionID: "session-mutual-exclusion" }, type: "session.idle" } })

    expect(calls).toHaveLength(1)
    expect(calls[0]?.body.parts[0]?.text).toContain("[Persona Harness Ralph Loop]")
    expect(calls[0]?.body.parts[0]?.text).not.toContain("[Persona Harness Idle Continuation]")
  })
})
