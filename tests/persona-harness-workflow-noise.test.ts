import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-noise-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function prepareAcceptedWorkflow(projectDir: string): void {
  const intake = runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(intake.status).toBe(0)
  expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
}

function writeWorkflowReports(projectDir: string, implementationLines: readonly string[], reviewLines: readonly string[]): void {
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), `${implementationLines.join("\n")}\n`)
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), `${reviewLines.join("\n")}\n`)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow noise classification", () => {
  it("reports non-blocking workflow noise when raw shell was only used for environment probes", () => {
    const projectDir = createTempProject()
    prepareAcceptedWorkflow(projectDir)
    writeWorkflowReports(
      projectDir,
      [
        "Status: filled",
        "- [x] raw shell was used only for `java -version` and `gradle -v` environment probes.",
        "- [x] `npx ph bearshell --shell 'gradle test'`",
        "- [x] `npx ph bearshell --shell 'gradle build'`",
      ],
      ["Status: filled", "- [x] `npx ph bearshell --shell 'gradle bootRun'`"],
    )

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain("raw shell environment probe observed")
    expect(result.stdout).toContain("Next: review workflow noise")
  })

  it("records direct .persona/rules reads as a non-warning workflow note", () => {
    const projectDir = createTempProject()
    prepareAcceptedWorkflow(projectDir)
    writeWorkflowReports(
      projectDir,
      [
        "Status: filled",
        "- [x] Read .persona/rules/backend/spring-service.md directly.",
        "- [x] `npx ph bearshell --shell 'gradle test'`",
        "- [x] `npx ph bearshell --shell 'gradle build'`",
      ],
      ["Status: filled", "- [x] `npx ph bearshell --shell 'gradle bootRun'`"],
    )

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: PASS")
    expect(result.stdout).toContain("note: direct `.persona/rules` read observed")
    expect(result.stdout).toContain("direct `.persona/rules` read observed")
    expect(result.stdout).toContain("Next: archive completed workflow")
  })

  it("allows implementation finish when only non-blocking workflow noise remains", () => {
    const projectDir = createTempProject()
    prepareAcceptedWorkflow(projectDir)
    writeWorkflowReports(
      projectDir,
      [
        "Status: filled",
        "- [x] raw shell was used only for `java -version` and `gradle -v` environment probes.",
        "- [x] Read .persona/rules/backend/spring-service.md directly.",
        "- [x] `npx ph bearshell --shell 'gradle test'`",
        "- [x] `npx ph bearshell --shell 'gradle build'`",
      ],
      ["Status: filled", "- [x] `npx ph bearshell --shell 'gradle bootRun'`"],
    )

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Finish status: PASS")
  })

  it("keeps workflow check WARN when direct rules reads are paired with raw shell noise", () => {
    const projectDir = createTempProject()
    prepareAcceptedWorkflow(projectDir)
    writeWorkflowReports(
      projectDir,
      [
        "Status: filled",
        "- [x] raw shell was used only for `java -version` and `gradle -v` environment probes.",
        "- [x] Read .persona/rules/backend/spring-service.md directly.",
        "- [x] `npx ph bearshell --shell 'gradle test'`",
        "- [x] `npx ph bearshell --shell 'gradle build'`",
      ],
      ["Status: filled", "- [x] `npx ph bearshell --shell 'gradle bootRun'`"],
    )

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain("raw shell environment probe observed")
    expect(result.stdout).toContain("note: direct `.persona/rules` read observed")
  })

  it("allows implementation finish when raw final verification was rerun through bearshell", () => {
    const projectDir = createTempProject()
    prepareAcceptedWorkflow(projectDir)
    writeWorkflowReports(
      projectDir,
      [
        "Status: filled",
        "- [x] raw shell을 직접 썼다면 `npx ph bearshell`을 쓰지 못한 이유를 기록한다. (초기 smoke는 raw shell로 시도했지만, 최종 검증은 bearshell로 다시 실행함)",
        "- [x] 실행 가능한 Spring Boot 앱이면 `npx ph bearshell --shell './gradlew bootRun --args=\"--server.port=18082\"'` + `curl` smoke",
        "- [x] `npx ph bearshell --shell './gradlew test build'`",
      ],
      ["Status: filled", "- [x] `npx ph bearshell --shell './gradlew bootRun'` 결과를 확인했다."],
    )

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Finish status: PASS")
  })

  it("blocks implementation finish when final verification used raw shell", () => {
    const projectDir = createTempProject()
    prepareAcceptedWorkflow(projectDir)
    writeWorkflowReports(
      projectDir,
      [
        "Status: filled",
        "- [x] raw shell was used for final verification.",
        "- [x] `./gradlew test`",
        "- [x] `./gradlew build`",
      ],
      ["Status: filled", "- [x] HTTP smoke checked."],
    )

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("raw shell used for final verification")
  })
})
