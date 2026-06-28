import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createProfiledProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-continue-ux-test-"))
  tempProjects.push(projectDir)
  const intake = runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(intake.status).toBe(0)
  const plan = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(plan.status).toBe(0)
  const accept = runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(accept.status).toBe(0)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow continue UX", () => {
  it("prints empty continuation evidence guidance once when reports are still templates", () => {
    const projectDir = createProfiledProject()

    const result = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Persona Harness resume prompt")
    expect(result.stdout.match(/No filled continuation evidence found/g)?.length).toBe(1)
    expect(result.stdout).toContain("npx ph workflow implement")
  })

  it("carries raw final verification blockers into the continuation prompt", () => {
    const projectDir = createProfiledProject()
    writeFileSync(join(projectDir, "README.md"), "# Task API\n\n- Build a backend API.\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "- README ranges read: 1-220",
        "- Project profile ranges read: all",
        "- Plan ranges read: all",
        "- final verification used raw shell: ./gradlew test",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- manual QA reviewed generated API surface\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")

    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const resume = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Rerun final verification through `npx ph bearshell`.")
    expect(resume.status).toBe(0)
    expect(resume.stdout).toContain("Final verification needs bearshell rerun.")
    expect(resume.stdout).toContain("Next action: rerun final verification through `npx ph bearshell`")
    expect(resume.stdout).toContain("Do not claim overall completion until final verification is recorded through bearshell.")
  })

  it("includes the pending ticket card context in the continuation prompt", () => {
    const projectDir = createProfiledProject()
    mkdirSync(join(projectDir, ".persona", "workflow", "work", "req-2"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "workflow", "backlog.md"),
      [
        "# Persona Workflow Backlog",
        "",
        "Status: active",
        "",
        "| Order | Ticket | Title | Status | Path |",
        "| --- | --- | --- | --- | --- |",
        "| 1 | req-1 | Task CRUD API | archived | .persona/workflow/history/req-1/00-task-card.md |",
        "| 2 | req-2 | Return API | pending | .persona/workflow/work/req-2/00-task-card.md |",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "work", "req-2", "00-task-card.md"),
      [
        "# Task Card: Requirement 2. Return API",
        "",
        "Status: pending",
        "Ticket: req-2",
        "",
        "## Goal",
        "",
        "Implement Return API from the source requirements.",
        "",
        "## Source Requirement",
        "",
        "- Add POST /lendings/{id}/return.",
        "- Persist returnedAt and reject duplicate returns.",
      ].join("\n"),
    )

    const result = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Pending workflow ticket:")
    expect(result.stdout).toContain("Ticket: req-2")
    expect(result.stdout).toContain("Title: Return API")
    expect(result.stdout).toContain("Task card context:")
    expect(result.stdout).toContain("- # Task Card: Requirement 2. Return API")
    expect(result.stdout).toContain("- Implement Return API from the source requirements.")
    expect(result.stdout).toContain("- Add POST /lendings/{id}/return.")
    expect(result.stdout).toContain("Next command: npx ph workflow next")
    expect(result.stdout).toContain("Do not claim overall completion while this ticket remains pending.")
  })
})
