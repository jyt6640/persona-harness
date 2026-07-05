import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { ToolAfterOutput, TransformMessagesOutput } from "../src/runtime/types.js"

const fixtureWorkspace = join(process.cwd(), ".persona-rail-compliance-test-fixtures")

beforeEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
  mkdirSync(join(fixtureWorkspace, ".persona"), { recursive: true })
  writeFileSync(
    join(fixtureWorkspace, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
})

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function compliancePayloads(): readonly Record<string, unknown>[] {
  const evidenceDir = join(fixtureWorkspace, ".persona", "evidence", "phase0")
  if (!existsSync(evidenceDir)) {
    return []
  }

  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const parsed: unknown = JSON.parse(readFileSync(join(evidenceDir, fileName), "utf8"))
      if (!isRecord(parsed)) {
        throw new Error(`expected evidence payload object: ${fileName}`)
      }
      return parsed
    })
    .filter((payload) => payload.schemaVersion === "phase0.rail-compliance.1")
}

function toolOutput(output: string): ToolAfterOutput {
  return {
    title: "test",
    output,
    metadata: {},
  }
}

async function injectRail(sessionID: string, prompt: string): Promise<void> {
  const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
  const output = modelInputWithText(sessionID, prompt)
  await hooks["experimental.chat.messages.transform"]?.({}, output)
}

describe("rail compliance evidence", () => {
  it("records a WARN when a review rail modifies a file", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-review-edit"
    await hooks["experimental.chat.messages.transform"]?.({}, modelInputWithText(sessionID, "이 코드 리뷰해줘"))

    await hooks["tool.execute.after"]?.(
      { tool: "edit", sessionID, callID: "call-edit", args: { filePath: "src/App.java" } },
      toolOutput("edited"),
    )

    expect(compliancePayloads()).toContainEqual(
      expect.objectContaining({
        finding: "WARN",
        code: "review-rail-file-modification",
        primaryIntent: "review",
      }),
    )
  })

  it("records a WARN when a requirements rail edits before workflow split or next", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-requirements-direct-edit"
    await hooks["experimental.chat.messages.transform"]?.({}, modelInputWithText(sessionID, "README.md 구현해줘"))

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID, callID: "call-write", args: { filePath: "src/App.java" } },
      toolOutput("written"),
    )

    expect(compliancePayloads()).toContainEqual(
      expect.objectContaining({
        finding: "WARN",
        code: "requirements-rail-direct-implementation",
        primaryIntent: "requirements",
      }),
    )
  })

  it("does not warn for requirements edits after workflow split and next are observed", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-requirements-ticketed-edit"
    await hooks["experimental.chat.messages.transform"]?.({}, modelInputWithText(sessionID, "README.md 구현해줘"))

    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-split", args: { cmd: "npx ph workflow split README.md" } },
      toolOutput("split"),
    )
    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-next", args: { cmd: "npx ph workflow next" } },
      toolOutput("next"),
    )
    await hooks["tool.execute.after"]?.(
      { tool: "edit", sessionID, callID: "call-edit", args: { filePath: "src/App.java" } },
      toolOutput("edited"),
    )

    expect(compliancePayloads().map((payload) => payload.code)).not.toContain(
      "requirements-rail-direct-implementation",
    )
  })

  it("records a WARN when a debug rail edits before reproduction evidence", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-debug-edit"
    await hooks["experimental.chat.messages.transform"]?.({}, modelInputWithText(sessionID, "테스트가 실패해. 고쳐줘"))

    await hooks["tool.execute.after"]?.(
      { tool: "edit", sessionID, callID: "call-edit", args: { filePath: "src/App.java" } },
      toolOutput("edited"),
    )

    expect(compliancePayloads()).toContainEqual(
      expect.objectContaining({
        finding: "WARN",
        code: "debug-rail-edit-without-reproduction",
        primaryIntent: "debug",
      }),
    )
  })

  it("records a WARN when a git rail commits before status and diff", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-git-commit"
    await hooks["experimental.chat.messages.transform"]?.({}, modelInputWithText(sessionID, "커밋해줘"))

    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-commit", args: { cmd: "git commit -m test" } },
      toolOutput("committed"),
    )

    expect(compliancePayloads()).toContainEqual(
      expect.objectContaining({
        finding: "WARN",
        code: "git-rail-mutation-without-status-diff",
        primaryIntent: "git",
      }),
    )
  })

  it("does not warn for git commit after status and diff are observed", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-git-clean"
    await hooks["experimental.chat.messages.transform"]?.({}, modelInputWithText(sessionID, "커밋해줘"))

    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-status", args: { cmd: "git status --short" } },
      toolOutput("status"),
    )
    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-diff", args: { cmd: "git diff --stat" } },
      toolOutput("diff"),
    )
    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-commit", args: { cmd: "git commit -m test" } },
      toolOutput("committed"),
    )

    expect(compliancePayloads().map((payload) => payload.code)).not.toContain(
      "git-rail-mutation-without-status-diff",
    )
  })

  it("records WARN evidence for raw final verification and missing workflow reports", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-finish-warn"
    await hooks["experimental.chat.messages.transform"]?.({}, modelInputWithText(sessionID, "CouponService 만들어줘"))

    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-gradle-test", args: { cmd: "./gradlew test" } },
      toolOutput("BUILD SUCCESSFUL"),
    )
    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-finish", args: { cmd: "npx ph workflow finish implement" } },
      toolOutput("finish"),
    )

    expect(compliancePayloads()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          finding: "WARN",
          code: "raw-final-verification-without-bearshell",
          primaryIntent: "programming",
        }),
        expect.objectContaining({
          finding: "WARN",
          code: "workflow-report-missing",
          primaryIntent: "programming",
        }),
      ]),
    )
  })

  it("does not warn about raw final verification after bearshell verification is observed", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-bearshell-finish"
    await injectRail(sessionID, "CouponService 만들어줘")

    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-raw", args: { cmd: "./gradlew test" } },
      toolOutput("BUILD SUCCESSFUL"),
    )
    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-bearshell", args: { cmd: "npx ph bearshell --shell './gradlew test'" } },
      toolOutput("BUILD SUCCESSFUL"),
    )
    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-finish", args: { cmd: "npx ph workflow finish implement" } },
      toolOutput("finish"),
    )

    expect(compliancePayloads().map((payload) => payload.code)).not.toContain(
      "raw-final-verification-without-bearshell",
    )
  })

  it("accepts report status frontmatter when checking missing workflow reports", async () => {
    const workflowDir = join(fixtureWorkspace, ".persona", "workflow")
    mkdirSync(workflowDir, { recursive: true })
    writeFileSync(
      join(workflowDir, "implementation-report.md"),
      ["---", "status: filled", "---", "# Implementation Report", ""].join("\n"),
    )
    writeFileSync(join(workflowDir, "review-report.md"), ["---", "status: filled", "---", "# Review Report", ""].join("\n"))
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-finish-frontmatter-reports"
    await injectRail(sessionID, "CouponService 만들어줘")

    await hooks["tool.execute.after"]?.(
      { tool: "shell", sessionID, callID: "call-finish", args: { cmd: "npx ph workflow finish implement" } },
      toolOutput("finish"),
    )

    expect(compliancePayloads().map((payload) => payload.code)).not.toContain("workflow-report-missing")
  })
})
