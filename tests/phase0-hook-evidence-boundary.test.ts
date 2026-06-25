import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { TextCompleteOutput, ToolAfterOutput, TransformMessagesOutput } from "../src/runtime/types.js"

const tempProjects: string[] = []

function createProjectWithBlockedEvidence(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-hook-evidence-boundary-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "evidence-file"), "not a directory\n")
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify(
      {
        enabledDomains: ["backend", "programming", "workflow"],
        evidenceDir: ".persona/evidence-file",
      },
      null,
      2,
    )}\n`,
  )
  return projectDir
}

function modelInputWithText(sessionID: string, text: string): TransformMessagesOutput {
  const message: UserMessage = {
    id: `msg-${sessionID}`,
    sessionID,
    role: "user",
    time: { created: Date.now() },
    agent: "build",
    model: {
      providerID: "test",
      modelID: "test-model",
    },
  }
  const textPart: Part = {
    id: `part-${sessionID}`,
    sessionID,
    messageID: message.id,
    type: "text",
    text,
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

afterEach(() => {
  vi.restoreAllMocks()
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("runtime hook evidence write boundary", () => {
  it("keeps read tool output injection alive when phase0 evidence cannot be written", async () => {
    const projectDir = createProjectWithBlockedEvidence()
    const hooks = createPhase0Hooks({ projectDir })
    const output: ToolAfterOutput = { title: "read", output: "# Coupon API", metadata: {} }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    await expect(
      hooks["tool.execute.after"]?.({
        tool: "read",
        sessionID: "session-read",
        callID: "call-read",
        args: { path: "README.md" },
      }, output),
    ).resolves.toBeUndefined()

    expect(output.output).toContain("[Persona Harness Injection]")
    expect(output.output).toContain("파일 역할: project-bootstrap")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[Persona Harness Runtime Warning]"))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("kind=evidence-write"))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("scope=evidence-write"))
  })

  it("keeps the host hook alive when injection context loading throws", async () => {
    const projectDir = createProjectWithBlockedEvidence()
    rmSync(join(projectDir, ".persona", "evidence-file"), { force: true })
    mkdirSync(join(projectDir, ".persona", "project-profile.jsonc"), { recursive: true })
    const hooks = createPhase0Hooks({ projectDir })
    const output: ToolAfterOutput = { title: "read", output: "# Coupon API", metadata: {} }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    await expect(
      hooks["tool.execute.after"]?.({
        tool: "read",
        sessionID: "session-read-profile-dir",
        callID: "call-read-profile-dir",
        args: { path: "README.md" },
      }, output),
    ).resolves.toBeUndefined()

    expect(output.output).toBe("# Coupon API")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[Persona Harness Runtime Warning]"))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("kind=hook-boundary"))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("scope=hook.tool.execute.after"))
  })

  it("keeps intent workflow transform alive when intent evidence cannot be written", async () => {
    const projectDir = createProjectWithBlockedEvidence()
    const hooks = createPhase0Hooks({ projectDir })
    const output = modelInputWithText("session-intent", "CouponService 만들어줘")
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    await expect(hooks["experimental.chat.messages.transform"]?.({}, output)).resolves.toBeUndefined()

    expect(firstText(output)).toContain("[Persona Harness Programming Workflow]")
    expect(firstText(output)).toContain("Detected intent: programming")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[Persona Harness Runtime Warning]"))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("kind=evidence-write"))
  })

  it("keeps continuation text completion alive when continuation evidence cannot be written", async () => {
    const projectDir = createProjectWithBlockedEvidence()
    mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "- 미완료 요구사항: Step 2\n- 남은 README/plan 범위: README.md 120-260\n",
    )
    const hooks = createPhase0Hooks({ projectDir })
    const output: TextCompleteOutput = { text: "구현 완료했습니다." }
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)

    await expect(
      hooks["experimental.text.complete"]?.(
        {
          sessionID: "session-continuation",
          messageID: "message-continuation",
          partID: "part-continuation",
        },
        output,
      ),
    ).resolves.toBeUndefined()

    expect(output.text).toContain("[Persona Harness Continuation]")
    expect(output.text).toContain("Remaining README/plan range: README.md 120-260")
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("[Persona Harness Runtime Warning]"))
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("kind=evidence-write"))
  })
})
