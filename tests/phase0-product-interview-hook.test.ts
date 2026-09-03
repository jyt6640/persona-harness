import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { EventInput, TransformMessagesOutput } from "../src/runtime/types.js"
import { writeManagedInitFixture } from "./managed-init-fixture.js"

const workspaces: string[] = []

function createProductProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-product-interview-hook-"))
  workspaces.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["workflow", "product"] }, null, 2)}\n`,
  )
  writeManagedInitFixture(projectDir)
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

  it("does not automatically restart a stopped interview and only accepts an explicit deep-interview restart", async () => {
    const projectDir = createProductProject()
    const hooks = createPhase0Hooks({ projectDir })
    const sessionID = "session-product-suppression"

    // Given: a product interview was started and then explicitly stopped.
    const started = outputWithText(sessionID, "Create an app for neighbours to exchange practical skills")
    await hooks["experimental.chat.messages.transform"]?.({}, started)
    const stopped = outputWithText(sessionID, "아니 지금 필요없는 인터뷰 하지마")
    await hooks["experimental.chat.messages.transform"]?.({}, stopped)

    // When: a later automatic product prompt appears, followed by an explicit command.
    const automaticRestart = outputWithText(sessionID, "Create an app for neighbourhood bookings")
    await hooks["experimental.chat.messages.transform"]?.({}, automaticRestart)
    const explicitRestart = outputWithText(sessionID, "/persona deep-interview")
    await hooks["experimental.chat.messages.transform"]?.({}, explicitRestart)

    // Then: only the explicit command injects the interview route.
    expect(latestText(automaticRestart)).not.toContain("[Persona Harness Product Interview]")
    expect(latestText(explicitRestart)).toContain("[Persona Harness Product Interview]")
    expect(latestText(explicitRestart)).toContain("Question:")
  })

  it("releases stopped interview state when the host ends its session", async () => {
    const projectDir = createProductProject()
    const hooks = createPhase0Hooks({ projectDir })
    const sessionID = "session-product-lifecycle-cleanup"

    // Given: a stopped product interview whose host session is then removed.
    await hooks["experimental.chat.messages.transform"]?.(
      {},
      outputWithText(sessionID, "Create an app for neighbours to exchange practical skills"),
    )
    await hooks["experimental.chat.messages.transform"]?.({}, outputWithText(sessionID, "stop"))
    await hooks.event?.({
      event: { type: "session.deleted", properties: { info: { id: sessionID } } },
    } as unknown as EventInput)

    // When: a host reuses that identifier after lifecycle cleanup.
    const restarted = outputWithText(sessionID, "Create an app for neighbourhood bookings")
    await hooks["experimental.chat.messages.transform"]?.({}, restarted)

    // Then: no stopped-session state can exhaust future automatic routing.
    expect(latestText(restarted)).toContain("[Persona Harness Product Interview]")
  })
})
