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

  it("reports completed workflow as PASS when bearshell command discipline is observed", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: PASS")
    expect(result.stdout).toContain("- command discipline: bearshell observed")
    expect(result.stdout).toContain("Next: archive completed workflow")
  })

  it("keeps completed workflow WARN when bearshell command discipline is missing", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- [x] raw shell을 직접 썼고 `npx ph bearshell`은 제공되지 않았다.\n- [x] `./gradlew test build`\n",
    )
    writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- [x] HTTP smoke checked.\n")
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain("- command discipline: raw shell used for final verification; rerun test/build/bootRun through `npx ph bearshell`")
    expect(result.stdout).toContain("Next: rerun final verification through `npx ph bearshell`")
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
    expect(smokeReport).toContain("## Local Integration")
    expect(smokeReport).toContain("OpenCode:")
    expect(smokeReport).toContain("Persona plugin path:")
    expect(smokeReport).toContain("Rules surface:")
    expect(smokeReport).toContain("Stale fixture scan:")
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

describe("ph workflow guard", () => {
  it("blocks implementation until the plan is accepted", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow guard failed: implement")
    expect(result.stderr).toContain(".persona/workflow/plan.md must be accepted")
  })

  it("allows implementation after the plan is accepted and report templates exist", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Guard: implement")
    expect(result.stdout).toContain("Guard status: PASS")
    expect(result.stdout).toContain("npx ph plan --implement")
  })

  it("blocks final answer until implementation and review reports are filled", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow guard failed: final")
    expect(result.stderr).toContain(".persona/workflow/review-report.md must be filled")
  })

  it("allows final answer after workflow reports are filled and bearshell discipline is observed", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")

    const result = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Guard: final")
    expect(result.stdout).toContain("Guard status: PASS")
    expect(result.stdout).toContain("final answer may be reported")
  })

  it("keeps workflow check report-only even when final guard fails", () => {
    const projectDir = createTempProject()

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const guard = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(guard.status).toBe(1)
  })
})

describe("ph workflow start and finish", () => {
  it("blocks implementation start until the accepted-plan gate passes", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "start", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow start failed: implement")
    expect(result.stderr).toContain(".persona/workflow/plan.md must be accepted")
  })

  it("prints the AI-facing implementation rail after the accepted-plan gate passes", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "start", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Start: implement")
    expect(result.stdout).toContain("npx ph plan --implement")
    expect(result.stdout).toContain("Short TUI request detected")
    expect(result.stdout).toContain("README.md 보고 구현해줘")
    expect(result.stdout).toContain("Use codegraph MCP before raw file reads")
    expect(result.stdout).toContain("Do not read `.persona/rules` directly")
    expect(result.stdout).toContain("Use `npx ph bearshell` for shell verification")
    expect(result.stdout).toContain("npx ph plan --report-filled implementation")
    expect(result.stdout).toContain("Do not give the final answer until `npx ph workflow finish implement` passes")
    expect(result.stdout).toContain("npx ph workflow finish implement")
  })

  it("blocks implementation finish until final workflow evidence passes", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow finish failed: implement")
    expect(result.stderr).toContain(".persona/workflow/review-report.md must be filled")
  })

  it("allows implementation finish after final guard evidence passes", () => {
    const projectDir = createTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Finish: implement")
    expect(result.stdout).toContain("Finish status: PASS")
    expect(result.stdout).toContain("final answer may be reported")
    expect(result.stdout).toContain("npx ph history --id <run-id>")
  })
})
