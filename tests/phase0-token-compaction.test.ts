import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { AssistantMessage, Model } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { TokenCompactionSummarizeOptions } from "../src/runtime/token-compaction.js"
import type { TransformSystemOutput } from "../src/runtime/types.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

function assistantMessage(tokens: AssistantMessage["tokens"]): AssistantMessage {
  return {
    id: "msg-assistant-1",
    sessionID: "session-token-compaction",
    role: "assistant",
    time: { created: 1, completed: 2 },
    parentID: "msg-user-1",
    modelID: "gpt-test",
    providerID: "openai",
    mode: "primary",
    path: { cwd: "/tmp/persona-project", root: "/tmp/persona-project" },
    cost: 0,
    tokens,
  }
}

function modelWithContextLimit(context: number): Model {
  return {
    id: "gpt-test",
    providerID: "openai",
    api: { id: "openai", url: "https://example.invalid", npm: "@ai-sdk/openai" },
    name: "GPT Test",
    capabilities: {
      temperature: true,
      reasoning: true,
      attachment: false,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    limit: { context, output: 4096 },
    status: "active",
    options: {},
    headers: {},
  }
}

function highRatioMessage(): AssistantMessage {
  return assistantMessage({
    input: 80,
    output: 4,
    reasoning: 0,
    cache: { read: 0, write: 0 },
  })
}

function lowRatioMessage(): AssistantMessage {
  return assistantMessage({
    input: 10,
    output: 4,
    reasoning: 0,
    cache: { read: 0, write: 0 },
  })
}

function compactionEvidence(projectDir: string): Record<string, unknown> {
  const path = join(projectDir, ".persona", "evidence", "compaction", "session-token-compaction.json")
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`expected compaction evidence object at ${path}`)
  }
  return parsed as Record<string, unknown>
}

function evidenceAttempts(projectDir: string): readonly Record<string, unknown>[] {
  const evidence = compactionEvidence(projectDir)
  if (!Array.isArray(evidence.attempts)) {
    throw new Error("expected compaction attempts")
  }
  return evidence.attempts.filter((attempt): attempt is Record<string, unknown> => {
    return typeof attempt === "object" && attempt !== null && !Array.isArray(attempt)
  })
}

class BoundSummarizeSession {
  readonly calls: TokenCompactionSummarizeOptions[] = []

  promptAsync(): undefined {
    return undefined
  }

  summarize(options: TokenCompactionSummarizeOptions): true {
    this.calls.push(options)
    return true
  }
}

async function sendMessageUpdated(projectDir: string, message: AssistantMessage): Promise<readonly TokenCompactionSummarizeOptions[]> {
  const summarizeCalls: TokenCompactionSummarizeOptions[] = []
  const hooks = createPhase0Hooks({
    client: {
      session: {
        promptAsync: () => undefined,
        summarize: (options: TokenCompactionSummarizeOptions) => {
          summarizeCalls.push(options)
          return true
        },
      },
    },
    projectDir,
  })
  const output: TransformSystemOutput = { system: [] }
  await hooks["experimental.chat.system.transform"]?.(
    { sessionID: message.sessionID, model: modelWithContextLimit(100) },
    output,
  )
  await hooks.event?.({ event: { type: "message.updated", properties: { info: message } } })
  return summarizeCalls
}

describe("Phase 0 token compaction", () => {
  it("does not summarize or write compaction evidence by default", async () => {
    const projectDir = createProject()

    const summarizeCalls = await sendMessageUpdated(projectDir, highRatioMessage())

    expect(summarizeCalls).toHaveLength(0)
    expect(existsSync(join(projectDir, ".persona", "evidence", "compaction", "session-token-compaction.json"))).toBe(
      false,
    )
  })

  it("summarizes once when enabled and token ratio crosses the threshold", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enforce: { compaction: { enabled: true, threshold: 0.78 } } })

    const summarizeCalls = await sendMessageUpdated(projectDir, highRatioMessage())

    expect(summarizeCalls).toEqual([
      {
        body: { modelID: "gpt-test", providerID: "openai" },
        path: { id: "session-token-compaction" },
        query: { directory: "/tmp/persona-project" },
      },
    ])
    expect(evidenceAttempts(projectDir)).toEqual([
      expect.objectContaining({
        afterMeasurement: expect.objectContaining({
          measured: false,
          reason: expect.stringContaining("no token-saving claim"),
        }),
        beforeMeasurement: expect.objectContaining({ measured: true, ratio: 0.8 }),
        status: "triggered",
      }),
    ])
  })

  it("calls summarize through the owning SDK session object", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { enforce: { compaction: { enabled: true, threshold: 0.78 } } })
    const session = new BoundSummarizeSession()
    const hooks = createPhase0Hooks({
      client: {
        session,
      },
      projectDir,
    })
    await hooks["experimental.chat.system.transform"]?.(
      { sessionID: "session-token-compaction", model: modelWithContextLimit(100) },
      { system: [] },
    )

    await hooks.event?.({ event: { type: "message.updated", properties: { info: highRatioMessage() } } })

    expect(session.calls).toHaveLength(1)
    expect(evidenceAttempts(projectDir)).toEqual([expect.objectContaining({ status: "triggered" })])
  })

  it("records skipped evidence when ratio is unknown or below threshold", async () => {
    const unknownProject = createProject()
    writeHarnessConfig(unknownProject, { enforce: { compaction: { enabled: true } } })
    const unknownHooks = createPhase0Hooks({ projectDir: unknownProject })
    await unknownHooks.event?.({ event: { type: "message.updated", properties: { info: highRatioMessage() } } })

    const lowProject = createProject()
    writeHarnessConfig(lowProject, { enforce: { compaction: { enabled: true, threshold: 0.78 } } })
    const lowCalls = await sendMessageUpdated(lowProject, lowRatioMessage())

    expect(evidenceAttempts(unknownProject)).toEqual([
      expect.objectContaining({
        beforeMeasurement: expect.objectContaining({ measured: false }),
        reason: "ratio-unavailable",
        status: "skipped",
      }),
    ])
    expect(lowCalls).toHaveLength(0)
    expect(evidenceAttempts(lowProject)).toEqual([
      expect.objectContaining({
        beforeMeasurement: expect.objectContaining({ measured: true, ratio: 0.1 }),
        reason: "below-threshold",
        status: "skipped",
      }),
    ])
  })

  it("does not summarize again while cooldown is active", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, {
      enforce: { compaction: { cooldownMs: 120_000, enabled: true, threshold: 0.78 } },
    })
    const summarizeCalls: TokenCompactionSummarizeOptions[] = []
    const hooks = createPhase0Hooks({
      client: {
        session: {
          promptAsync: () => undefined,
          summarize: (options: TokenCompactionSummarizeOptions) => {
            summarizeCalls.push(options)
            return true
          },
        },
      },
      projectDir,
    })
    await hooks["experimental.chat.system.transform"]?.(
      { sessionID: "session-token-compaction", model: modelWithContextLimit(100) },
      { system: [] },
    )

    await hooks.event?.({ event: { type: "message.updated", properties: { info: highRatioMessage() } } })
    await hooks.event?.({ event: { type: "message.updated", properties: { info: highRatioMessage() } } })

    expect(summarizeCalls).toHaveLength(1)
    expect(evidenceAttempts(projectDir)).toEqual([
      expect.objectContaining({ status: "triggered" }),
      expect.objectContaining({ reason: "cooldown-active", status: "skipped" }),
    ])
  })

  it("does not summarize again from a fresh hook instance while evidence cooldown is active", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, {
      enforce: { compaction: { cooldownMs: 120_000, enabled: true, threshold: 0.78 } },
    })
    const firstCalls = await sendMessageUpdated(projectDir, highRatioMessage())
    const secondCalls = await sendMessageUpdated(projectDir, highRatioMessage())

    expect(firstCalls).toHaveLength(1)
    expect(secondCalls).toHaveLength(0)
    expect(evidenceAttempts(projectDir)).toEqual([
      expect.objectContaining({ status: "triggered" }),
      expect.objectContaining({ reason: "cooldown-active", status: "skipped" }),
    ])
  })
})
