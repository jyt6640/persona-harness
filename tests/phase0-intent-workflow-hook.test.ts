import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { TopLevelIntentKind } from "../src/runtime/top-level-intent-router.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"

const fixtureWorkspace = join(process.cwd(), ".persona-intent-workflow-hook-fixtures")

beforeEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
  mkdirSync(join(fixtureWorkspace, ".persona"), { recursive: true })
  writeFileSync(
    join(fixtureWorkspace, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
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

function firstText(output: TransformMessagesOutput): string {
  const part = output.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function intentEvidencePayloads(): readonly Record<string, unknown>[] {
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
    .filter((payload) => payload.schemaVersion === "phase0.intent.1")
}

async function transformPrompt(sessionID: string, text: string): Promise<string> {
  const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
  const output = modelInputWithText(sessionID, text)

  await hooks["experimental.chat.messages.transform"]?.({}, output)

  return firstText(output)
}

function expectIntentEvidence(primaryIntent: TopLevelIntentKind, railMarker: string): void {
  expect(intentEvidencePayloads()).toContainEqual(
    expect.objectContaining({
      hook: "experimental.chat.messages.transform",
      injectedInto: "intent-workflow",
      primaryIntent,
      railMarker,
    }),
  )
}

describe("intent workflow hook boundary", () => {
  it("routes prompt-only product ideas to requirements draft rail", async () => {
    const text = await transformPrompt("session-draft", "TODO 웹 서비스 만들래")

    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-drafting")
    expect(text).toContain("draft/review-before-implementation")
    expect(text).toContain("npx ph workflow draft --stdin")
    expect(text).not.toContain("[Persona Harness Programming Workflow]")
    expectIntentEvidence("requirements", "[Persona Harness Requirements Workflow]")
    expect(intentEvidencePayloads()).toContainEqual(
      expect.objectContaining({
        requirementsIntent: expect.objectContaining({
          kind: "requirement-drafting",
          source: "prompt",
        }),
      }),
    )
  })

  it("routes approved prompt requirements draft to approval rail only when a draft exists", async () => {
    mkdirSync(join(fixtureWorkspace, ".persona", "workflow", "requirements"), { recursive: true })
    writeFileSync(join(fixtureWorkspace, ".persona", "workflow", "requirements", "backlog.md"), "Status: draft\n")

    const text = await transformPrompt("session-approval", "진행하자")

    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-approval")
    expect(text).toContain("npx ph workflow approve requirements")
    expect(text).toContain("npx ph workflow next")
    expectIntentEvidence("requirements", "[Persona Harness Requirements Workflow]")
    expect(intentEvidencePayloads()).toContainEqual(
      expect.objectContaining({
        requirementsIntent: expect.objectContaining({
          kind: "requirement-approval",
          source: "workflow",
        }),
      }),
    )
  })

  it("routes direct implementation requests to programming rail with profile read guard", async () => {
    const text = await transformPrompt("session-programming", "CouponService 만들어줘")

    expect(text).toContain("[Persona Harness Programming Workflow]")
    expect(text).toContain("Detected intent: programming")
    expect(text).toContain("`.persona/project-profile.jsonc`가 있으면 반드시 읽고")
    expect(text).toContain("profile이 존재하지만 아직 읽지 않았다면 구현하지 말고")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
    expectIntentEvidence("programming", "[Persona Harness Programming Workflow]")
  })

  it("routes README implementation requests to requirements rail with profile read guard", async () => {
    const text = await transformPrompt("session-readme", "README.md 구현해줘")

    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("npx ph workflow split README.md")
    expect(text).toContain("`.persona/project-profile.jsonc`가 있으면 반드시 읽고")
    expect(text).not.toContain("[Persona Harness Programming Workflow]")
    expectIntentEvidence("requirements", "[Persona Harness Requirements Workflow]")
  })

  it.each([
    {
      prompt: "테스트가 실패해. 고쳐줘",
      primaryIntent: "debug",
      railMarker: "[Persona Harness Debug Workflow]",
      phrase: "실패를 먼저 재현한다",
    },
    {
      prompt: "이 코드 냉정하게 리뷰해줘",
      primaryIntent: "review",
      railMarker: "[Persona Harness Review Workflow]",
      phrase: "Findings를 먼저 쓴다",
    },
    {
      prompt: "구조 정리해줘",
      primaryIntent: "refactor",
      railMarker: "[Persona Harness Refactor Workflow]",
      phrase: "public behavior를 먼저 고정한다",
    },
    {
      prompt: "커밋하고 푸쉬해",
      primaryIntent: "git",
      railMarker: "[Persona Harness Git Workflow]",
      phrase: "관련 파일만 stage",
    },
  ] as const)("routes $primaryIntent intent before programming at the hook boundary", async (example) => {
    const text = await transformPrompt(`session-${example.primaryIntent}`, example.prompt)

    expect(text).toContain(example.railMarker)
    expect(text).toContain(example.phrase)
    expect(text).not.toContain("[Persona Harness Programming Workflow]")
    expectIntentEvidence(example.primaryIntent, example.railMarker)
  })
})
