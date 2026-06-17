import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/phase0/hooks.js"
import type { TransformMessagesOutput } from "../src/phase0/types.js"

const fixtureRoot = join(process.cwd(), ".persona-test-fixtures", "src", "main", "java", "com", "example")

function fixturePath(fileName: string): string {
  mkdirSync(fixtureRoot, { recursive: true })
  const path = join(fixtureRoot, fileName)
  writeFileSync(path, "class Placeholder {}\n")
  return path
}

function modelInput(sessionID: string): TransformMessagesOutput {
  const message: UserMessage = {
    id: "msg-1",
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
    id: "part-1",
    sessionID,
    messageID: message.id,
    type: "text",
    text: "예약 생성 API 추가해줘.",
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

describe("Phase 0 OpenCode hook feasibility", () => {
  it("captures a Controller target file and injects the block into the next model input", async () => {
    const hooks = createPhase0Hooks()
    const sessionID = "session-controller"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.before"]?.(
      { tool: "edit", sessionID, callID: "call-1" },
      { args: { filePath: targetFile } },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Injection]")
    expect(text).toContain(`현재 파일: ${targetFile}`)
    expect(text).toContain("파일 역할: controller")
    expect(text).toContain("Controller에는 비즈니스 로직을 넣지 않는다.")
    expect(text).toContain("1단계 예약 추가 요청 본문은 반드시 name, date, time이다.")
    expect(text).toContain("예약 생성 API 추가해줘.")
  })

  it("selects a service-specific injection block for Service files", async () => {
    const hooks = createPhase0Hooks()
    const sessionID = "session-service"
    const targetFile = fixturePath("ReservationService.java")

    await hooks["tool.execute.before"]?.(
      { tool: "write", sessionID, callID: "call-2" },
      { args: { path: targetFile } },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("파일 역할: service")
    expect(text).toContain("@Transactional 경계는 Service public 메서드 기준으로 둔다.")
  })

  it("selects an entity-specific injection block for Entity files", async () => {
    const hooks = createPhase0Hooks()
    const sessionID = "session-entity"
    const targetFile = fixturePath("ReservationEntity.java")

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "call-3", args: { targetFile } },
      { title: "read", output: "", metadata: {} },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("파일 역할: entity")
    expect(text).toContain("Entity는 setter를 열지 않는다.")
  })

  it("appends the injection block to read tool output so the same model turn can see it", async () => {
    const hooks = createPhase0Hooks()
    const sessionID = "session-tool-output"
    const targetFile = fixturePath("ReservationController.java")
    const output = { title: "read", output: "class ReservationController {}", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "call-4", args: { filePath: targetFile } },
      output,
    )

    expect(output.output).toContain("class ReservationController {}")
    expect(output.output).toContain("[Persona Harness Injection]")
    expect(output.output).toContain("파일 역할: controller")
  })
})
