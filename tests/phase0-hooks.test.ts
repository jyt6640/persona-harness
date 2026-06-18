import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/phase0/hooks.js"
import { createInjectionBlock } from "../src/phase0/injection.js"
import { loadRulesForRole } from "../src/phase0/rule-loader.js"
import type { FileRole, TransformMessagesOutput } from "../src/phase0/types.js"

const fixtureRoot = join(process.cwd(), ".persona-test-fixtures", "src", "main", "java", "com", "example")
const fixtureWorkspace = join(process.cwd(), ".persona-test-fixtures")
const baseJavaRules = ["clean-code/common.md", "clean-code/method-design.md", "backend/java-common.md"] as const
const javaSpringRoles = [
  "controller",
  "service",
  "repository",
  "entity",
  "domain",
  "request-dto",
  "response-dto",
  "exception",
  "test",
  "java-common",
] as const satisfies readonly FileRole[]

beforeEach(() => {
  rmSync(fixtureWorkspace, { recursive: true, force: true })
})

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

function writeScenario(scenario: "step1" | "step2-3"): void {
  mkdirSync(join(fixtureWorkspace, ".persona"), { recursive: true })
  writeFileSync(join(fixtureWorkspace, ".persona", "harness.jsonc"), `${JSON.stringify({ scenario }, null, 2)}\n`)
}

function selectedRulePaths(role: Parameters<typeof loadRulesForRole>[1], scenario: "step1" | "step2-3"): string[] {
  writeScenario(scenario)
  return loadRulesForRole(fixtureWorkspace, role).map((rule) => rule.path)
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
    expect(text).toContain("선택 규칙:")
    expect(text).toContain("backend/spring-controller.md")
    expect(text).toContain("backend/step1-api-contract.md")
    expect(text).toContain(
      "Controller에는 Repository 의존성, Map/List 저장 상태, id sequence, 저장소 구현 세부사항을 넣지 않는다.",
    )
    expect(text).toContain("GET /reservations는 200 OK와 예약 목록을 반환하고, 생성 전 목록 크기는 0이어야 한다.")
    expect(text).toContain("POST /reservations는 200 OK를 반환한다. 201 Created는 이 단계에서 오답이며")
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
    expect(text).toContain("Controller가 아니라 Service가 Repository를 호출하고, 생성/조회/삭제 흐름을 조율한다.")
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

  it("keeps the step1 API contract selected for step1 Controller and Test fixtures", () => {
    expect(selectedRulePaths("controller", "step1")).toContain("backend/step1-api-contract.md")
    expect(selectedRulePaths("test", "step1")).toContain("backend/step1-api-contract.md")
  })

  it("keeps step1 Controller and Test contract rules exclusive", () => {
    const controllerRules = selectedRulePaths("controller", "step1")
    const testRules = selectedRulePaths("test", "step1")

    expect(controllerRules).toContain("backend/step1-api-contract.md")
    expect(controllerRules).not.toContain("backend/step2-3-api-contract.md")
    expect(testRules).toContain("backend/step1-api-contract.md")
    expect(testRules).not.toContain("backend/step2-3-api-contract.md")
  })

  it("selects the step2-3 API contract instead of step1 for step2-3 Controller, Test, and DTO fixtures", () => {
    for (const role of ["controller", "test", "request-dto", "response-dto"] as const) {
      const rules = selectedRulePaths(role, "step2-3")

      expect(rules).toContain("backend/step2-3-api-contract.md")
      expect(rules).not.toContain("backend/step1-api-contract.md")
    }
  })

  it("keeps step2-3 Controller, Test, and DTO contract rules exclusive", () => {
    for (const role of ["controller", "test", "request-dto", "response-dto"] as const) {
      const rules = selectedRulePaths(role, "step2-3")

      expect(rules).toContain("backend/step2-3-api-contract.md")
      expect(rules).not.toContain("backend/step1-api-contract.md")
    }
  })

  it("keeps Java/Spring base rules selected for every Java role", () => {
    for (const role of javaSpringRoles) {
      const rules = selectedRulePaths(role, "step1")

      expect(rules).toEqual(expect.arrayContaining([...baseJavaRules]))
    }
  })

  it("keeps the injection block section format stable", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.block).toContain("[Persona Harness Injection]")
    expect(injection.block).toContain(`현재 파일: ${targetFile}`)
    expect(injection.block).toContain("파일 역할: controller")
    expect(injection.block).toContain("선택 규칙:")
    expect(injection.block).toContain("적용 정책:")
    expect(injection.block).toContain("주의:")
  })

  it("keeps selectedRules evidence as rule path strings", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.selectedRules.length).toBeGreaterThan(0)
    expect(injection.selectedRules.every((rulePath) => typeof rulePath === "string")).toBe(true)
    expect(injection.selectedRules).toContain("backend/step1-api-contract.md")
  })
})
