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
    expect(card).toContain("- 일정을 등록한다.")
    expect(card).toContain("No automatic code generation")
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

  it("keeps workflow ticket commands inactive before Persona Harness opt-in", () => {
    const projectDir = createTempProject()
    writeStepReadme(projectDir)

    const result = runPersonaCli(["workflow", "split", "README.md"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Persona Harness is not initialized")
    expect(result.stderr).toContain("npx ph init")
  })
})
