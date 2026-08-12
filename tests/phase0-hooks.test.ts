import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import type { Part, UserMessage } from "@opencode-ai/sdk"
import { beforeEach, describe, expect, it } from "vitest"

import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { createInjectionBlock } from "../src/runtime/injection.js"
import { loadRulesForRole } from "../src/rules/rule-loader.js"
import { PendingInjectionStore } from "../src/runtime/store.js"
import type { EventInput, FileRole, TransformMessagesOutput } from "../src/runtime/types.js"

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
  cpSync(join(process.cwd(), ".persona", "rules"), join(projectDir, ".persona", "rules"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["backend", "programming", "workflow", "product"] }, null, 2)}\n`,
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
  it("does not inject target-file guidance by default", async () => {
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-default-off"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.after"]?.(
      { tool: "edit", sessionID, callID: "call-1", args: { filePath: targetFile } },
      { title: "edit", output: undefined as unknown as string, metadata: {} },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).toBe("예약 생성 API 추가해줘.")
    expect(evidencePayloads(fixtureWorkspace)).toEqual([])
  })

  it("captures a Controller target file and injects the block into the next model input", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-controller"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.after"]?.(
      { tool: "edit", sessionID, callID: "call-1", args: { filePath: targetFile } },
      { title: "edit", output: undefined as unknown as string, metadata: {} },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Injection]")
    expect(text).toContain(`Current file: ${targetFile}`)
    expect(text).toContain("File role: controller")
    expect(text).toContain("Selected rules:")
    expect(text).toContain("backend/spring-controller.md")
    expect(text).toContain(
      "Java/Spring 프로젝트는 Gradle을 기본 빌드 도구로 사용하고 Maven 파일을 생성하지 않으며, Spring Boot main application class는 root package에 하나만 둔다.",
    )
    expect(text).toContain(
      "presentation → application → domain 흐름을 기본으로 두고, Controller가 Repository를 직접 호출하거나 presentation이 infrastructure를 건너뛰어 결합하지 않게 한다.",
    )
    expect(text).toContain(
      "Controller에는 Repository 의존성, Map/List 저장 상태, id sequence, 저장소 구현 세부사항을 넣지 않는다.",
    )
    expect(text).toContain(
      "Request DTO는 외부 입력 계약과 검증 경계를 표현한다.",
    )
    expect(text).toContain("API 경로, 메서드, status code, request body, response body는 요구사항의 외부 계약을 그대로")
    expect(text).not.toContain("backend/step1-api-contract.md")
    expect(text).not.toContain("201 Created는 이 단계에서 오답")
    expect(text).toContain("예약 생성 API 추가해줘.")
  })

  it("routes README implementation requests to an advisory plan handoff", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-readme-workflow"
    const output = modelInputWithText(sessionID, "README.md 구현해줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("Intent classification: requirements or delivery-planning request.")
    expect(text).toContain("Skill: plan")
    expect(text).toContain("Source context: README.md")
    expect(text).toContain("OpenCode advises and routes only")
    expect(text).not.toContain("npx ph workflow")
  })

  it("keeps Korean README implementation phrasing on the advisory plan route", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-korean-readme-workflow"
    const output = modelInputWithText(sessionID, "리드미 보고 구현할래")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("Intent classification: requirements or delivery-planning request.")
    expect(text).toContain("Source context: README.md")
    expect(text).toContain("Skill: plan")
    expect(text).toContain("The next handoff is explicit")
    expect(text).not.toContain("npx ph workflow")
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
    expect(text).toContain("Intent classification: debug request.")
    expect(text).toContain("Reproduce the failure first")
    expect(text).toContain("Form at least three hypotheses")
    expect(text).toContain("Fix only the confirmed cause")
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
    expect(text).toContain("Intent classification: review request.")
    expect(text).toContain("Do not modify code")
    expect(text).toContain("Write findings first")
    expect(text).toContain("file/line/evidence/impact")
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
    expect(text).toContain("Intent classification: refactor request.")
    expect(text).toContain("lock current public behavior first")
    expect(text).toContain("Do not add features")
    expect(text).toContain("rerun the same test/build/smoke command")
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
    expect(text).toContain("Intent classification: git work request.")
    expect(text).toContain("Stage only relevant files")
    expect(text).toContain("Push only when the user explicitly requested a push")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
    expect(text).not.toContain("[Persona Harness Debug Workflow]")
    expect(text).not.toContain("[Persona Harness Review Workflow]")
    expect(text).not.toContain("[Persona Harness Refactor Workflow]")
  })

  it("routes direct programming requests through the programming workflow", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-programming-workflow"
    const output = modelInputWithText(sessionID, "CouponService 만들어줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Programming Workflow]")
    expect(text).toContain("Detected intent: programming")
    expect(text).toContain("Intent classification: direct programming request.")
    expect(text).toContain("Read the relevant files first")
    expect(text).toContain("Runtime reliability guard:")
    expect(text).toContain("if `.persona/project-profile.jsonc` exists, read it")
    expect(text).toContain("If the profile exists but has not been read yet")
    expect(text).toContain("this host route does not create or advance that state")
    expect(text).not.toContain("npx ph workflow")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
    expect(text).not.toContain("[Persona Harness Debug Workflow]")
    expect(text).not.toContain("[Persona Harness Review Workflow]")
    expect(text).not.toContain("[Persona Harness Refactor Workflow]")
    expect(text).not.toContain("[Persona Harness Git Workflow]")
  })

  it("records intent evidence when a workflow rail is injected", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-intent-evidence"
    const output = modelInputWithText(sessionID, "CouponService 만들어줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const intentEvidence = evidencePayloads(fixtureWorkspace).find(
      (payload) => payload.schemaVersion === "phase0.intent.1",
    )
    expect(intentEvidence).toMatchObject({
      hook: "experimental.chat.messages.transform",
      sessionID,
      injectedInto: "intent-workflow",
      privacyClass: "metadata-safe",
      primaryIntent: "programming",
      railMarker: "[Persona Harness Programming Workflow]",
    })
    expect(intentEvidence?.["userPrompt"]).toBeUndefined()
    expect(intentEvidence?.["promptDiagnostic"]).toBeUndefined()
    expect(intentEvidence?.secondaryIntents).toEqual([])
  })

  it("routes pasted requirement implementation requests without creating a source or ticket", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-prompt-workflow"
    const output = modelInputWithText(sessionID, "이 요구사항대로 장비 대여 API 만들어줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-implementation")
    expect(text).toContain("Intent classification: requirements or delivery-planning request.")
    expect(text).toContain("Skill: plan")
    expect(text).toContain("keep discovery and approval conversational")
    expect(text).toContain("OpenCode advises and routes only")
    expect(text).not.toContain("npx ph workflow")

    const intentEvidence = evidencePayloads(fixtureWorkspace).find(
      (payload) => payload.schemaVersion === "phase0.intent.1",
    )
    expect(intentEvidence).toMatchObject({
      injectedInto: "intent-workflow",
      privacyClass: "metadata-safe",
      primaryIntent: "requirements",
      railMarker: "[Persona Harness Requirements Workflow]",
    })
    expect(intentEvidence?.["userPrompt"]).toBeUndefined()
    expect(intentEvidence?.["promptDiagnostic"]).toBeUndefined()
  })

  it("starts a one-question product interview for vague product ideas", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-draft-workflow"
    const output = modelInputWithText(sessionID, "TODO 웹 서비스 만들래")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Product Interview]")
    expect(text).toContain("Question:")
    expect(text).toContain("Recommendation:")
    expect(text).toContain("Tradeoff:")
    expect(text).toContain("No plan, ticket, workflow, branch, file, issue, or agent action has been created.")
    expect(text).not.toContain("[Persona Harness Requirements Workflow]")
    expect(text).not.toContain("npx ph workflow")
    expect(existsSync(join(fixtureWorkspace, ".persona", "workflow"))).toBe(false)
    expect(existsSync(join(fixtureWorkspace, ".persona", "evidence"))).toBe(false)
  })

  it("routes approved requirements to an explicit plan handoff only when a draft backlog exists", async () => {
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
    expect(text).toContain("Intent classification: approved requirements request.")
    expect(text).toContain("Decision: explicit")
    expect(text).toContain("Skill: plan")
    expect(text).toContain("do not create backlog, ticket, or implementation state from this route")
    expect(text).not.toContain("npx ph workflow")
  })

  it("does not route bare approval words when no requirements draft exists", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-approve-without-draft"
    const output = modelInputWithText(sessionID, "진행하자")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).not.toContain("[Persona Harness Requirements Workflow]")
  })

  it("routes continuation requests without automatically selecting or advancing a ticket", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-continue-workflow"
    const output = modelInputWithText(sessionID, "Step 2 이어서 해줘")

    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("[Persona Harness Requirements Workflow]")
    expect(text).toContain("Detected intent: requirement-continuation")
    expect(text).toContain("Intent classification: explicit continuation request.")
    expect(text).toContain("Ask for the explicit current delivery boundary")
    expect(text).toContain("The next handoff is explicit")
    expect(text).not.toContain("npx ph workflow")
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
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-service"
    const targetFile = fixturePath("ReservationService.java")

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID, callID: "call-2", args: { path: targetFile } },
      { title: "write", output: undefined as unknown as string, metadata: {} },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("File role: service")
    expect(text).toContain(
      "Application Service는 비즈니스/use-case 흐름을 조율하고 저장소 구현 세부사항을 직접 소유하지 않는다.",
    )
    expect(text).toContain(
      "Service는 List, Map, AtomicLong, nextId, idCounter, sequence 같은 저장소 상태나 id sequence를 직접 소유하지 않는다.",
    )
    expect(text).toContain(
      "Controller가 아니라 Service가 Repository를 호출하고, 생성/조회/삭제 흐름을 조율한다.",
    )
  })

  it("selects an entity-specific injection block for Entity files", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-entity"
    const targetFile = fixturePath("ReservationEntity.java")

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "call-3", args: { targetFile } },
      { title: "read", output: undefined as unknown as string, metadata: {} },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const text = firstText(output)
    expect(text).toContain("File role: entity")
    expect(text).toContain("Entity는 setter를 열지 않는다.")
  })

  it("appends the injection block to read tool output so the same model turn can see it", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-tool-output"
    const targetFile = fixturePath("ReservationController.java")
    const output = { title: "read", output: "class ReservationController {}", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "call-4", args: { filePath: targetFile } },
      output,
    )

    expect(output.output).toContain("class ReservationController {}")
    expect(output.output).toContain("[Persona Harness Injection]")
    expect(output.output).toContain("File role: controller")
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
    expect(injection.block).toContain(`Current file: ${targetFile}`)
    expect(injection.block).toContain("File role: controller")
    expect(injection.block).toContain("Selected rules:")
    expect(injection.block).toContain("Applied policies:")
    expect(injection.block).toContain("Notes:")
  })

  it("includes ph bearshell awareness in the injected guidance", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.block).toContain("bearshell")
    expect(injection.block).not.toContain("omo sparkshell")
  })

  it("keeps injected code analysis guidance PH-owned first without codegraph ownership claims", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    const tier0 = injection.block.split("Tier1 - advisory workflow boundary:")[0] ?? ""
    const tier0Lines = tier0
      .split("\n")
      .slice(tier0.split("\n").findIndex((line) => line === "Tier0 - source-of-truth boundaries:"))
      .filter((line) => line.trim() !== "")
    expect(tier0Lines).toHaveLength(6)
    expect(injection.block).toContain("Use PH-owned surfaces first")
    expect(injection.block).toContain("Optional external code-nav tools may help only when actually installed")
    expect(injection.block).not.toContain("codegraph MCP를 먼저 사용한다")
    expect(injection.block).not.toContain("PH-owned MCP/codegraph")
  })

  it("keeps short implementation guidance advisory until the user selects a procedure", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.block).toContain("Tier1 - advisory workflow boundary:")
    expect(injection.block).toContain("A host injection does not start, continue, or repair a workflow")
    expect(injection.block).toContain("Keep pasted product requirements conversational")
    expect(injection.block).toContain("profile exists but not read → do not implement yet")
    expect(injection.block).toContain("Read long README/plan content in bounded chunks")
    expect(injection.block).toContain("Tier3 - advisory closure boundary:")
    expect(injection.block).not.toContain("npx ph workflow implement")
  })

  it("keeps selectedRules evidence as rule path strings", () => {
    const targetFile = fixturePath("ReservationController.java")

    const injection = createInjectionBlock(targetFile, fixtureWorkspace)

    expect(injection.selectedRules.length).toBeGreaterThan(0)
    expect(injection.selectedRules.every((rulePath) => typeof rulePath === "string")).toBe(true)
    expect(injection.selectedRules).not.toContain("backend/step1-api-contract.md")
  })

  it("keeps runtime context eligibility after-only", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-after-only"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.before"]?.(
      { tool: "read", sessionID, callID: "before-call" },
      { args: { filePath: targetFile } },
    )

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).not.toContain("[Persona Harness Injection]")
    expect(evidencePayloads(fixtureWorkspace).filter((payload) =>
      payload.schemaVersion === "phase0.1" || payload.schemaVersion === "phase0.runtime-context.1",
    )).toEqual([])
  })

  it("does not use an already-present user marker as runtime context proof", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-marker-is-not-proof"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "after-call", args: { filePath: targetFile } },
      { title: "read", output: undefined as unknown as string, metadata: {} },
    )

    const output = modelInputWithText(sessionID, "[Persona Harness Injection]\n사용자가 입력한 표식")
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    const injectedPart = output.messages[0]?.parts.find(
      (part) => part.type === "text" &&
        (part as typeof part & { readonly metadata?: Record<string, unknown> }).metadata?.personaHarnessContextDigest,
    )
    expect(injectedPart?.type === "text" ? injectedPart.metadata : undefined).toMatchObject({
      personaHarnessContextDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
    })
  })

  it("records a model-input fallback when the host text part is immutable", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    writeFileSync(
      join(fixtureWorkspace, ".persona", "harness.jsonc"),
      `${JSON.stringify({ features: { runtimeInjection: true }, enabledDomains: ["backend", "programming"] }, null, 2)}\n`,
    )
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace })
    const sessionID = "session-model-input-fallback"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "after-call", args: { filePath: targetFile } },
      { title: "read", output: undefined as unknown as string, metadata: {} },
    )
    const output = modelInput(sessionID)
    const textPart = output.messages[0]?.parts[0]
    if (textPart === undefined) {
      throw new Error("expected a model input text part")
    }
    Object.freeze(textPart)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(output.messages[0]?.parts.some((part) => part.type === "text" && part.synthetic === true)).toBe(true)
    expect(evidencePayloads(fixtureWorkspace).some(
      (payload) => payload.schemaVersion === "phase0.runtime-context.1" && payload.state === "model-input-fallback",
    )).toBe(true)
  })

  it("does not duplicate a context already emitted in tool output", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const store = new PendingInjectionStore()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace, store })
    const sessionID = "session-tool-output-lifecycle"
    const targetFile = fixturePath("ReservationController.java")
    const toolOutput = { title: "read", output: "class ReservationController {}", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "after-call", args: { filePath: targetFile } },
      toolOutput,
    )
    const expectedInjection = createInjectionBlock(targetFile, fixtureWorkspace)
    expect(store.delivery(sessionID, expectedInjection.contextDigest)?.state).toBe("offered")
    const output = modelInput(sessionID)
    const marker = (toolOutput.metadata as Record<string, unknown>).personaHarnessRuntimeContext
    const userMessage = output.messages[0]
    if (userMessage === undefined) {
      throw new Error("expected a user message")
    }
    userMessage.parts.unshift({
      id: "tool-part",
      sessionID,
      messageID: userMessage.info.id,
      type: "tool",
      callID: "after-call",
      tool: "read",
      state: { status: "completed", output: toolOutput.output, metadata: { personaHarnessRuntimeContext: marker } },
    } as unknown as Part)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(toolOutput.output).toContain("[Persona Harness Runtime Context]")
    expect(output.messages[0]?.parts.some((part) => part.type === "text" && part.synthetic === true)).toBe(false)
    expect(store.delivery(sessionID, expectedInjection.contextDigest)?.state).toBe("tool-output-emitted")
    const runtimeEvidence = evidencePayloads(fixtureWorkspace).find(
      (payload) => payload.schemaVersion === "phase0.runtime-context.1" && payload.state === "tool-output-emitted",
    )
    expect(runtimeEvidence).toBeDefined()
    expect(JSON.stringify(runtimeEvidence)).not.toContain(targetFile)
    expect(JSON.stringify(runtimeEvidence)).not.toContain("[Persona Harness Injection]")
  })

  it("falls back to model input when tool output is not present in the message collection", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const store = new PendingInjectionStore()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace, store })
    const sessionID = "session-tool-output-missing-from-collection"
    const targetFile = fixturePath("ReservationController.java")
    const toolOutput = { title: "read", output: "class ReservationController {}", metadata: {} }

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "after-call", args: { filePath: targetFile } },
      toolOutput,
    )
    const expectedInjection = createInjectionBlock(targetFile, fixtureWorkspace)
    expect(store.delivery(sessionID, expectedInjection.contextDigest)?.state).toBe("offered")

    const output = modelInput(sessionID)
    await hooks["experimental.chat.messages.transform"]?.({}, output)

    expect(firstText(output)).toContain("[Persona Harness Runtime Context]")
    expect(store.delivery(sessionID, expectedInjection.contextDigest)?.state).toBe("model-input-observed")
  })

  it("clears runtime context state when the host ends a session", async () => {
    writeOptInHarnessConfig(fixtureWorkspace)
    const store = new PendingInjectionStore()
    const hooks = createPhase0Hooks({ projectDir: fixtureWorkspace, store })
    const sessionID = "session-lifecycle-cleanup"
    const targetFile = fixturePath("ReservationController.java")

    await hooks["tool.execute.after"]?.(
      { tool: "read", sessionID, callID: "after-call", args: { filePath: targetFile } },
      { title: "read", output: undefined as unknown as string, metadata: {} },
    )
    const injection = createInjectionBlock(targetFile, fixtureWorkspace)
    expect(store.delivery(sessionID, injection.contextDigest)).toBeDefined()

    await hooks.event?.({
      event: {
        type: "session.deleted",
        properties: { info: { id: sessionID } },
      },
    } as unknown as EventInput)

    expect(store.pendingCount(sessionID)).toBe(0)
    expect(store.delivery(sessionID, injection.contextDigest)).toBeUndefined()
  })

  it("retains distinct pending contexts in order instead of overwriting silently", () => {
    const store = new PendingInjectionStore()
    const first = createInjectionBlock("src/main/java/com/example/FirstController.java", fixtureWorkspace)
    const second = createInjectionBlock("src/main/java/com/example/SecondService.java", fixtureWorkspace)

    const firstOffer = store.set("session-ordered-pending", first)
    const secondOffer = store.set("session-ordered-pending", second)

    expect(firstOffer.kind).toBe("offered")
    expect(secondOffer.kind).toBe("offered")
    expect(store.delivery("session-ordered-pending", first.contextDigest)?.state).toBe("offered")
    expect(store.take("session-ordered-pending")?.targetFile).toBe(first.targetFile)
    expect(store.take("session-ordered-pending")?.targetFile).toBe(second.targetFile)
  })

  it("attaches stable semantic section digests without storing context bodies in evidence", () => {
    const targetFile = fixturePath("ReservationController.java")
    const injection = createInjectionBlock(targetFile, fixtureWorkspace)
    const candidate = injection as typeof injection & {
      readonly semanticSections?: readonly { readonly kind: string; readonly digest: string }[]
      readonly contextDigest?: string
    }

    expect(candidate.semanticSections?.length).toBeGreaterThan(0)
    expect(candidate.semanticSections?.every((section) => /^sha256:[a-f0-9]{64}$/.test(section.digest))).toBe(true)
    expect(candidate.contextDigest).toMatch(/^sha256:[a-f0-9]{64}$/)
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
