import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-plan-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeProfile(projectDir: string): void {
  const profile = {
    schema: "persona.project-profile.v1",
    status: "ready",
    scope: {
      role: "backend",
      mvp: "java-spring-clean-code",
      productized: false,
    },
    questions: [
      { id: "user-language", prompt: "language", choices: [], answer: "ko" },
      { id: "project-context", prompt: "context", choices: [], answer: "solo" },
      { id: "project-goal", prompt: "goal", choices: [], answer: "production-service" },
      { id: "project-scale", prompt: "scale", choices: [], answer: "small" },
      { id: "application-type", prompt: "application", choices: [], answer: "rest-api" },
      { id: "storage", prompt: "storage", choices: [], answer: "database" },
      { id: "persistence-technology", prompt: "persistence", choices: [], answer: "jdbc-template" },
      { id: "migration-style", prompt: "migration", choices: [], answer: "flyway" },
      { id: "package-style", prompt: "package", choices: [], answer: "domain-first" },
      { id: "architecture-style", prompt: "architecture", choices: [], answer: "clean-architecture-light" },
      { id: "boundary-strictness", prompt: "boundary", choices: [], answer: "strict" },
    ],
    notes: {
      project: "관리자 기능은 이번 범위에서 제외한다.",
    },
  }

  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(profile, null, 2)}\n`)
}

function createProfiledTempProject(): string {
  const projectDir = createTempProject()
  writeProfile(projectDir)
  return projectDir
}

function readPlan(projectDir: string): string {
  return readFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "utf8")
}

function readImplementationReport(projectDir: string): string {
  return readFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "utf8")
}

function readReviewReport(projectDir: string): string {
  return readFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "utf8")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph plan", () => {
  it("creates a blackbear planning artifact from README and backend profile summary", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Equipment Rental API\n\n- 장비 등록\n- 장비 대여\n")

    const result = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness blackbear plan draft created.")
    expect(result.stderr).toBe("")
    expect(existsSync(join(projectDir, ".persona", "workflow", "plan.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "implementation-report.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "review-report.md"))).toBe(true)

    const plan = readPlan(projectDir)
    expect(plan).toContain("# Blackbear Architecture Plan")
    expect(plan).toContain("Role: `blackbear`")
    expect(plan).toContain("Requirements source: `README.md`")
    expect(plan).toContain("README heading: Equipment Rental API")
    expect(plan).toContain("- project-context: solo")
    expect(plan).toContain("- project-goal: production-service")
    expect(plan).toContain("- project-scale: small")
    expect(plan).toContain("- application-type: rest-api")
    expect(plan).toContain("- storage: database")
    expect(plan).toContain("- persistence-technology: jdbc-template")
    expect(plan).toContain("- migration-style: flyway")
    expect(plan).toContain("- package-style: domain-first")
    expect(plan).toContain("- architecture-style: clean-architecture-light")
    expect(plan).toContain("- boundary-strictness: strict")
    expect(plan).toContain("- notes.project: 관리자 기능은 이번 범위에서 제외한다.")
    expect(plan).toContain("implementation must not start until this plan is reviewed or accepted")
    expect(plan).toContain("긴 README나 plan은 한 번에 읽었다고 가정하지 않는다.")
    expect(plan).toContain("macOS/Linux: `npx ph bearshell --shell 'sed -n \"1,220p\" README.md'`")
    expect(plan).toContain(
      'Windows PowerShell: `npx ph bearshell powershell -NoProfile -Command "Get-Content README.md -TotalCount 220"`',
    )
    expect(plan).toContain("Select-String -Path README.md -Pattern TODO")
    expect(plan).toContain("do not recurse project root or .persona root")
    expect(plan).not.toContain("Get-ChildItem -Path README.md,src,.persona -Recurse")
    expect(plan).not.toContain("Get-ChildItem -Recurse -File | Select-String -Pattern TODO")
    expect(plan).not.toContain('npx ph bearshell --shell "powershell')
    expect(plan).not.toContain("npx ph bearshell --shell 'powershell")
    expect(plan).not.toContain("Select-String -Recurse")

    const implementationReport = readImplementationReport(projectDir)
    expect(implementationReport).toContain("# Implementer Implementation Report")
    expect(implementationReport).toContain("Status: template")
    expect(implementationReport).toContain("## Read Coverage")
    expect(implementationReport).toContain("README read method:")
    expect(implementationReport).toContain("README ranges read:")
    expect(implementationReport).toContain("Plan read method:")
    expect(implementationReport).toContain("Plan ranges read:")
    expect(implementationReport).toContain("Java role discovery method:")
    expect(implementationReport).toContain("Java role files discovered:")
    expect(implementationReport).toContain("Java role files read:")
    expect(implementationReport).toContain("Unread ranges:")
    expect(implementationReport).toContain("Read evidence notes:")
    expect(implementationReport).toContain("## Implemented Files")
    expect(implementationReport).toContain("## Verification")
    expect(implementationReport).toContain("## Manual QA")
    expect(implementationReport).toContain("`npx ph bearshell gradle test`")
    expect(implementationReport).toContain("`npx ph bearshell gradle build`")
    expect(implementationReport).toContain("`:bootJar SKIPPED`")
    expect(implementationReport).toContain("build 통과로 기록하지 않는다")
    expect(implementationReport).toContain("`npx ph bearshell --shell 'gradle bootRun")
    expect(implementationReport).toContain("HTTP happy path")
    expect(implementationReport).toContain("HTTP failure path")
    expect(implementationReport).toContain("Manual QA가 불가능하면 사유와 stderr/핵심 로그를 기록한다.")
    expect(implementationReport).toContain("채운 뒤에는 `npx ph plan --report-filled implementation`을 실행한다.")
    expect(implementationReport).toContain("## Continuation")
    expect(implementationReport).toContain("남은 README/plan 범위:")
    expect(implementationReport).toContain("완료한 요구사항:")
    expect(implementationReport).toContain("미완료 요구사항:")
    expect(implementationReport).toContain("중단 이유:")
    expect(implementationReport).toContain("다음에 이어서 실행할 명령/작업:")
    expect(implementationReport).toContain("다음 프롬프트 힌트:")

    const reviewReport = readReviewReport(projectDir)
    expect(reviewReport).toContain("# Reviewer Review Report")
    expect(reviewReport).toContain("Status: template")
    expect(reviewReport).toContain("## Requirements Check")
    expect(reviewReport).toContain("README/plan read method와 ranges가 implementation report에 남아 있다.")
    expect(reviewReport).toContain("## Boundary Review")
    expect(reviewReport).toContain("`npx ph bearshell gradle test` 결과를 확인했다.")
    expect(reviewReport).toContain("`npx ph bearshell gradle build` 결과를 확인했다.")
    expect(reviewReport).toContain("`:bootJar SKIPPED`")
    expect(reviewReport).toContain("`npx ph bearshell --shell 'gradle bootRun")
    expect(reviewReport).toContain("HTTP happy path / failure path manual QA evidence")
    expect(reviewReport).toContain("채운 뒤에는 `npx ph plan --report-filled review`를 실행한다.")
    expect(reviewReport).toContain("## Remaining Limits")
  })

  it("marks missing README without crashing when the backend profile is ready", () => {
    const projectDir = createProfiledTempProject()

    const result = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const plan = readPlan(projectDir)
    expect(plan).toContain("Requirements source: `README.md`")
    expect(plan).toContain("README status: missing")
    expect(plan).toContain("- user-language: ko")
    expect(plan).toContain("- project-context: solo")
  })

  it("marks empty projects as greenfield baseline mode", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Todo API\n\n- 할 일 등록\n")

    const result = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const plan = readPlan(projectDir)
    expect(plan).toContain("## Project Mode")
    expect(plan).toContain("Mode: greenfield")
    expect(plan).toContain("0% -> 80%")
    expect(plan).toContain("Java/Spring backend baseline package flow")
  })

  it("marks non-empty Java projects as existing-code adaptation mode", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Todo API\n\n- 기존 Todo 기능 확장\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "todo", "web"), { recursive: true })
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "todo", "service"), { recursive: true })
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "todo", "repository"), { recursive: true })
    writeFileSync(
      join(projectDir, "src", "main", "java", "com", "example", "todo", "web", "TodoController.java"),
      "package com.example.todo.web;\n\nclass TodoController {}\n",
    )
    writeFileSync(
      join(projectDir, "src", "main", "java", "com", "example", "todo", "service", "TodoService.java"),
      "package com.example.todo.service;\n\nclass TodoService {}\n",
    )
    writeFileSync(
      join(projectDir, "src", "main", "java", "com", "example", "todo", "repository", "TodoRepository.java"),
      "package com.example.todo.repository;\n\ninterface TodoRepository {}\n",
    )

    const result = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const plan = readPlan(projectDir)
    expect(plan).toContain("## Project Mode")
    expect(plan).toContain("Mode: existing-code")
    expect(plan).toContain("Existing source files detected: 3")
    expect(plan).toContain("com.example.todo")
    expect(plan).toContain("web")
    expect(plan).toContain("service")
    expect(plan).toContain("repository")
    expect(plan).toContain("existing code wins over greenfield guidance")
  })

  it("blocks plan creation until the backend profile is ready", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Project profile is required before planning.")
    expect(result.stderr).toContain("npx ph intake --default backend")
  })

  it("does not overwrite existing workflow artifacts unless --force is used", () => {
    const projectDir = createProfiledTempProject()
    const first = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
    writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "custom plan\n")
    writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "custom implementation\n")
    writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "custom review\n")

    const duplicate = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const forced = runPersonaCli(["plan", "--force"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(duplicate.status).toBe(1)
    expect(duplicate.stderr).toContain("already exists")
    expect(forced.status).toBe(0)
    expect(readPlan(projectDir)).toContain("# Blackbear Architecture Plan")
    expect(readPlan(projectDir)).toContain("Status: draft")
    expect(readImplementationReport(projectDir)).toContain("# Implementer Implementation Report")
    expect(readReviewReport(projectDir)).toContain("# Reviewer Review Report")
  })

  it("reads and updates the plan acceptance status", () => {
    const projectDir = createProfiledTempProject()
    const draft = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    const draftStatus = runPersonaCli(["plan", "--status"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const accepted = runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const acceptedStatus = runPersonaCli(["plan", "--status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(draft.status).toBe(0)
    expect(draftStatus.status).toBe(0)
    expect(draftStatus.stdout).toContain("Status: draft")
    expect(accepted.status).toBe(0)
    expect(accepted.stdout).toContain("Status: accepted")
    expect(acceptedStatus.stdout).toContain("Status: accepted")
    expect(readPlan(projectDir)).toContain("Status: accepted")

    const revise = runPersonaCli(["plan", "--revise"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const reviseStatus = runPersonaCli(["plan", "--status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(revise.status).toBe(0)
    expect(revise.stdout).toContain("Status: needs-revision")
    expect(reviseStatus.stdout).toContain("Status: needs-revision")
    expect(readPlan(projectDir)).toContain("Status: needs-revision")
  })

  it("marks filled workflow reports without changing the plan status", () => {
    const projectDir = createProfiledTempProject()
    const draft = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: template",
        "- README ranges read: 1-220",
        "- Project profile ranges read: all",
        "- `npx ph bearshell --shell './gradlew test'`",
        "- BUILD SUCCESSFUL",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      [
        "Status: template",
        "- Requirements reviewed against the accepted plan.",
        "- Manual QA completed.",
        "- `npx ph bearshell --shell './gradlew bootRun'`",
      ].join("\n"),
    )

    const implementationFilled = runPersonaCli(["plan", "--report-filled", "implementation"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const reviewFilled = runPersonaCli(["plan", "--report-filled", "review"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(draft.status).toBe(0)
    expect(implementationFilled.status).toBe(0)
    expect(implementationFilled.stdout).toContain("Workflow report: .persona/workflow/implementation-report.md")
    expect(implementationFilled.stdout).toContain("Status: filled")
    expect(reviewFilled.status).toBe(0)
    expect(reviewFilled.stdout).toContain("Workflow report: .persona/workflow/review-report.md")
    expect(reviewFilled.stdout).toContain("Status: filled")
    expect(readImplementationReport(projectDir)).toContain("Status: filled")
    expect(readReviewReport(projectDir)).toContain("Status: filled")
    expect(readPlan(projectDir)).toContain("Status: draft")
  })

  it("fails plan status changes when the plan artifact does not exist", () => {
    const projectDir = createProfiledTempProject()

    const status = runPersonaCli(["plan", "--status"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const accept = runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const revise = runPersonaCli(["plan", "--revise"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const implement = runPersonaCli(["plan", "--implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(status.status).toBe(1)
    expect(status.stderr).toContain("No workflow plan found")
    expect(accept.status).toBe(1)
    expect(accept.stderr).toContain("No workflow plan found")
    expect(revise.status).toBe(1)
    expect(revise.stderr).toContain("No workflow plan found")
    expect(implement.status).toBe(1)
    expect(implement.stderr).toContain("No workflow plan found")
  })

  it("blocks implementation until the workflow plan is accepted", () => {
    const projectDir = createProfiledTempProject()
    const draft = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    const implement = runPersonaCli(["plan", "--implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(draft.status).toBe(0)
    expect(implement.status).toBe(1)
    expect(implement.stderr).toContain("Workflow plan is not accepted")
    expect(implement.stderr).toContain("Current status: draft")
    expect(implement.stderr).toContain("npx ph plan --accept")
  })

  it("blocks implementation when required workflow report templates are missing", () => {
    const projectDir = createProfiledTempProject()
    const draft = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const accepted = runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" })
    rmSync(join(projectDir, ".persona", "workflow", "implementation-report.md"))

    const implement = runPersonaCli(["plan", "--implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(draft.status).toBe(0)
    expect(accepted.status).toBe(0)
    expect(implement.status).toBe(1)
    expect(implement.stderr).toContain("Missing workflow artifacts")
    expect(implement.stderr).toContain(".persona/workflow/implementation-report.md")
    expect(implement.stderr).toContain("Run npx ph plan first")
  })

})
