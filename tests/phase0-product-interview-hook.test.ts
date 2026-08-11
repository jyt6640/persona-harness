import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"

const workspaces: string[] = []

function createProductProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-product-interview-hook-"))
  workspaces.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["workflow", "product"] }, null, 2)}\n`,
  )
  return projectDir
}

afterEach(() => {
  for (const workspace of workspaces) {
    rmSync(workspace, { recursive: true, force: true })
  }
  workspaces.length = 0
})

function outputWithText(sessionID: string, text: string): TransformMessagesOutput {
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

function latestText(output: TransformMessagesOutput): string {
  const part = output.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

describe("product interview hook activation", () => {
  it("renders a mandatory first-response contract before the original product request", async () => {
    const projectDir = createProductProject()
    const hooks = createPhase0Hooks({ projectDir })
    const output = outputWithText("session-first-response-contract", "Create an app for neighbours to exchange practical skills")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = latestText(output)
    expect(text).toContain("Required first response: ask exactly one product question now, then wait for the user's answer.")
    expect(text).toContain("Do not propose a solution, implementation, technical plan, command, or file change in this turn.")
  })

  it("starts the interview for an ambiguous create-an-app request and keeps approval non-mutating", async () => {
    const projectDir = createProductProject()
    const hooks = createPhase0Hooks({ projectDir })
    const sessionID = "session-create-app"

    const firstOutput = outputWithText(sessionID, "Create an app for neighbours to exchange practical skills")
    await hooks["experimental.chat.messages.transform"]?.({}, firstOutput)
    const first = latestText(firstOutput)

    expect(first).toContain("[Persona Harness Product Interview]")
    expect(first).toContain("Question:")
    expect(first).toContain("Decision: activate")
    expect(first).not.toContain("[Persona Harness Programming Workflow]")
    expect(first).not.toContain("npx ph workflow")
    expect(existsSync(join(projectDir, ".persona", "workflow"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)

    const approvalOutput = outputWithText(sessionID, "approve")
    await hooks["experimental.chat.messages.transform"]?.({}, approvalOutput)
    expect(latestText(approvalOutput)).toContain("Approval is not available")
    expect(existsSync(join(projectDir, ".persona", "workflow"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
  })
})
