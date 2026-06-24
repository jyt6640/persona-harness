import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { createInjectionBlock } from "../src/runtime/injection.js"
import { loadRulesForRole } from "../src/rules/rule-loader.js"
import type { FileRole, TransformMessagesOutput } from "../src/runtime/types.js"

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

function fixturePathFromWorkspace(relativePath: string): string {
  const path = join(fixtureWorkspace, ...relativePath.split("/"))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, "class Placeholder {}\n")
  return path
}

function roomescapeFixturePath(fileName: string): string {
  return fixturePathFromWorkspace(`src/main/java/roomescape/${fileName}`)
}

function modelInput(sessionID: string): TransformMessagesOutput {
  return modelInputWithText(sessionID, "예약 생성 API 추가해줘.")
}

function modelInputWithText(sessionID: string, text: string): TransformMessagesOutput {
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

function writeOptInHarnessConfig(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enabledDomains: ["backend", "programming", "workflow"] }, null, 2)}\n`,
  )
}

function firstText(output: TransformMessagesOutput): string {
  const part = output.messages[0]?.parts[0]
  return part?.type === "text" ? part.text : ""
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function evidencePayloads(projectDir: string): readonly Record<string, unknown>[] {
  const evidenceDir = join(projectDir, ".persona", "evidence", "phase0")
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
}

function writeScenario(scenario: "step1" | "step2-3"): void {
  mkdirSync(join(fixtureWorkspace, ".persona"), { recursive: true })
  writeFileSync(join(fixtureWorkspace, ".persona", "harness.jsonc"), `${JSON.stringify({ scenario }, null, 2)}\n`)
}

function selectedRulePaths(
  role: Parameters<typeof loadRulesForRole>[1],
  scenario: "step1" | "step2-3",
  targetFile?: string,
): string[] {
  writeScenario(scenario)
  return loadRulesForRole(fixtureWorkspace, role, targetFile).map((rule) => rule.path)
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
    expect(text).toContain(
      "Java/Spring 프로젝트는 Gradle을 기본 빌드 도구로 사용하고 Maven 파일을 생성하지 않으며, Spring Boot main application class는 root package에 하나만 두고 feature/domain package 아래에 추가 *Application.java를 만들지 않는다.",
    )
    expect(text).toContain(
      "presentation → application → domain 흐름을 기본으로 두고, infrastructure는 domain을 사용할 수 있지만 domain은 infrastructure를 알지 않는다.",
    )
    expect(text).toContain(
      "Controller에는 Repository 의존성, Map/List 저장 상태, id sequence, 저장소 구현 세부사항을 넣지 않는다.",
    )
    expect(text).toContain(
      "Controller/Service response path는 domain entity를 직접 외부 응답으로 노출하지 않고 Response DTO boundary를 둔다.",
    )
    expect(text).toContain("API 경로, 메서드, status code, request body, response body는 요구사항의 외부 계약을 그대로")
    expect(text).not.toContain("backend/step1-api-contract.md")
    expect(text).not.toContain("201 Created는 이 단계에서 오답")
    expect(text).toContain("예약 생성 API 추가해줘.")
  })

  it("injects requirements workflow guidance for README implementation requests in opt-in projects", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-readme-workflow"
    const output = modelInputWithText(sessionID, "README.md 구현해줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("의도 감지: README.md 기반 구현 요청으로 판단함.")
    expect(text).toContain("다음 행동: 요구사항 파일을 ticket backlog로 나눈 뒤 현재 ticket만 구현한다.")
    expect(text).toContain("npx ph bearshell")
    expect(text).toContain("npx ph workflow split README.md")
    expect(text).toContain("npx ph workflow next")
    expect(text).toContain("npx ph workflow finish implement")
  })

  it("routes Korean readme implementation phrasing through the requirements workflow", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-korean-readme-workflow"
    const output = modelInputWithText(sessionID, "리드미 보고 구현할래")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("의도 감지: README.md 기반 구현 요청으로 판단함.")
    expect(text).toContain("다음 행동: 요구사항 파일을 ticket backlog로 나눈 뒤 현재 ticket만 구현한다.")
    expect(text).toContain("요구사항 파일: `README.md`")
    expect(text).toContain("npx ph workflow split README.md")
    expect(text).toContain("split/next 전에는 production code를 작성하지 않는다")
    expect(text).toContain("현재 task card만 구현")
  })

  it("routes README bug reports through the debug workflow instead of requirements implementation", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-readme-debug-workflow"
    const output = modelInputWithText(sessionID, "README 보고 구현했는데 테스트가 실패해. 고쳐줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Debug Workflow]")
    expect(text).toContain("Detected intent: debug")
    expect(text).toContain("의도 감지: 디버그 요청으로 판단함.")
    expect(text).toContain("실패를 먼저 재현한다")
    expect(text).toContain("최소 3개 가설")
    expect(text).toContain("확인된 원인만 수정한다")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
  })

  it("routes review requests through the review workflow without implementation", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-review-workflow"
    const output = modelInputWithText(sessionID, "이 코드 냉정하게 리뷰해줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Review Workflow]")
    expect(text).toContain("Detected intent: review")
    expect(text).toContain("의도 감지: 리뷰 요청으로 판단함.")
    expect(text).toContain("수정하지 않는다")
    expect(text).toContain("Findings를 먼저 쓴다")
    expect(text).toContain("파일/라인/증거/영향")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
    expect(text).not.toContain("[Persona Harness Debug Workflow]")
  })

  it("routes refactor requests through the refactor workflow without implementation or debug rails", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-refactor-workflow"
    const output = modelInputWithText(sessionID, "구조 정리해줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Refactor Workflow]")
    expect(text).toContain("Detected intent: refactor")
    expect(text).toContain("의도 감지: 리팩터링 요청으로 판단함.")
    expect(text).toContain("public behavior를 먼저 고정한다")
    expect(text).toContain("기능을 추가하지 않는다")
    expect(text).toContain("같은 테스트/빌드/스모크")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
    expect(text).not.toContain("[Persona Harness Debug Workflow]")
    expect(text).not.toContain("[Persona Harness Review Workflow]")
  })

  it("routes git-only requests through the git workflow", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-git-workflow"
    const output = modelInputWithText(sessionID, "커밋하고 푸쉬해")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Git Workflow]")
    expect(text).toContain("Detected intent: git")
    expect(text).toContain("의도 감지: git 작업 요청으로 판단함.")
    expect(text).toContain("관련 파일만 stage")
    expect(text).toContain("push는 사용자가 명시적으로 요청한 경우에만")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
    expect(text).not.toContain("[Persona Harness Debug Workflow]")
    expect(text).not.toContain("[Persona Harness Review Workflow]")
    expect(text).not.toContain("[Persona Harness Refactor Workflow]")
  })

  it("records intent evidence when a workflow rail is injected", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-intent-evidence"
    const output = modelInputWithText(sessionID, "구조 정리해줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const intentEvidence = evidencePayloads(fixtureWorkspace).find(
      (payload) => payload.schemaVersion === "phase0.intent.1",
    )
    expect(intentEvidence).toMatchObject({
      hook: "experimental.chat.messages.transform",
      sessionID,
      injectedInto: "intent-workflow",
      userPrompt: "구조 정리해줘",
      primaryIntent: "refactor",
      railMarker: "[Persona Harness Refactor Workflow]",
    })
    expect(intentEvidence?.secondaryIntents).toEqual(["programming"])
  })

  it("injects prompt capture guidance for pasted requirement implementation requests", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-prompt-workflow"
    const output = modelInputWithText(sessionID, "이 요구사항대로 장비 대여 API 만들어줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("의도 감지: 프롬프트 기반 요구사항 구현 요청으로 판단함.")
    expect(text).toContain("다음 행동: 프롬프트를 요구사항 source로 저장하고 ticket backlog를 만든 뒤 현재 ticket만 구현한다.")
    expect(text).toContain("npx ph workflow capture --stdin")
    expect(text).toContain("npx ph workflow split")
    expect(text).toContain("현재 task card만 구현")
  })

  it("injects requirements draft guidance for vague product ideas without implementation", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-draft-workflow"
    const output = modelInputWithText(sessionID, "TODO 웹 서비스 만들래")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-drafting")
    expect(text).toContain("의도 감지: 제품 아이디어 초안 작성 요청으로 판단함.")
    expect(text).toContain("다음 행동: 구현하지 않고 requirements draft를 작성한 뒤 사용자 검토를 기다린다.")
    expect(text).toContain("npx ph workflow draft --stdin")
    expect(text).toContain("구현하지 않는다")
    expect(text).toContain("Say `진행하자`")
    expect(text).not.toContain("npx ph workflow split README.md")
  })

  it("injects requirements approval guidance only when a draft backlog exists", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    mkdirSync(join(fixtureWorkspace, ".persona", "workflow", "requirements"), { recursive: true })
    writeFileSync(join(fixtureWorkspace, ".persona", "workflow", "requirements", "backlog.md"), "Status: draft\n")
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-approve-workflow"
    const output = modelInputWithText(sessionID, "진행하자")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-approval")
    expect(text).toContain("의도 감지: 요구사항 draft 승인 요청으로 판단함.")
    expect(text).toContain("다음 행동: draft를 승인하고 ticket backlog를 만든 뒤 첫 ticket으로 이동한다.")
    expect(text).toContain("npx ph workflow approve requirements")
    expect(text).toContain("npx ph workflow split .persona/workflow/requirements/backlog.md")
    expect(text).toContain("npx ph workflow implement")
  })

  it("does not route bare approval words when no requirements draft exists", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-approve-without-draft"
    const output = modelInputWithText(sessionID, "진행하자")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).not.toContain("[Persona Harness Requirements Workflow]")
  })

  it("injects continuation guidance for Step continuation requests", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-continue-workflow"
    const output = modelInputWithText(sessionID, "Step 2 이어서 해줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-continuation")
    expect(text).toContain("의도 감지: 이어서 진행 요청으로 판단함.")
    expect(text).toContain("다음 행동: 다음 pending ticket을 확인하고 현재 ticket만 이어서 진행한다.")
    expect(text).toContain("npx ph workflow next")
    expect(text).toContain("npx ph workflow continue")
  })

  it("does not over-route explanation or debugging requests to requirements workflow", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    for (const request of ["이 코드 설명해줘", "버그 원인 분석해줘"]) {
      const output = modelInputWithText(`session-non-requirement-${request}`, request)

      await hooks["experimental.chat.messages.transform"]?.({}, output)

      expect(firstText(output)).not.toContain("[Persona Harness Requirements Workflow]")
    }
  })

  it("does not inject requirements workflow guidance before Persona Harness opt-in", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-no-opt-in"
    const output = modelInputWithText(sessionID, "README.md 구현해줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).not.toContain("[Persona Harness Requirements Workflow]")
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
    expect(text).toContain(
      "Application Service는 비즈니스/use-case 흐름을 조율하고 저장소 구현 세부사항을 직접 소유하지 않는다.",
    )
    expect(text).toContain(
      "Service는 List, Map, AtomicLong, nextId, idCounter, sequence 같은 저장소 상태나 id sequence를 직접 소유하지 않는다.",
    )
    expect(text).toContain(
      "Service response path는 저장 결과를 domain entity 그대로 노출하지 않고 Response DTO로 변환한다.",
    )
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

  it("does not select step API contract rules for clean Java/Spring targets", () => {
    const cleanController = fixturePath("ReservationController.java")
    const cleanTest = fixturePathFromWorkspace("src/test/java/com/example/ReservationTest.java")
    const cleanRequest = fixturePath("ReservationRequest.java")
    const cleanResponse = fixturePath("ReservationResponse.java")

    expect(selectedRulePaths("controller", "step1", cleanController)).not.toContain("backend/step1-api-contract.md")
    expect(selectedRulePaths("test", "step1", cleanTest)).not.toContain("backend/step1-api-contract.md")
    expect(selectedRulePaths("request-dto", "step1", cleanRequest)).not.toContain("backend/step1-api-contract.md")
    expect(selectedRulePaths("response-dto", "step1", cleanResponse)).not.toContain("backend/step1-api-contract.md")
  })

  it("keeps the step1 API contract selected for roomescape step Controller and Test fixtures", () => {
    expect(selectedRulePaths("controller", "step1", roomescapeFixturePath("ReservationController.java"))).toContain(
      "backend/step1-api-contract.md",
    )
    expect(selectedRulePaths("test", "step1", roomescapeFixturePath("ReservationTest.java"))).toContain(
      "backend/step1-api-contract.md",
    )
  })

  it("keeps step1 Controller and Test contract rules exclusive", () => {
    const controllerRules = selectedRulePaths("controller", "step1", roomescapeFixturePath("ReservationController.java"))
    const testRules = selectedRulePaths("test", "step1", roomescapeFixturePath("ReservationTest.java"))

    expect(controllerRules).toContain("backend/step1-api-contract.md")
    expect(controllerRules).not.toContain("backend/step2-3-api-contract.md")
    expect(testRules).toContain("backend/step1-api-contract.md")
    expect(testRules).not.toContain("backend/step2-3-api-contract.md")
  })

  it("selects the step2-3 API contract instead of step1 for step2-3 Controller, Test, and DTO fixtures", () => {
    for (const role of ["controller", "test", "request-dto", "response-dto"] as const) {
      const rules = selectedRulePaths(role, "step2-3", roomescapeTargetForRole(role))

      expect(rules).toContain("backend/step2-3-api-contract.md")
      expect(rules).not.toContain("backend/step1-api-contract.md")
    }
  })

  it("keeps step2-3 Controller, Test, and DTO contract rules exclusive", () => {
    for (const role of ["controller", "test", "request-dto", "response-dto"] as const) {
      const rules = selectedRulePaths(role, "step2-3", roomescapeTargetForRole(role))

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

  it("includes ph bearshell awareness in the injected guidance", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.block).toContain("repo inspection, CLI smoke test, 큰 출력 확인은 `ph bearshell`을 우선 사용한다.")
    expect(injection.block).not.toContain("omo sparkshell")
  })

  it("prefers codegraph for injected code analysis guidance", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.block).toContain("코드 구조 분석이나 변경 영향 파악이 필요하면 raw file read보다 codegraph MCP를 먼저 사용한다.")
    expect(injection.block).toContain("codegraph를 사용할 수 없을 때만 필요한 파일 범위를 직접 읽고 그 이유를 남긴다.")
  })

  it("routes short implementation intent through the accepted workflow plan gate", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.block).toContain("짧은 구현 지시")
    expect(injection.block).toContain("플랜 보고 구현해줘")
    expect(injection.block).toContain("npx ph workflow implement")
    expect(injection.block).toContain("실패하면 구현하지 말고")
    expect(injection.block).toContain("긴 README/plan은 `npx ph bearshell --shell 'sed -n")
    expect(injection.block).toContain("중간에 멈추면 implementation-report에 남은 범위를 기록한다.")
  })

  it("keeps selectedRules evidence as rule path strings", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.selectedRules.length).toBeGreaterThan(0)
    expect(injection.selectedRules.every((rulePath) => typeof rulePath === "string")).toBe(true)
    expect(injection.selectedRules).not.toContain("backend/step1-api-contract.md")
  })
})

function roomescapeTargetForRole(role: "controller" | "test" | "request-dto" | "response-dto"): string {
  switch (role) {
    case "controller":
      return roomescapeFixturePath("ReservationController.java")
    case "test":
      return roomescapeFixturePath("ReservationTest.java")
    case "request-dto":
      return roomescapeFixturePath("ReservationRequest.java")
    case "response-dto":
      return roomescapeFixturePath("ReservationResponse.java")
  }
}
