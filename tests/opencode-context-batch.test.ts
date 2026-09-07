import { mkdirSync, realpathSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createOpenCodeContextHooks, type OpenCodeContextObservation } from "../src/context-delivery/opencode-context-hooks.js"
import { ContextDeliveryStore, MAX_TRACKED_CONTEXT_SESSIONS } from "../src/context-delivery/context-delivery-store.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

function fixture() {
  const projectDir = realpathSync(createProject())
  writeHarnessConfig(projectDir, { context: { enabled: true, maxChars: 4_000, maxCapsules: 16 } })
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  const profile = join(projectDir, ".persona", "team-profile.json")
  const writeRules = (serviceRule = "Make the transfer atomic.") => writeFileSync(profile, JSON.stringify({
    schemaVersion: "persona-team-profile.v1", teamKey: "team",
    rules: [
      { id: "service.atomic", topic: "transactions", rule: serviceRule, fileRoles: ["service"], status: "active" },
      { id: "controller.response", topic: "responses", rule: "Preserve the public error response.", fileRoles: ["controller"], status: "active" },
    ],
  }))
  writeRules()
  const observations: OpenCodeContextObservation[] = []
  const hooks = createOpenCodeContextHooks({ projectDir, personalization: { storeRoot: join(projectDir, "personalization") }, onObservation: (value) => observations.push(value) })
  const observe = async (tool: string, args: unknown) => hooks["tool.execute.after"]?.(
    { args, callID: "call", sessionID: "session", tool }, { metadata: {}, output: "ok", title: tool },
  )
  const transform = async () => {
    const output = modelInput()
    await hooks["experimental.chat.messages.transform"]?.({}, output)
    return output
  }
  return { hooks, observations, observe, projectDir, transform, writeRules }
}

function modelInput(): TransformMessagesOutput {
  return { messages: [{
    info: { agent: "build", id: "message", model: { modelID: "fixture", providerID: "fixture" }, role: "user", sessionID: "session", time: { created: 1 } },
    parts: [{ id: "part", messageID: "message", sessionID: "session", type: "text", text: "Implement the transfer." }],
  }] }
}

function context(output: TransformMessagesOutput): string {
  return output.messages.flatMap((message) => message.parts).filter((part) => part.type === "text").map((part) => part.text).join("\n")
}

describe("OpenCode pending target batches", () => {
  it("reports capacity rejection at transform without offering a partial batch", async () => {
    const store = new ContextDeliveryStore()
    for (let i = 0; i < MAX_TRACKED_CONTEXT_SESSIONS; i += 1) store.observe(`other-${i}`, { kind: "targets", paths: [`${i}.java`] })
    store.observe("session", { kind: "targets", paths: ["src/TransferService.java"] })
    store.take("other-0")
    const { projectDir } = fixture()
    const observations: OpenCodeContextObservation[] = []
    const hooks = createOpenCodeContextHooks({ projectDir, store, onObservation: (value) => observations.push(value) })
    await hooks["tool.execute.after"]?.({ args: { filePath: "src/TransferController.java" }, callID: "call", sessionID: "session", tool: "read" }, { metadata: {}, output: "ok", title: "read" })
    observations.length = 0
    const output = modelInput()
    await hooks["experimental.chat.messages.transform"]?.({}, output)
    expect(observations).toEqual([{ status: "blocked", reason: "session-limit" }])
    expect(context(output)).not.toContain("[Persona Harness Context]")
  })

  it("records selected and offered metadata without claiming model delivery or retaining rule text", async () => {
    const { hooks, observations, observe, transform } = fixture()
    await observe("read", { filePath: "src/TransferService.java" })
    const output = await transform()
    expect(observations.map((value) => value.status)).toEqual(["selected", "offered"])
    expect(JSON.stringify(observations)).not.toContain("Make the transfer atomic.")
    await observe("read", { filePath: "src/TransferService.java" })
    await hooks["experimental.chat.messages.transform"]?.({}, output)
    expect(observations.at(-1)).toEqual({ status: "skipped", reason: "context-present" })
    await observe("read", { filePath: "../outside.java" })
    await transform()
    expect(observations.at(-1)).toEqual({ status: "blocked", reason: "target-invalid" })
  })

  it("keeps rules from both observations before the next model request", async () => {
    const { observe, transform } = fixture()
    await observe("read", { filePath: "src/TransferService.java" })
    await observe("read", { filePath: "src/TransferController.java" })
    const text = context(await transform())
    expect(text).toContain("Make the transfer atomic.")
    expect(text).toContain("Preserve the public error response.")
  })

  it("handles every apply_patch file, including a move destination", async () => {
    const { observe, transform } = fixture()
    await observe("functions.apply_patch", { input: "*** Begin Patch\n*** Update File: src/TransferService.java\n*** Move to: src/TransferController.java\n@@\n-old\n+new\n*** End Patch" })
    const text = context(await transform())
    expect(text).toContain("Make the transfer atomic.")
    expect(text).toContain("Preserve the public error response.")
  })

  it("refreshes profile changes between observation and model input", async () => {
    const { observe, transform, writeRules } = fixture()
    await observe("read", { filePath: "src/TransferService.java" })
    writeRules("Record the transaction and outbox atomically.")
    expect(context(await transform())).toContain("Record the transaction and outbox atomically.")
  })

  it("does not infer retained context from an earlier transform", async () => {
    const { observe, transform } = fixture()
    await observe("read", { filePath: "src/TransferService.java" })
    await transform()
    await observe("read", { filePath: "src/TransferService.java" })
    expect(context(await transform())).toContain("Make the transfer atomic.")
  })

  it("deduplicates only a Context block visible in the current model input", async () => {
    const { hooks, observe, transform } = fixture()
    await observe("read", { filePath: "src/TransferService.java" })
    const output = await transform()
    await observe("read", { filePath: "src/TransferService.java" })
    await hooks["experimental.chat.messages.transform"]?.({}, output)
    expect(context(output).match(/Make the transfer atomic\./gu)).toHaveLength(1)
  })

  it("does not deliver a safe prefix when another observation is invalid", async () => {
    const { observe, transform } = fixture()
    await observe("read", { filePath: "src/TransferService.java" })
    await observe("read", { filePath: "../outside.java" })
    expect(context(await transform())).not.toContain("[Persona Harness Context]")
  })

  it("preserves unoffered targets through compaction", async () => {
    const { hooks, observe, transform } = fixture()
    await observe("read", { filePath: "src/TransferService.java" })
    await hooks.event?.({ event: { type: "session.compacted", properties: { sessionID: "session" } } })
    expect(context(await transform())).toContain("Make the transfer atomic.")
  })
})
