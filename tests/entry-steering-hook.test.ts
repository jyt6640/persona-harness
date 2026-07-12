import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import type { TransformMessagesOutput } from "../src/runtime/types.js"

const projectDir = join(process.cwd(), ".entry-steering-hook-fixture")

function output(sessionID: string, text: string): TransformMessagesOutput {
  const message: UserMessage = {
    id: `message-${sessionID}`,
    sessionID,
    role: "user",
    time: { created: 1 },
    agent: "build",
    model: { providerID: "test", modelID: "test" },
  }
  const part: Part = {
    id: `part-${sessionID}`,
    messageID: message.id,
    sessionID,
    text,
    type: "text",
  }
  return { messages: [{ info: message, parts: [part] }] }
}

function text(value: TransformMessagesOutput): string {
  const part = value.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

function configure(features: { readonly entrySteering: boolean; readonly runtimeInjection: boolean }): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({ features }, null, 2)}\n`)
}

function statusPayloads(): readonly Record<string, unknown>[] {
  const directory = join(projectDir, ".persona", "evidence", "entry-steering")
  if (!existsSync(directory)) {
    return []
  }
  return readdirSync(directory).map((file) =>
    JSON.parse(readFileSync(join(directory, file), "utf8")) as Record<string, unknown>,
  )
}

function statusFiles(): readonly string[] {
  const directory = join(projectDir, ".persona", "evidence", "entry-steering")
  return existsSync(directory) ? readdirSync(directory).sort() : []
}

function statusFileFor(sessionID: string): string {
  return `${createHash("sha256").update(sessionID).digest("hex").slice(0, 16)}.json`
}

beforeEach(() => {
  rmSync(projectDir, { force: true, recursive: true })
})

afterEach(() => {
  rmSync(projectDir, { force: true, recursive: true })
})

describe("entry steering OpenCode hook", () => {
  it("is a default-off no-op with no status write", async () => {
    configure({ entrySteering: false, runtimeInjection: false })
    const value = output("off-session", "회원 API 구현해줘")

    await createPhase0Hooks({ projectDir })["experimental.chat.messages.transform"]?.({}, value)

    expect(text(value)).toBe("회원 API 구현해줘")
    expect(statusPayloads()).toEqual([])
  })

  it("injects one advisory on the first positive message independently of runtimeInjection", async () => {
    configure({ entrySteering: true, runtimeInjection: false })
    const hooks = createPhase0Hooks({ projectDir })
    const first = output("once-session", "회원 API 구현해줘")
    const second = output("once-session", "다른 서비스도 만들어줘")

    await hooks["experimental.chat.messages.transform"]?.({}, first)
    await hooks["experimental.chat.messages.transform"]?.({}, second)

    expect(text(first)).toContain("Implementation intent detected")
    expect(text(first)).toContain("npx ph go")
    expect(text(second)).toBe("다른 서비스도 만들어줘")
    expect(statusPayloads()).toHaveLength(1)
    expect(statusPayloads()[0]).toEqual(expect.objectContaining({ fired: true, decision: "detected" }))
  })

  it("evaluates and annotates the first user message when history is already present", async () => {
    configure({ entrySteering: true, runtimeInjection: false })
    const first = output("history-session", "회원 API 구현해줘")
    const later = output("history-session", "고마워")
    const history: TransformMessagesOutput = { messages: [...first.messages, ...later.messages] }

    await createPhase0Hooks({ projectDir })["experimental.chat.messages.transform"]?.({}, history)

    const firstPart = history.messages[0]?.parts[0]
    const laterPart = history.messages[1]?.parts[0]
    expect(firstPart?.type === "text" ? firstPart.text : "").toContain("Implementation intent detected")
    expect(laterPart?.type === "text" ? laterPart.text : "").toBe("고마워")
  })

  it("partitions mixed history and records only the latest selected session", async () => {
    configure({ entrySteering: true, runtimeInjection: false })
    const earlier = output("session-a", "회원 API 구현해줘")
    const active = output("session-b", "코드 설명해줘")
    const mixed: TransformMessagesOutput = { messages: [...earlier.messages, ...active.messages] }

    await createPhase0Hooks({ projectDir })["experimental.chat.messages.transform"]?.({}, mixed)

    expect(text(earlier)).toBe("회원 API 구현해줘")
    expect(text(active)).toBe("코드 설명해줘")
    expect(statusFiles()).toEqual([statusFileFor("session-b")])
    expect(statusPayloads()[0]).toEqual(expect.objectContaining({ decision: "not-detected", fired: false }))
  })

  it("annotates the selected session first message without crossing interleaved sessions", async () => {
    configure({ entrySteering: true, runtimeInjection: false })
    const sessionAFirst = output("session-a", "회원 API 구현해줘")
    const sessionBFirst = output("session-b", "결제 서비스 만들어줘")
    const sessionALater = output("session-a", "고마워")
    const sessionBLatest = output("session-b", "진행 상태 알려줘")
    const mixed: TransformMessagesOutput = {
      messages: [
        ...sessionAFirst.messages,
        ...sessionBFirst.messages,
        ...sessionALater.messages,
        ...sessionBLatest.messages,
      ],
    }

    await createPhase0Hooks({ projectDir })["experimental.chat.messages.transform"]?.({}, mixed)

    expect(text(sessionAFirst)).toBe("회원 API 구현해줘")
    expect(text(sessionBFirst)).toContain("Implementation intent detected")
    expect(text(sessionALater)).toBe("고마워")
    expect(text(sessionBLatest)).toBe("진행 상태 알려줘")
    expect(statusFiles()).toEqual([statusFileFor("session-b")])
  })

  it("emits one advisory and one status for simultaneous same-session calls", async () => {
    configure({ entrySteering: true, runtimeInjection: false })
    const hooks = createPhase0Hooks({ projectDir })
    const left = output("parallel-session", "회원 API 구현해줘")
    const right = output("parallel-session", "결제 서비스 만들어줘")

    await Promise.all([
      hooks["experimental.chat.messages.transform"]?.({}, left),
      hooks["experimental.chat.messages.transform"]?.({}, right),
    ])

    const firedCount = [text(left), text(right)].filter((value) => value.includes("Entry Steering")).length
    expect(firedCount).toBe(1)
    expect(statusFiles()).toEqual([statusFileFor("parallel-session")])
    expect(JSON.stringify(statusPayloads())).not.toContain("parallel-session")
  })

  it("records a bounded not-fired decision without raw prompt or session id", async () => {
    configure({ entrySteering: true, runtimeInjection: false })
    const value = output("private-session-secret", "secret-token-123 코드 설명해줘")

    await createPhase0Hooks({ projectDir })["experimental.chat.messages.transform"]?.({}, value)

    expect(text(value)).toBe("secret-token-123 코드 설명해줘")
    const serialized = JSON.stringify(statusPayloads())
    expect(serialized).toContain('"fired":false')
    expect(serialized).not.toContain("secret-token-123")
    expect(serialized).not.toContain("private-session-secret")
    expect(serialized.length).toBeLessThan(1024)
  })

  it("does not activate from runtimeInjection alone", async () => {
    configure({ entrySteering: false, runtimeInjection: true })
    const value = output("separate-session", "회원 API 구현해줘")

    await createPhase0Hooks({ projectDir })["experimental.chat.messages.transform"]?.({}, value)

    expect(text(value)).not.toContain("Implementation intent detected")
    expect(statusPayloads()).toEqual([])
  })
})
