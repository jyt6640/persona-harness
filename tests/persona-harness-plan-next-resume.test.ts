import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-plan-next-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createProfiledTempProject(): string {
  const projectDir = createTempProject()
  const result = runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  return projectDir
}

function runPlan(projectDir: string, args: readonly string[]) {
  return runPersonaCli(["plan", ...args], { cwd: projectDir, env: {}, invocationName: "ph" })
}

function implementationReportPath(projectDir: string): string {
  return join(projectDir, ".persona", "workflow", "implementation-report.md")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph plan --next", () => {
  it("recommends creating workflow drafts when no plan exists", () => {
    const projectDir = createTempProject()

    const result = runPlan(projectDir, ["--next"])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Persona Harness next action")
    expect(result.stdout).toContain("No workflow plan found")
    expect(result.stdout).toContain("npx ph plan")
  })

  it("recommends review and acceptance for a draft plan", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)

    const result = runPlan(projectDir, ["--next"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Plan status: draft")
    expect(result.stdout).toContain("Review .persona/workflow/plan.md")
    expect(result.stdout).toContain("npx ph plan --accept")
    expect(result.stdout).toContain("npx ph plan --revise")
  })

  it("recommends implementation gate for an accepted plan with template reports", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)
    expect(runPlan(projectDir, ["--accept"]).status).toBe(0)

    const result = runPlan(projectDir, ["--next"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Plan status: accepted")
    expect(result.stdout).toContain("Implementation report status: template")
    expect(result.stdout).toContain("npx ph workflow implement")
  })

  it("recommends review after the implementation report is filled", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)
    expect(runPlan(projectDir, ["--accept"]).status).toBe(0)
    expect(runPlan(projectDir, ["--report-filled", "implementation"]).status).toBe(0)

    const result = runPlan(projectDir, ["--next"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Implementation report status: filled")
    expect(result.stdout).toContain("Review report status: template")
    expect(result.stdout).toContain("npx ph plan --report-filled review")
  })

  it("recommends continuation before review when the filled implementation report has remaining scope", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)
    expect(runPlan(projectDir, ["--accept"]).status).toBe(0)
    const report = readFileSync(implementationReportPath(projectDir), "utf8")
    writeFileSync(
      implementationReportPath(projectDir),
      report
        .replace("Status: template", "Status: filled")
        .replace("- README ranges read:", "- README ranges read: 1-220")
        .replace("- 미완료 요구사항:", "- 미완료 요구사항: Step 3~7")
        .replace("- 남은 README/plan 범위:", "- 남은 README/plan 범위: README 221-end")
        .replace("- 남은 구현 범위:", "- 남은 구현 범위: import/export and sharing API")
        .replace("- 다음 프롬프트 힌트:", "- 다음 프롬프트 힌트: 이어서 구현해줘"),
    )

    const result = runPlan(projectDir, ["--next"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Implementation report status: filled")
    expect(result.stdout).toContain("Continuation is next")
    expect(result.stdout).toContain("npx ph workflow continue")
    expect(result.stdout).toContain("README 221-end")
    expect(result.stdout).toContain("Step 3~7")
  })

  it("recommends archiving history after both workflow reports are filled", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)
    expect(runPlan(projectDir, ["--accept"]).status).toBe(0)
    expect(runPlan(projectDir, ["--report-filled", "implementation"]).status).toBe(0)
    expect(runPlan(projectDir, ["--report-filled", "review"]).status).toBe(0)

    const result = runPlan(projectDir, ["--next"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Implementation report status: filled")
    expect(result.stdout).toContain("Review report status: filled")
    expect(result.stdout).toContain("npx ph history --id")
  })
})

describe("ph plan --resume", () => {
  it("fails until the workflow plan is accepted", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)

    const result = runPlan(projectDir, ["--resume"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow plan is not accepted")
    expect(result.stderr).toContain("npx ph plan --accept")
  })

  it("prints a restart prompt when the implementation report is still a template", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)
    expect(runPlan(projectDir, ["--accept"]).status).toBe(0)

    const result = runPlan(projectDir, ["--resume"])

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Persona Harness resume prompt")
    expect(result.stdout).toContain("Implementation report status: template")
    expect(result.stdout).toContain("No filled continuation evidence found")
    expect(result.stdout).toContain("npx ph workflow implement")
    expect(result.stdout).toContain("Read Coverage")
  })

  it("prints continuation evidence when an interrupted implementation report contains it", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)
    expect(runPlan(projectDir, ["--accept"]).status).toBe(0)
    const report = readFileSync(implementationReportPath(projectDir), "utf8")
    writeFileSync(
      implementationReportPath(projectDir),
      report
        .replace("- README read method:", "- README read method: OpenCode Read")
        .replace("- README ranges read:", "- README ranges read: 1-200")
        .replace("- Plan read method:", "- Plan read method: OpenCode Read")
        .replace("- Plan ranges read:", "- Plan ranges read: 1-220")
        .replace("- Unread ranges:", "- Unread ranges: README 201-end")
        .replace("- 완료한 요구사항:", "- 완료한 요구사항: Step 1 basic CRUD")
        .replace("- 미완료 요구사항:", "- 미완료 요구사항: Step 2 import/export")
        .replace("- 마지막으로 완료한 요구사항/파일:", "- 마지막으로 완료한 요구사항/파일: build.gradle 생성 전 중단")
        .replace("- 남은 README/plan 범위:", "- 남은 README/plan 범위: README 201-end")
        .replace("- 남은 구현 범위:", "- 남은 구현 범위: Spring Boot source generation")
        .replace("- 중단 이유:", "- 중단 이유: TUI output limit")
        .replace("- 다음에 이어서 실행할 명령/작업:", "- 다음에 이어서 실행할 명령/작업: generate src/main/java"),
    )

    const result = runPlan(projectDir, ["--resume"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Continue from this recorded state")
    expect(result.stdout).toContain("README ranges read: 1-200")
    expect(result.stdout).toContain("Unread ranges: README 201-end")
    expect(result.stdout).toContain("Step 1 basic CRUD")
    expect(result.stdout).toContain("Step 2 import/export")
    expect(result.stdout).toContain("Spring Boot source generation")
    expect(result.stdout).toContain("generate src/main/java")
    expect(result.stdout).toContain("TUI output limit")
    expect(result.stdout).toContain("Plan unchecked items")
    expect(result.stdout).toContain("요구사항의 핵심 유스케이스")
  })
})

describe("ph workflow continue", () => {
  it("aliases the accepted-plan continuation prompt for short TUI resume requests", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)
    expect(runPlan(projectDir, ["--accept"]).status).toBe(0)
    const report = readFileSync(implementationReportPath(projectDir), "utf8")
    writeFileSync(
      implementationReportPath(projectDir),
      report
        .replace("- README read method:", "- README read method: npx ph bearshell chunks")
        .replace("- README ranges read:", "- README ranges read: 1-440")
        .replace("- Unread ranges:", "- Unread ranges: README 441-end")
        .replace("- 미완료 요구사항:", "- 미완료 요구사항: Step 4/6/7")
        .replace("- 남은 README/plan 범위:", "- 남은 README/plan 범위: README Step 4/6/7")
        .replace("- 남은 구현 범위:", "- 남은 구현 범위: import/export and sharing API")
        .replace("- 다음에 이어서 실행할 명령/작업:", "- 다음에 이어서 실행할 명령/작업: continue Step 4"),
    )

    const result = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness resume prompt")
    expect(result.stdout).toContain("README Step 4/6/7")
    expect(result.stdout).toContain("import/export and sharing API")
    expect(result.stdout).toContain("npx ph workflow implement")
  })

  it("shows the pending ticket path and archive command before the generic resume prompt", () => {
    const projectDir = createProfiledTempProject()
    expect(runPlan(projectDir, []).status).toBe(0)
    expect(runPlan(projectDir, ["--accept"]).status).toBe(0)
    mkdirSync(join(projectDir, ".persona", "workflow", "work", "step-2"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "workflow", "backlog.md"),
      [
        "# Persona Workflow Backlog",
        "",
        "Status: active",
        "",
        "| Order | Ticket | Title | Status | Path |",
        "| --- | --- | --- | --- | --- |",
        "| 1 | step-1 | Basic CRUD | archived | .persona/workflow/history/step-1/00-task-card.md |",
        "| 2 | step-2 | iCal Import/Export | pending | .persona/workflow/work/step-2/00-task-card.md |",
      ].join("\n"),
    )
    writeFileSync(join(projectDir, ".persona", "workflow", "work", "step-2", "00-task-card.md"), "# Task Card: Step 2\n")

    const result = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Pending workflow ticket:")
    expect(result.stdout).toContain("Ticket: step-2")
    expect(result.stdout).toContain("Title: iCal Import/Export")
    expect(result.stdout).toContain("Path: .persona/workflow/work/step-2/00-task-card.md")
    expect(result.stdout).toContain("Next command: npx ph workflow next")
    expect(result.stdout).toContain("If complete: npx ph workflow archive step-2")
    expect(result.stdout).toContain("Do not claim overall completion while this ticket remains pending.")
  })
})
