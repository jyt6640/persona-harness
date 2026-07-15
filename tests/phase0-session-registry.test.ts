import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { Event, Model, Part, UserMessage } from "@opencode-ai/sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { opaqueEvidenceKey } from "../src/runtime/evidence-file.js"
import type { IdleContinuationClient, IdlePromptAsyncOptions } from "../src/runtime/idle-continuation.js"
import type { TextCompleteOutput, TransformMessagesOutput } from "../src/runtime/types.js"

const fixtureWorkspace = join(process.cwd(), ".persona-session-registry-test-fixtures")
const fixtureRoot = join(fixtureWorkspace, "src", "main", "java", "com", "example")

beforeEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
})

afterEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
})

function writeHarnessConfig(config: Record<string, unknown>): void {
  mkdirSync(join(fixtureWorkspace, ".persona"), { recursive: true })
  cpSync(join(process.cwd(), ".persona", "rules"), join(fixtureWorkspace, ".persona", "rules"), { recursive: true })
  writeFileSync(join(fixtureWorkspace, ".persona", "harness.jsonc"), `${JSON.stringify(config, null, 2)}\n`)
}

function writeRuntimeMultiAgentConfig(extra: Record<string, unknown> = {}): void {
  writeHarnessConfig({
    enabledDomains: ["backend", "programming", "workflow"],
    features: { runtimeInjection: true },
    multiAgent: {
      enabled: true,
      roles: ["test-writer", "implementer", "reviewer"],
    },
    ...extra,
  })
}

function writeRuntimeOnlyConfig(extra: Record<string, unknown> = {}): void {
  writeHarnessConfig({
    enabledDomains: ["backend", "programming", "workflow"],
    features: { runtimeInjection: true },
    ...extra,
  })
}

function fixturePath(fileName: string): string {
  mkdirSync(fixtureRoot, { recursive: true })
  const path = join(fixtureRoot, fileName)
  writeFileSync(path, "class Placeholder {}\n")
  return path
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

function modelInput(sessionID: string, text = "README.md 구현해줘"): TransformMessagesOutput {
  const message: UserMessage = {
    agent: "build",
    id: `message-${sessionID}`,
    model: {
      modelID: "test-model",
      providerID: "test",
    },
    role: "user",
    sessionID,
    time: { created: 1 },
  }
  const textPart: Part = {
    id: `part-${sessionID}`,
    messageID: message.id,
    sessionID,
    text,
    type: "text",
  }

  return {
    messages: [
      {
        info: message,
        parts: [textPart],
      },
    ],
  }
}

function firstText(output: TransformMessagesOutput): string {
  const part = output.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

function testModel(): Model {
  return {
    api: {
      id: "test-api",
      npm: "@test/provider",
      url: "http://localhost",
    },
    capabilities: {
      attachment: false,
      input: {
        audio: false,
        image: false,
        pdf: false,
        text: true,
        video: false,
      },
      output: {
        audio: false,
        image: false,
        pdf: false,
        text: true,
        video: false,
      },
      reasoning: false,
      temperature: false,
      toolcall: true,
    },
    cost: {
      cache: {
        read: 0,
        write: 0,
      },
      input: 0,
      output: 0,
    },
    headers: {},
    id: "test-model",
    limit: {
      context: 8192,
      output: 2048,
    },
    name: "Test Model",
    options: {},
    providerID: "test",
    status: "active",
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readJsonObject(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!isRecord(parsed)) {
    throw new Error(`expected object at ${path}`)
  }
  return parsed
}

function skipEvidencePayloads(): readonly Record<string, unknown>[] {
  const evidenceDir = join(fixtureWorkspace, ".persona", "evidence", "session-injection-skips")
  if (!existsSync(evidenceDir)) {
    return []
  }
  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => readJsonObject(join(evidenceDir, fileName)))
}

function writeBlockedWorkflow(): void {
  mkdirSync(join(fixtureWorkspace, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(fixtureWorkspace, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(fixtureWorkspace, ".persona", "workflow", "implementation-report.md"), "Status: filled\n")
  writeFileSync(join(fixtureWorkspace, ".persona", "workflow", "review-report.md"), "Status: template\n")
  writeFileSync(
    join(fixtureWorkspace, ".persona", "workflow", "backlog.md"),
    `| order | id | title | status | path |
| --- | --- | --- | --- | --- |
| 1 | req-1 | Pending Work | pending | .persona/workflow/work/req-1/00-task-card.md |
`,
  )
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

describe("runtime session classification for multi-agent hooks", () => {
  it("does not inject runtime guidance into a classified subagent session", async () => {
    writeRuntimeMultiAgentConfig()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-subagent"
    const targetFile = fixturePath("ReservationController.java")

    await hooks.event?.({ event: sessionEvent(fixtureWorkspace, "session.created", sessionID, "session-main") })
    await hooks["tool.execute.before"]?.(
      { callID: "call-1", sessionID, tool: "edit" },
      { args: { filePath: targetFile } },
    )
    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toBe("README.md 구현해줘")
    expect(text).not.toContain("[Persona Harness Injection]")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")

    const payloads = skipEvidencePayloads()
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      count: 3,
      lastReason: "subagent-session",
      schemaVersion: "session-injection-skip.1",
      sessionID,
      skippedSurfaces: {
        "intent-workflow": 1,
        "model-input": 1,
        "target-file": 1,
      },
    })
    expect(payloads[0]?.classification).toMatchObject({
      kind: "subagent",
      parentID: "session-main",
      state: "classified",
    })
  })

  it("preserves runtime injection for a classified main session when multiAgent is enabled", async () => {
    writeRuntimeMultiAgentConfig()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-main"
    const targetFile = fixturePath("ReservationController.java")

    await hooks.event?.({ event: sessionEvent(fixtureWorkspace, "session.created", sessionID) })
    await hooks["tool.execute.before"]?.(
      { callID: "call-1", sessionID, tool: "edit" },
      { args: { filePath: targetFile } },
    )
    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("[Persona Harness Injection]")
    expect(text).toContain("File role: controller")
    expect(skipEvidencePayloads()).toEqual([])
  })

  it("fails closed for an unclassified session when multiAgent is enabled", async () => {
    writeRuntimeMultiAgentConfig()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-unknown"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.before"]?.(
      { callID: "call-1", sessionID, tool: "edit" },
      { args: { filePath: targetFile } },
    )
    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).toBe("README.md 구현해줘")
    const payloads = skipEvidencePayloads()
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      count: 3,
      lastReason: "classification-unavailable",
      sessionID,
    })
    expect(payloads[0]?.classification).toMatchObject({
      kind: "unknown",
      parentID: null,
      state: "unclassified",
    })
  })

  it("recovers from truncated skip evidence by aggregating a fresh diagnostic record", async () => {
    writeRuntimeMultiAgentConfig()
    const evidenceDir = join(fixtureWorkspace, ".persona", "evidence", "session-injection-skips")
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(join(evidenceDir, `${opaqueEvidenceKey("session-unknown")}.json`), "{ nope\n")
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.before"]?.(
      { callID: "call-1", sessionID: "session-unknown", tool: "edit" },
      { args: { filePath: targetFile } },
    )

    const payloads = skipEvidencePayloads()
    expect(payloads).toHaveLength(1)
    expect(payloads[0]).toMatchObject({
      count: 1,
      lastReason: "classification-unavailable",
      sessionID: "session-unknown",
    })
  })

  it("treats sessions as main when multiAgent is off", async () => {
    writeRuntimeOnlyConfig()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-no-multi-agent"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.before"]?.(
      { callID: "call-1", sessionID, tool: "edit" },
      { args: { filePath: targetFile } },
    )
    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("[Persona Harness Injection]")
    expect(skipEvidencePayloads()).toEqual([])
  })

  it("gates system constitution injection to classified main sessions", async () => {
    writeRuntimeMultiAgentConfig({ enforce: { systemConstitution: true } })
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    await hooks.event?.({ event: sessionEvent(fixtureWorkspace, "session.created", "session-subagent", "session-main") })
    const subagentOutput = { system: ["Existing host system prompt."] }
    await hooks["experimental.chat.system.transform"]?.(
      { model: testModel(), sessionID: "session-subagent" },
      subagentOutput,
    )

    await hooks.event?.({ event: sessionEvent(fixtureWorkspace, "session.created", "session-main") })
    const mainOutput = { system: ["Existing host system prompt."] }
    await hooks["experimental.chat.system.transform"]?.({ model: testModel(), sessionID: "session-main" }, mainOutput)

    expect(subagentOutput.system.join("\n")).not.toContain("[Persona Harness System Constitution]")
    expect(mainOutput.system.join("\n")).toContain("[Persona Harness System Constitution]")
    expect(skipEvidencePayloads()).toHaveLength(1)
  })

  it("gates text and idle continuation to classified main sessions", async () => {
    writeRuntimeMultiAgentConfig({ enforce: { idleContinuation: true } })
    writeBlockedWorkflow()
    const calls: IdlePromptAsyncOptions[] = []
    const hooks = createPhase0Hooks({ client: fakeClient(calls), projectDir: fixtureWorkspace })

    await hooks.event?.({ event: sessionEvent(fixtureWorkspace, "session.created", "session-subagent", "session-main") })
    const subagentText: TextCompleteOutput = { text: "All done." }
    await hooks["experimental.text.complete"]?.(
      {
        messageID: "message-subagent",
        partID: "part-subagent",
        sessionID: "session-subagent",
      },
      subagentText,
    )
    await hooks.event?.({ event: { properties: { sessionID: "session-subagent" }, type: "session.idle" } })

    await hooks.event?.({ event: sessionEvent(fixtureWorkspace, "session.created", "session-main-text") })
    const mainText: TextCompleteOutput = { text: "All done." }
    await hooks["experimental.text.complete"]?.(
      {
        messageID: "message-main",
        partID: "part-main",
        sessionID: "session-main-text",
      },
      mainText,
    )
    await hooks.event?.({ event: sessionEvent(fixtureWorkspace, "session.created", "session-main-idle") })
    await hooks.event?.({ event: { properties: { sessionID: "session-main-idle" }, type: "session.idle" } })

    expect(subagentText.text).toBe("All done.")
    expect(mainText.text).toContain("[Persona Harness Continuation]")
    expect(calls).toHaveLength(1)
    expect(calls[0]?.path.id).toBe("session-main-idle")
  })
})
