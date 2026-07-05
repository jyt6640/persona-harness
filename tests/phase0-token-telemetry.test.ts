import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { AssistantMessage, Model } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { TokenTelemetryRecorder } from "../src/runtime/token-telemetry.js"
import type { TransformSystemOutput } from "../src/runtime/types.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

function assistantMessage(
  overrides: Partial<Pick<AssistantMessage, "id" | "sessionID" | "modelID" | "providerID" | "tokens">> = {},
): AssistantMessage {
  return {
    id: overrides.id ?? "msg-assistant-1",
    sessionID: overrides.sessionID ?? "session-token-usage",
    role: "assistant",
    time: { created: 1, completed: 2 },
    parentID: "msg-user-1",
    modelID: overrides.modelID ?? "gpt-test",
    providerID: overrides.providerID ?? "openai",
    mode: "primary",
    path: { cwd: process.cwd(), root: process.cwd() },
    cost: 0,
    tokens: overrides.tokens ?? {
      input: 10,
      output: 5,
      reasoning: 1,
      cache: { read: 20, write: 2 },
    },
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
    cost: {
      input: 0,
      output: 0,
      cache: { read: 0, write: 0 },
    },
    limit: { context, output: 4096 },
    status: "active",
    options: {},
    headers: {},
  }
}

function readEvidence(projectDir: string, sessionID = "session-token-usage"): Record<string, unknown> {
  const path = join(projectDir, ".persona", "evidence", "token-usage", `${sessionID}.json`)
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error(`expected token evidence object at ${path}`)
  }
  return parsed as Record<string, unknown>
}

describe("Phase 0 token telemetry", () => {
  it("writes latest assistant message token usage without model ratio when limit is unknown", () => {
    const projectDir = createProject()
    const recorder = new TokenTelemetryRecorder(projectDir)

    const result = recorder.recordMessage(assistantMessage())

    expect(result.kind).toBe("written")
    const evidence = readEvidence(projectDir)
    expect(evidence.schemaVersion).toBe("token-usage.1")
    expect(evidence.source).toBe("opencode-plugin-event:message.updated")
    expect(evidence.providerID).toBe("openai")
    expect(evidence.modelID).toBe("gpt-test")
    expect(evidence.modelLimit).toBeNull()
    expect(evidence.ratio).toBeNull()
    expect(evidence.modelLimitUnavailableReason).toContain("model context limit not observed")
    expect(evidence.aggregate).toEqual({
      input: 10,
      output: 5,
      reasoning: 1,
      cacheRead: 20,
      cacheWrite: 2,
      total: 38,
    })
  })

  it("deduplicates repeated message updates by message id and keeps the latest tokens", () => {
    const projectDir = createProject()
    const recorder = new TokenTelemetryRecorder(projectDir)
    recorder.recordMessage(assistantMessage())

    recorder.recordMessage(
      assistantMessage({
        tokens: {
          input: 11,
          output: 7,
          reasoning: 2,
          cache: { read: 23, write: 3 },
        },
      }),
    )

    const evidence = readEvidence(projectDir)
    expect(evidence.messages).toEqual([
      expect.objectContaining({
        messageID: "msg-assistant-1",
        tokens: {
          input: 11,
          output: 7,
          reasoning: 2,
          cacheRead: 23,
          cacheWrite: 3,
          total: 46,
        },
      }),
    ])
    expect(evidence.aggregate).toEqual({
      input: 11,
      output: 7,
      reasoning: 2,
      cacheRead: 23,
      cacheWrite: 3,
      total: 46,
    })
  })

  it("recovers from truncated token usage evidence by writing a fresh safe payload", () => {
    const projectDir = createProject()
    mkdirSync(join(projectDir, ".persona", "evidence", "token-usage"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "token-usage", "session-token-usage.json"), "{ nope\n")
    const recorder = new TokenTelemetryRecorder(projectDir)

    const result = recorder.recordMessage(assistantMessage())

    expect(result.kind).toBe("written")
    const evidence = readEvidence(projectDir)
    expect(evidence.schemaVersion).toBe("token-usage.1")
    expect(evidence.messages).toEqual([expect.objectContaining({ messageID: "msg-assistant-1" })])
  })

  it("uses observed model context limit to compute input plus cache-read ratio", () => {
    const projectDir = createProject()
    const recorder = new TokenTelemetryRecorder(projectDir)
    recorder.rememberModelLimit("session-token-usage", modelWithContextLimit(100))

    recorder.recordMessage(assistantMessage())

    const evidence = readEvidence(projectDir)
    expect(evidence.modelLimit).toBe(100)
    expect(evidence.modelLimitSource).toBe("experimental.chat.system.transform")
    expect(evidence.modelLimitUnavailableReason).toBeNull()
    expect(evidence.ratio).toBe(0.3)
  })

  it("records message.updated events through the runtime hook boundary", async () => {
    const projectDir = createProject()
    const hooks = createPhase0Hooks({ projectDir })
    const output: TransformSystemOutput = { system: [] }

    await hooks["experimental.chat.system.transform"]?.(
      { sessionID: "session-token-usage", model: modelWithContextLimit(200) },
      output,
    )
    await hooks.event?.({
      event: {
        type: "message.updated",
        properties: { info: assistantMessage() },
      },
    })

    const evidence = readEvidence(projectDir)
    expect(evidence.modelLimit).toBe(200)
    expect(evidence.ratio).toBe(0.15)
  })

  it("does not reparse harness config while handling message.updated token telemetry", async () => {
    const projectDir = createProject()
    const hooks = createPhase0Hooks({ projectDir })
    writeHarnessConfig(projectDir, { evidenceDir: ".persona/changed-evidence" })

    await hooks.event?.({
      event: {
        type: "message.updated",
        properties: { info: assistantMessage() },
      },
    })

    expect(existsSync(join(projectDir, ".persona", "evidence", "token-usage", "session-token-usage.json"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "changed-evidence", "token-usage", "session-token-usage.json"))).toBe(
      false,
    )
  })

  it("skips token telemetry when the harness config disables it", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { telemetry: { tokenUsage: false } })
    const hooks = createPhase0Hooks({ projectDir })

    await hooks.event?.({
      event: {
        type: "message.updated",
        properties: { info: assistantMessage() },
      },
    })

    expect(existsSync(join(projectDir, ".persona", "evidence", "token-usage", "session-token-usage.json"))).toBe(
      false,
    )
  })
})
