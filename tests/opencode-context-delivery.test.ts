import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import type { Event, Part, UserMessage } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { readContextPreview } from "../src/cli/context-preview.js"
import {
  ContextDeliveryStore,
  MAX_DELIVERED_CONTEXT_DIGESTS,
  MAX_TRACKED_CONTEXT_SESSIONS,
} from "../src/context-delivery/context-delivery-store.js"
import { createOpenCodeContextHooks } from "../src/context-delivery/opencode-context-hooks.js"
import { PersonaHarnessPlugin } from "../src/index.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"

const projects: string[] = []
const repositoryRoot = resolve(process.cwd())

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("OpenCode Context delivery", () => {
  it("delivers one Context block after a safe observed target while legacy runtime injection is off", async () => {
    const projectDir = createProject({ context: { enabled: true } })
    const personalization = { storeRoot: join(projectDir, "personalization-store") }
    const hooks = createOpenCodeContextHooks({
      personalization,
      projectDir,
    })

    const preview = readContextPreview(["src/main/java/example/CustomerService.java"], projectDir, { personalization })
    expect(preview.status).toBe("ready")
    if (preview.status === "ready") {
      expect(preview.preview.contextEnabled).toBe(true)
      expect(preview.preview.envelope.status).toBe("resolved")
      if (preview.preview.envelope.status === "resolved") {
        const renderedLength = "[Persona Harness Context]".length + 1
          + preview.preview.envelope.selected.reduce((total, capsule) => total + capsule.content.length, 0)
          + Math.max(0, preview.preview.envelope.selected.length - 1)
        expect(renderedLength).toBeLessThanOrEqual(preview.preview.envelope.budget.maxChars)
      }
    }

    await observeTarget(hooks, "context-delivery", "src/main/java/example/CustomerService.java")
    const output = modelInput("context-delivery", "Create the service.")
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).toContain("[Persona Harness Context]")
    expect(firstText(output)).not.toContain("[Persona Harness Runtime Context]")
  })

  it("does not let legacy runtimeInjection enable Context delivery", async () => {
    const projectDir = createProject({
      context: { enabled: false },
      features: { runtimeInjection: true },
    })
    const hooks = createOpenCodeContextHooks({
      personalization: { storeRoot: join(projectDir, "personalization-store") },
      projectDir,
    })

    await observeTarget(hooks, "context-disabled", "src/main/java/example/CustomerService.java")
    const output = modelInput("context-disabled", "Create the service.")
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).toBe("Create the service.")
  })

  it("fails closed for a target outside the project root", async () => {
    const projectDir = createProject({ context: { enabled: true } })
    const hooks = createOpenCodeContextHooks({
      personalization: { storeRoot: join(projectDir, "personalization-store") },
      projectDir,
    })

    await observeTarget(hooks, "context-unsafe", "/private/outside/CustomerService.java")
    const output = modelInput("context-unsafe", "Create the service.")
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).toBe("Create the service.")
  })

  it("suppresses a delivered digest until the host ends the session", async () => {
    const projectDir = createProject({ context: { enabled: true } })
    const hooks = createOpenCodeContextHooks({
      personalization: { storeRoot: join(projectDir, "personalization-store") },
      projectDir,
    })
    const sessionID = "context-lifecycle"
    const target = "src/main/java/example/CustomerService.java"

    await observeTarget(hooks, sessionID, target)
    const first = modelInput(sessionID, "Create the service.")
    await hooks["experimental.chat.messages.transform"]?.({}, first)
    expect(firstText(first)).toContain("[Persona Harness Context]")

    await observeTarget(hooks, sessionID, target)
    const duplicate = modelInput(sessionID, "Continue the service.")
    await hooks["experimental.chat.messages.transform"]?.({}, duplicate)
    expect(firstText(duplicate)).toBe("Continue the service.")

    await hooks.event?.({
      event: sessionDeletedEvent(sessionID),
    })

    await observeTarget(hooks, sessionID, target)
    const afterCleanup = modelInput(sessionID, "Create the service again.")
    await hooks["experimental.chat.messages.transform"]?.({}, afterCleanup)
    expect(firstText(afterCleanup)).toContain("[Persona Harness Context]")
  })

  it("releases a delivered digest after session compaction", async () => {
    const projectDir = createProject({ context: { enabled: true } })
    const hooks = createOpenCodeContextHooks({
      personalization: { storeRoot: join(projectDir, "personalization-store") },
      projectDir,
    })
    const sessionID = "context-compaction"
    const target = "src/main/java/example/CustomerService.java"

    await observeTarget(hooks, sessionID, target)
    const first = modelInput(sessionID, "Create the service.")
    await hooks["experimental.chat.messages.transform"]?.({}, first)
    expect(firstText(first)).toContain("[Persona Harness Context]")

    await hooks.event?.({ event: sessionCompactedEvent(sessionID) })

    await observeTarget(hooks, sessionID, target)
    const afterCompaction = modelInput(sessionID, "Create the service again.")
    await hooks["experimental.chat.messages.transform"]?.({}, afterCompaction)
    expect(firstText(afterCompaction)).toContain("[Persona Harness Context]")
  })

  it("bounds retained session and digest state deterministically", () => {
    const store = new ContextDeliveryStore()
    expect(MAX_TRACKED_CONTEXT_SESSIONS).toBeGreaterThan(0)
    expect(MAX_DELIVERED_CONTEXT_DIGESTS).toBeGreaterThan(0)

    for (let index = 0; index <= MAX_TRACKED_CONTEXT_SESSIONS; index += 1) {
      store.offer(`session-${index}`, { block: `block-${index}`, digest: `digest-${index}` })
    }
    expect(store.offer("session-0", { block: "new", digest: "digest-0" })).toBe("offered")

    for (let index = 0; index <= MAX_DELIVERED_CONTEXT_DIGESTS; index += 1) {
      const delivery = { block: `block-${index}`, digest: `digest-${index}` }
      store.offer("digest-session", delivery)
      store.markDelivered("digest-session", delivery)
    }
    expect(store.offer("digest-session", { block: "again", digest: "digest-0" })).toBe("offered")
  })

  it("composes Context delivery into the package plugin without enabling legacy runtime injection", async () => {
    const projectDir = createProject({ context: { enabled: true } })
    const pluginInput: PluginInput = {
      client: {} as PluginInput["client"],
      directory: projectDir,
      experimental_workspace: { register: () => {} },
      project: {} as PluginInput["project"],
      serverUrl: new URL("http://localhost"),
      worktree: projectDir,
      $: {} as PluginInput["$"],
    }
    const hooks = await PersonaHarnessPlugin(pluginInput, {})

    await observeTarget(hooks, "context-plugin", "src/main/java/example/CustomerService.java")
    const output = modelInput("context-plugin", "Create the service.")
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).toContain("[Persona Harness Context]")
    expect(firstText(output)).not.toContain("[Persona Harness Runtime Context]")
  })

  it("keeps the adapter free of legacy runtime, evidence, workflow, authority, process, and network dependencies", () => {
    const sources = [
      "src/context-delivery/context-delivery-store.ts",
      "src/context-delivery/opencode-context-hooks.ts",
    ].map((path) => readFileSync(resolve(repositoryRoot, path), "utf8"))

    for (const source of sources) {
      for (const token of ["../runtime/", "evidence", "workflow", "authority", "node:child_process", "node:http", "node:https", "fetch(", "spawn(", "exec("]) {
        expect(source).not.toContain(token)
      }
    }
  })
})

function createProject(config: Record<string, unknown>): string {
  const projectDir = realpathSync(mkdtempSync(join(tmpdir(), "persona-opencode-context-delivery-")))
  projects.push(projectDir)
  const personaDir = join(projectDir, ".persona")
  mkdirSync(personaDir, { recursive: true })
  writeFileSync(join(personaDir, "harness.jsonc"), `${JSON.stringify(config, null, 2)}\n`)
  return projectDir
}

async function observeTarget(
  hooks: Pick<Hooks, "tool.execute.after">,
  sessionID: string,
  targetFile: string,
): Promise<void> {
  await hooks["tool.execute.after"]?.(
    { args: { filePath: targetFile }, callID: "call-1", sessionID, tool: "read" },
    { metadata: {}, output: "ok", title: "read" },
  )
}

function modelInput(sessionID: string, text: string): TransformMessagesOutput {
  const info: UserMessage = {
    agent: "build",
    id: "message-1",
    model: { modelID: "test-model", providerID: "test" },
    role: "user",
    sessionID,
    time: { created: Date.now() },
  }
  const part: Part = {
    id: "part-1",
    messageID: info.id,
    sessionID,
    text,
    type: "text",
  }
  return { messages: [{ info, parts: [part] }] }
}

function firstText(output: TransformMessagesOutput): string {
  const part = output.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

function sessionDeletedEvent(sessionID: string): Event {
  return {
    properties: {
      info: {
        directory: "/tmp/project",
        id: sessionID,
        projectID: "project",
        time: { created: 1, updated: 1 },
        title: "Test session",
        version: "1",
      },
    },
    type: "session.deleted",
  }
}

function sessionCompactedEvent(sessionID: string): Event {
  return { properties: { sessionID }, type: "session.compacted" }
}
