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

async function transformWithHooks(
  hooks: ReturnType<typeof createPhase0Hooks>,
  sessionID: string,
  text: string,
): Promise<string> {
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
  it("advises a one-question product interview without creating workflow or evidence state before approval", async () => {
    writeFileSync(
      join(fixtureWorkspace, ".persona", "harness.jsonc"),
      `${JSON.stringify({ features: { entrySteering: true, runtimeInjection: true }, enabledDomains: ["workflow", "product"] }, null, 2)}\n`,
    )
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    const first = await transformWithHooks(hooks, "session-product-interview", "동네 기술 교환 서비스를 만들고 싶어")
    expect(first).toContain("[Persona Harness Product Interview]")
    expect(first).toContain("Question:")
    expect(first).toContain("Recommendation:")
    expect(first).toContain("Decision: activate")
    expect(first).not.toContain("npx ph workflow")
    expect(existsSync(join(fixtureWorkspace, ".persona", "workflow"))).toBe(false)
    expect(existsSync(join(fixtureWorkspace, ".persona", "evidence"))).toBe(false)

    const second = await transformWithHooks(hooks, "session-product-interview", "동네에서 서로 도움을 주고받고 싶은 사람들")
    expect(second).toContain("Question:")
    expect(second).not.toContain("Question:\n\nQuestion:")
    expect(second).not.toContain("npx ph workflow")
    expect(existsSync(join(fixtureWorkspace, ".persona", "workflow"))).toBe(false)
    expect(existsSync(join(fixtureWorkspace, ".persona", "evidence"))).toBe(false)
  })

  it("selects code-first brownfield discovery when the project already has source", async () => {
    mkdirSync(join(fixtureWorkspace, "src"), { recursive: true })
    writeFileSync(join(fixtureWorkspace, "src", "existing.ts"), "export const existing = true\n", { encoding: "utf8", flag: "w" })
    writeFileSync(
      join(fixtureWorkspace, ".persona", "harness.jsonc"),
      `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["product"] }, null, 2)}\n`,
    )
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    const text = await transformWithHooks(hooks, "session-product-brownfield", "I want to improve an existing booking flow")

    expect(text).toContain("Mode: brownfield-change-discovery")
    expect(text).toContain("Read relevant existing code before asking for facts it already answers")
    expect(existsSync(join(fixtureWorkspace, ".persona", "workflow"))).toBe(false)
    expect(existsSync(join(fixtureWorkspace, ".persona", "evidence"))).toBe(false)
  })

  it("keeps a broken brownfield flow on the debug route instead of starting product discovery", async () => {
    writeFileSync(
      join(fixtureWorkspace, ".persona", "harness.jsonc"),
      `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["workflow", "product"] }, null, 2)}\n`,
    )
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })

    const text = await transformWithHooks(
      hooks,
      "session-product-debug-conflict",
      "I want to improve an existing booking flow that fails for users",
    )

    expect(text).toContain("[Persona Harness Debug Workflow]")
    expect(text).not.toContain("[Persona Harness Product Interview]")
    expectIntentEvidence("debug", "[Persona Harness Debug Workflow]")
  })

  it("routes explicit prompt requirements to an advisory delivery-plan route", async () => {
    const text = await transformPrompt("session-draft", "기능 요구사항을 구현해줘")

    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("Skill: plan")
    expect(text).toContain("Decision: activate")
    expect(text).toContain("does not create plans, tickets, branches, files, agents, or workflow state")
    expect(text).not.toContain("npx ph workflow")
    expect(text).not.toContain("[Persona Harness Programming Workflow]")
    expectIntentEvidence("requirements", "[Persona Harness Requirements Workflow]")
    expect(intentEvidencePayloads()).toContainEqual(
      expect.objectContaining({
        requirementsIntent: expect.objectContaining({
          kind: "requirement-implementation",
          source: "prompt",
        }),
      }),
    )
  })

  it("renders only a compact explicit catalog reference and leaves ordinary turns untouched", async () => {
    const explicit = await transformPrompt("session-explicit-frontend", "/persona frontend review the booking screen")
    const explicitInterview = await transformPrompt("session-explicit-interview", "/persona deep-interview explore a booking product")
    const ordinary = await transformPrompt("session-ordinary", "hello there")

    expect(explicit).toContain("[Persona Harness Skill Activation]")
    expect(explicit).toContain("Decision: explicit")
    expect(explicit).toContain("Skill: frontend")
    expect(explicit).toContain("Reference: packages/shared-skills/skills/frontend/SKILL.md")
    expect(explicit).not.toContain("# Frontend")
    expect(explicit).not.toContain("npx ph workflow")
    expect(explicitInterview).toContain("[Persona Harness Skill Activation]")
    expect(explicitInterview).toContain("Decision: explicit")
    expect(explicitInterview).toContain("Skill: deep-interview")
    expect(explicitInterview).not.toContain("Question:")
    expect(explicitInterview).not.toContain("npx ph workflow")
    expect(ordinary).toBe("hello there")
  })

  it("routes approved prompt requirements to an explicit advisory plan handoff only when a draft exists", async () => {
    mkdirSync(join(fixtureWorkspace, ".persona", "workflow", "requirements"), { recursive: true })
    writeFileSync(join(fixtureWorkspace, ".persona", "workflow", "requirements", "backlog.md"), "Status: draft\n")

    const text = await transformPrompt("session-approval", "진행하자")

    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-approval")
    expect(text).toContain("Skill: plan")
    expect(text).toContain("Decision: explicit")
    expect(text).not.toContain("npx ph workflow")
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

  it("routes direct implementation requests to an advisory programming route with profile read guard", async () => {
    const text = await transformPrompt("session-programming", "CouponService 만들어줘")

    expect(text).toContain("[Persona Harness Programming Workflow]")
    expect(text).toContain("Detected intent: programming")
    expect(text).toContain("Skill: programming")
    expect(text).toContain("if `.persona/project-profile.jsonc` exists, read it")
    expect(text).toContain("If the profile exists but has not been read yet")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
    expectIntentEvidence("programming", "[Persona Harness Programming Workflow]")
  })

  it("routes README implementation requests to an advisory plan route with profile read guard", async () => {
    const text = await transformPrompt("session-readme", "README.md 구현해줘")

    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("Skill: plan")
    expect(text).not.toContain("npx ph workflow")
    expect(text).toContain("if `.persona/project-profile.jsonc` exists, read it")
    expect(text).not.toContain("[Persona Harness Programming Workflow]")
    expectIntentEvidence("requirements", "[Persona Harness Requirements Workflow]")
  })

  it.each([
    {
      prompt: "테스트가 실패해. 고쳐줘",
      primaryIntent: "debug",
      railMarker: "[Persona Harness Debug Workflow]",
      skill: "debug",
    },
    {
      prompt: "이 코드 냉정하게 리뷰해줘",
      primaryIntent: "review",
      railMarker: "[Persona Harness Review Workflow]",
      skill: "review",
    },
    {
      prompt: "구조 정리해줘",
      primaryIntent: "refactor",
      railMarker: "[Persona Harness Refactor Workflow]",
      skill: "refactor",
    },
    {
      prompt: "커밋하고 푸쉬해",
      primaryIntent: "git",
      railMarker: "[Persona Harness Git Workflow]",
      skill: "git",
    },
  ] as const)("routes $primaryIntent intent before programming at the hook boundary", async (example) => {
    const text = await transformPrompt(`session-${example.primaryIntent}`, example.prompt)

    expect(text).toContain(example.railMarker)
    expect(text).toContain(`Skill: ${example.skill}`)
    expect(text).toContain("OpenCode advises and routes only")
    expect(text).not.toContain("[Persona Harness Programming Workflow]")
    expectIntentEvidence(example.primaryIntent, example.railMarker)
  })
})
