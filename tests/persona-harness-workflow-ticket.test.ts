import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-ticket-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createHarnessProject(): string {
  const projectDir = createTempProject()
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  return projectDir
}

function writeStepReadme(projectDir: string): void {
  writeFileSync(
    join(projectDir, "README.md"),
    [
      "# Calendar API",
      "",
      "## Step 1. 기본 일정 구현",
      "",
      "- 일정을 등록한다.",
      "- 일정을 조회한다.",
      "",
      "### Step 2. iCal Import/Export",
      "",
      "- iCal 파일을 import 한다.",
      "- 서버 일정을 export 한다.",
      "",
      "### Step 3. 반복 일정",
      "",
      "- 반복 일정을 등록한다.",
    ].join("\n"),
  )
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow ticket backlog", () => {
  it("splits README Step sections into backlog rows and task cards", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)

    const result = runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow split complete")
    expect(result.stdout).toContain("Tickets created: 3")
    const backlog = readFileSync(join(projectDir, ".persona", "workflow", "backlog.md"), "utf8")
    const card = readFileSync(join(projectDir, ".persona", "workflow", "work", "step-1", "00-task-card.md"), "utf8")
    expect(backlog).toContain("| 1 | step-1 | 기본 일정 구현 | pending | .persona/workflow/work/step-1/00-task-card.md |")
    expect(backlog).toContain("| 2 | step-2 | iCal Import/Export | pending | .persona/workflow/work/step-2/00-task-card.md |")
    expect(card).toContain("# Task Card: Step 1. 기본 일정 구현")
    expect(card).toContain("Source: README.md")
    expect(card).toContain("Source kind: file")
    expect(card).toContain("Source path: README.md")
    expect(card).toContain("- 일정을 등록한다.")
    expect(card).toContain("No automatic code generation")
  })

  it("captures prompt requirements from stdin and splits the latest prompt source by default", () => {
    const projectDir = createHarnessProject()
    const promptRequirements = [
      "# Prompt Requirements",
      "",
      "## Step 1. 기본 일정 구현",
      "",
      "- 프롬프트로 받은 일정을 등록한다.",
      "",
      "## Step 2. iCal Import/Export",
      "",
      "- 프롬프트 기반 iCal export를 구현한다.",
      "",
      "## Step 3. 반복 일정",
      "",
      "- 프롬프트 기반 반복 일정을 구현한다.",
      "",
      "## Step 4. 캘린더 연동",
      "",
      "- 외부 캘린더 연동을 검토한다.",
      "",
      "## Step 5. 다양한 조회",
      "",
      "- 일간/주간/월간 조회를 구현한다.",
      "",
      "## Step 6. 초대 기능",
      "",
      "- 공유 링크를 만든다.",
      "",
      "## Step 7. 성능 테스트",
      "",
      "- 성능 테스트 계획을 만든다.",
    ].join("\n")

    const capture = runPersonaCli(["workflow", "capture", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: promptRequirements,
    })
    const split = runPersonaCli(["workflow", "split"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(capture.status).toBe(0)
    expect(capture.stdout).toContain("Workflow requirements captured")
    expect(existsSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"))).toBe(true)
    expect(split.status).toBe(0)
    expect(split.stdout).toContain("Tickets created: 7")
    const card = readFileSync(join(projectDir, ".persona", "workflow", "work", "step-1", "00-task-card.md"), "utf8")
    expect(card).toContain("Source kind: prompt")
    expect(card).toContain("Source path: .persona/workflow/requirements/latest.md")
    expect(card).toContain("- 프롬프트로 받은 일정을 등록한다.")
  })

  it("prints the first pending ticket with its task card path", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "next"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Workflow Next Ticket")
    expect(result.stdout).toContain("Ticket: step-1")
    expect(result.stdout).toContain(".persona/workflow/work/step-1/00-task-card.md")
    expect(result.stdout).toContain("Implement only this ticket")
  })

  it("archives a work ticket into immutable history and advances next ticket", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const archive = runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const next = runPersonaCli(["workflow", "next"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(archive.status).toBe(0)
    expect(archive.stdout).toContain("Workflow ticket archived: step-1")
    expect(existsSync(join(projectDir, ".persona", "workflow", "work", "step-1"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow", "history", "step-1", "00-task-card.md"))).toBe(true)
    const backlog = readFileSync(join(projectDir, ".persona", "workflow", "backlog.md"), "utf8")
    expect(backlog).toContain("| 1 | step-1 | 기본 일정 구현 | archived | .persona/workflow/history/step-1/00-task-card.md |")
    expect(next.stdout).toContain("Ticket: step-2")
  })

  it("refuses to overwrite an existing history ticket", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    mkdirSync(join(projectDir, ".persona", "workflow", "work", "step-1"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "workflow", "work", "step-1", "00-task-card.md"), "# Duplicate\n")

    const result = runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("History already exists")
    expect(result.stderr).toContain("Refusing to overwrite")
  })

  it("fails split when no Step headings are found", () => {
    const projectDir = createHarnessProject()
    writeFileSync(join(projectDir, "README.md"), "# API\n\n- no step headings\n")

    const result = runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("No Step sections found")
  })

  it("fails split without a source file or captured prompt source", () => {
    const projectDir = createHarnessProject()

    const result = runPersonaCli(["workflow", "split"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow requirement source not found")
    expect(result.stderr).toContain("npx ph workflow capture --stdin")
  })

  it("blocks implementation finish while pending workflow tickets remain", () => {
    const projectDir = createHarnessProject()
    writeStepReadme(projectDir)
    mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## README ranges read",
        "- 1-220",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n")
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    expect(runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["workflow", "archive", "step-1"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Pending workflow tickets remain: step-2, step-3")
    expect(result.stderr).toContain("Run `npx ph workflow next`")
  })

  it("keeps workflow ticket commands inactive before Persona Harness opt-in", () => {
    const projectDir = createTempProject()
    writeStepReadme(projectDir)

    const result = runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Persona Harness is not initialized")
    expect(result.stderr).toContain("npx ph init")
  })
})
