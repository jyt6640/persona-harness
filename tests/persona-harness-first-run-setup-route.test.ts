import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"

const fixtureWorkspace = join(process.cwd(), ".persona-first-run-setup-route-fixtures")

beforeEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
  mkdirSync(fixtureWorkspace, { recursive: true })
})

afterEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
})

function modelInputWithText(sessionID: string, text: string): TransformMessagesOutput {
  const message: UserMessage = {
    id: `message-${sessionID}`,
    sessionID,
    role: "user",
    time: { created: Date.now() },
    agent: "build",
    model: { providerID: "test", modelID: "test-model" },
  }
  const part: Part = {
    id: `part-${sessionID}`,
    sessionID,
    messageID: message.id,
    type: "text",
    text,
  }
  return { messages: [{ info: message, parts: [part] }] }
}

function firstText(output: TransformMessagesOutput): string {
  const part = output.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

async function transform(
  hooks: ReturnType<typeof createPhase0Hooks>,
  sessionID: string,
  text: string,
): Promise<string> {
  const output = modelInputWithText(sessionID, text)
  await hooks["experimental.chat.messages.transform"]?.({}, output)
  return firstText(output)
}

describe("first-run shared-skill setup route", () => {
  it("proposes exactly the bounded PH setup before routing an uninitialized project's relevant request", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    const text = await transform(hooks, "session-first-run-proposal", "새 예약 서비스를 만들고 싶어")

    expect(text).toContain("[Persona Harness Setup Recommendation]")
    expect(text).toContain("(PH) Setup")
    expect(text).toContain("npx ph init")
    expect(text).toContain(".persona")
    expect(text).toContain("Do not run a command, create project state, or start a workflow")
    expect(text).not.toContain("[Persona Harness Product Interview]")
    expect(existsSync(join(fixtureWorkspace, ".persona"))).toBe(false)
    expect(existsSync(join(fixtureWorkspace, ".opencode"))).toBe(false)
  })

  it("accepts a clear setup confirmation without performing the initialization itself", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    await transform(hooks, "session-first-run-accept", "새 예약 서비스를 만들고 싶어")
    const accepted = await transform(hooks, "session-first-run-accept", "네, 설정해줘")

    expect(accepted).toContain("[Persona Harness Setup Approval]")
    expect(accepted).toContain("(PH) Setup")
    expect(accepted).toContain("npx ph init")
    expect(accepted).toContain("Do not run bootstrap, attach, workflow")
    expect(existsSync(join(fixtureWorkspace, ".persona"))).toBe(false)
    expect(existsSync(join(fixtureWorkspace, ".opencode"))).toBe(false)
  })

  it("accepts a clear English initialization confirmation without performing the initialization itself", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    await transform(hooks, "session-first-run-english-accept", "I want to build a small product")
    const accepted = await transform(hooks, "session-first-run-english-accept", "yes, initialize it")

    expect(accepted).toContain("[Persona Harness Setup Approval]")
    expect(accepted).not.toContain("[Persona Harness Product Interview]")
    expect(existsSync(join(fixtureWorkspace, ".persona"))).toBe(false)
    expect(existsSync(join(fixtureWorkspace, ".opencode"))).toBe(false)
  })

  it("accepts a contextual Korean confirmation without performing the initialization itself", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    await transform(hooks, "session-first-run-korean-accept", "새 예약 서비스를 만들고 싶어")
    const accepted = await transform(hooks, "session-first-run-korean-accept", "응, 해줘")

    expect(accepted).toContain("[Persona Harness Setup Approval]")
    expect(existsSync(join(fixtureWorkspace, ".persona"))).toBe(false)
    expect(existsSync(join(fixtureWorkspace, ".opencode"))).toBe(false)
  })

  it("does not start a stale interview when setup is declined", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    await transform(hooks, "session-first-run-decline", "새 예약 서비스를 만들고 싶어")
    const declined = await transform(hooks, "session-first-run-decline", "아니, 지금 설정하지 마")

    expect(declined).not.toContain("[Persona Harness Setup Recommendation]")
    expect(declined).not.toContain("[Persona Harness Product Interview]")
    expect(declined).not.toContain("[Persona Harness Auth Design Hold]")
    expect(existsSync(join(fixtureWorkspace, ".persona"))).toBe(false)
  })

  it("keeps a Context-only configuration outside shared-skill routing", async () => {
    mkdirSync(join(fixtureWorkspace, ".persona"), { recursive: true })
    writeFileSync(join(fixtureWorkspace, ".persona", "harness.jsonc"), "{\n  \"context\": { \"enabled\": true }\n}\n")
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    const text = await transform(hooks, "session-context-only", "I want to build a small product")

    expect(text).toBe("I want to build a small product")
    expect(text).not.toContain("[Persona Harness Setup Recommendation]")
    expect(text).not.toContain("[Persona Harness Product Interview]")
  })
})
