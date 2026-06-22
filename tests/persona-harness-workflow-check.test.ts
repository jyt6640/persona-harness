import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-check-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow check", () => {
  it("reports missing workflow artifacts without failing the command", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain(".persona/workflow/plan.md: missing")
    expect(result.stdout).toContain("Next: run `npx ph plan`")
  })

  it("reports accepted plan, filled implementation report, and evidence presence", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain(".persona/workflow/plan.md: accepted")
    expect(result.stdout).toContain(".persona/workflow/implementation-report.md: filled")
    expect(result.stdout).toContain(".persona/workflow/review-report.md: template")
    expect(result.stdout).toContain(".persona/evidence: present")
    expect(result.stdout).toContain("Next: fill review report")
  })

  it("creates smoke and feedback reports from the workflow status", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const smoke = runPersonaCli(["smoke"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const feedback = runPersonaCli(["feedback"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(smoke.status).toBe(0)
    expect(smoke.stdout).toContain("Smoke report written")
    expect(feedback.status).toBe(0)
    expect(feedback.stdout).toContain("Feedback template written")
    const smokeReport = readFileSync(join(projectDir, ".persona", "workflow", "smoke-report.md"), "utf8")
    const feedbackReport = readFileSync(join(projectDir, ".persona", "workflow", "feedback-report.md"), "utf8")
    expect(smokeReport).toContain("# Persona Harness Smoke Report")
    expect(smokeReport).toContain("Workflow status:")
    expect(feedbackReport).toContain("# Persona Harness Tester Feedback")
    expect(feedbackReport).toContain("## 실제 프로젝트에 쓸 수 있나?")
  })

  it("keeps smoke report output directory creation idempotent", () => {
    const projectDir = createTempProject()
    const first = runPersonaCli(["smoke"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const second = runPersonaCli(["smoke"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(existsSync(join(projectDir, ".persona", "workflow", "smoke-report.md"))).toBe(true)
  })
})
