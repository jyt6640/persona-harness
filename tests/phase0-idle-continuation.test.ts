import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { IdleContinuationClient, IdlePromptAsyncOptions } from "../src/runtime/idle-continuation.js"

const tempProjects: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-idle-continuation-test-"))
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

function fakeClient(calls: IdlePromptAsyncOptions[]): IdleContinuationClient {
  return {
    session: {
      promptAsync: (options) => {
        calls.push(options)
      },
    },
  }
}

function deferredClient(calls: IdlePromptAsyncOptions[]): {
  readonly client: IdleContinuationClient
  readonly resolve: () => void
} {
  let resolvePrompt: (() => void) | undefined
  return {
    client: {
      session: {
        promptAsync: (options) => {
          calls.push(options)
          return new Promise<void>((resolve) => {
            resolvePrompt = resolve
          })
        },
      },
    },
    resolve: () => {
      resolvePrompt?.()
    },
  }
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("Phase 0 idle continuation hook", () => {
  it("does nothing by default even when closure blockers remain", async () => {
    const projectDir = createProject()
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: { properties: { sessionID: "session-idle-default" }, type: "session.idle" } })

    expect(calls).toEqual([])
  })

  it("sends one bounded continuation prompt for the first closure blocker when enabled", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enforce: { idleContinuation: true } })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: { properties: { sessionID: "session-idle-enabled" }, type: "session.idle" } })
    await hooks.event?.({ event: { properties: { sessionID: "session-idle-enabled" }, type: "session.idle" } })

    expect(calls).toHaveLength(1)
    expect(calls[0]).toMatchObject({
      path: { id: "session-idle-enabled" },
      query: { directory: projectDir },
      body: { noReply: false },
    })
    expect(calls[0]?.body.parts[0]?.text).toContain("[Persona Harness Idle Continuation]")
    expect(calls[0]?.body.parts[0]?.text).toContain("Blocker: verification-unknown")
    expect(calls[0]?.body.parts[0]?.text).toContain("npx ph workflow continue")
    expect(calls[0]?.body.parts[0]?.text).toContain("not a hard stop")
  })

  it("does not send duplicate prompts while a continuation is in flight", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enforce: { idleContinuation: true } })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const fake = deferredClient(calls)
    const hooks = createPhase0Hooks({ client: fake.client, projectDir })

    const first = hooks.event?.({ event: { properties: { sessionID: "session-idle-in-flight" }, type: "session.idle" } })
    await hooks.event?.({ event: { properties: { sessionID: "session-idle-in-flight" }, type: "session.idle" } })
    fake.resolve()
    await first

    expect(calls).toHaveLength(1)
  })

  it("ignores non-idle events", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enforce: { idleContinuation: true } })
    writeBlockedWorkflow(projectDir)
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir })

    await hooks.event?.({ event: { properties: {}, type: "server.connected" } })

    expect(calls).toEqual([])
  })
})
