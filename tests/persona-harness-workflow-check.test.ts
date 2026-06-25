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

function createProfiledTempProject(): string {
  const projectDir = createTempProject()
  const result = runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  return projectDir
}

function writeProfileReadEvidence(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "2026-06-24T00-00-00-000Z-project-profile.jsonc.json"),
    `${JSON.stringify({ targetFile: join(projectDir, ".persona", "project-profile.jsonc"), fileRole: "project-profile" }, null, 2)}\n`,
  )
}

function writePassingWorkflowEvidence(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: 1-220",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
  )
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
  writeProfileReadEvidence(projectDir)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow check", () => {
  it("reports missing workflow artifacts without failing the command", () => {
    const projectDir = createProfiledTempProject()

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain(".persona/workflow/plan.md: missing")
    expect(result.stdout).toContain("Next: run `npx ph plan`")
  })

  it("guides implementation requests back to intake or bootstrap when .persona exists but the profile is missing", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow implement failed: implement")
    expect(result.stderr).toContain(".persona exists but the backend project profile is not ready")
    expect(result.stderr).toContain(".persona/project-profile.jsonc is required before implementation")
    expect(result.stderr).toContain("Do not enter implementation rail until profile/bootstrap is ready")
    expect(result.stderr).toContain("npx ph intake --interactive")
    expect(result.stderr).toContain("npx ph bootstrap backend")
  })

  it("reports accepted plan, filled implementation report, and evidence presence", () => {
    const projectDir = createProfiledTempProject()
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
    const projectDir = createProfiledTempProject()
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
    writeProfileReadEvidence(projectDir)

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: PASS")
    expect(result.stdout).toContain("- command discipline: bearshell observed")
    expect(result.stdout).toContain("Next: archive completed workflow")
  })

  it("warns and points to workflow next when a pending ticket remains despite passing reports and gates", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writePassingWorkflowEvidence(projectDir)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "backlog.md"),
      [
        "# Persona Workflow Backlog",
        "",
        "Status: active",
        "",
        "| Order | Ticket | Title | Status | Path |",
        "| --- | --- | --- | --- | --- |",
        "| 1 | step-1 | Equipment catalog API | archived | .persona/workflow/history/step-1/00-task-card.md |",
        "| 2 | step-2 | Technical Constraints | pending | .persona/workflow/work/step-2/00-task-card.md |",
      ].join("\n"),
    )

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain("- pending tickets: present")
    expect(result.stdout).toContain("Ticket: step-2")
    expect(result.stdout).toContain("Title: Technical Constraints")
    expect(result.stdout).toContain("Path: .persona/workflow/work/step-2/00-task-card.md")
    expect(result.stdout).toContain("Next: run `npx ph workflow next` or `npx ph workflow continue`")
    expect(result.stdout).toContain("Do not claim overall completion while pending tickets remain.")
    expect(result.stdout).toContain("review/archive candidate")
    expect(result.stdout).not.toContain("Next: archive completed workflow")
  })

  it("recognizes report statuses written as checklist or bold status lines", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "# Implementation Report",
        "",
        "- **Status:** filled",
        "- README ranges read: 1-220",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      [
        "# Review Report",
        "",
        "**Status:** filled",
        "- `npx ph bearshell --shell './gradlew bootRun'`",
      ].join("\n"),
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    writeProfileReadEvidence(projectDir)

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(".persona/workflow/implementation-report.md: filled")
    expect(result.stdout).toContain(".persona/workflow/review-report.md: filled")
  })

  it("warns when the backend profile expects Java Spring Gradle but the generated project is Node/CommonJS", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "package.json"), "{\"type\":\"commonjs\"}\n")
    mkdirSync(join(projectDir, "src"), { recursive: true })
    writeFileSync(join(projectDir, "src", "index.js"), "module.exports = {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- README ranges read: 1-220\n- `npx ph bearshell --shell 'npm test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell 'npm test'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(check.stdout).toContain("stack alignment: STACK_MISMATCH")
    expect(check.stdout).toContain("profile expects Java/Spring/Gradle")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("STACK_MISMATCH")
  })

  it("blocks finish when the backend profile was not read before implementation", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- README ranges read: 1-220\n- `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("profile read coverage: project profile exists but profile read coverage is empty")
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("project profile read coverage must be recorded")
  })

  it("passes profile read coverage when implementation report records project profile read evidence", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "- README ranges read: 1-220",
        "- Project profile read method: npx ph bearshell",
        "- Project profile ranges read: all",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("profile read coverage: project profile ranges observed")
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(finish.status).toBe(0)
  })

  it("infers profile read coverage from Persona evidence", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- README ranges read: 1-220\n- `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "phase0", "2026-06-24T00-00-00-000Z-project-profile.jsonc.json"),
      `${JSON.stringify({ targetFile: join(projectDir, ".persona", "project-profile.jsonc"), fileRole: "project-profile" }, null, 2)}\n`,
    )

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("profile read coverage: project profile read evidence observed")
    expect(check.stdout).toContain("Workflow status: PASS")
  })

  it("keeps completed workflow WARN when bearshell command discipline is missing", () => {
    const projectDir = createProfiledTempProject()
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
    const projectDir = createProfiledTempProject()
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
    const projectDir = createProfiledTempProject()
    const first = runPersonaCli(["smoke"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const second = runPersonaCli(["smoke"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(existsSync(join(projectDir, ".persona", "workflow", "smoke-report.md"))).toBe(true)
  })
})

describe("ph workflow guard", () => {
  it("does not block normal implementation when Persona Harness is not initialized", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness not initialized")
    expect(result.stdout).toContain("Implementation is not blocked")
    expect(result.stdout).toContain("npx ph init")
  })

  it("blocks implementation rail when Persona Harness is initialized but the backend profile is missing", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow implement failed: implement")
    expect(result.stderr).toContain("Harness initialized but project profile is not ready")
    expect(result.stderr).toContain(".persona/project-profile.jsonc is required before implementation")
    expect(result.stderr).toContain("Do not enter implementation rail until profile/bootstrap is ready")
    expect(result.stderr).toContain("npx ph bootstrap backend")
    expect(result.stderr).toContain("npx ph intake --default backend")
  })

  it("blocks implementation until the plan is accepted", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow guard failed: implement")
    expect(result.stderr).toContain(".persona/workflow/plan.md must be accepted")
  })

  it("allows implementation after the plan is accepted and report templates exist", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Guard: implement")
    expect(result.stdout).toContain("Guard status: PASS")
    expect(result.stdout).toContain("npx ph workflow implement")
  })

  it("blocks final answer until implementation and review reports are filled", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow guard failed: final")
    expect(result.stderr).toContain(".persona/workflow/review-report.md must be filled")
  })

  it("allows final answer after workflow reports are filled and bearshell discipline is observed", () => {
    const projectDir = createProfiledTempProject()
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
    writeProfileReadEvidence(projectDir)

    const result = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Guard: final")
    expect(result.stdout).toContain("Guard status: PASS")
    expect(result.stdout).toContain("final answer may be reported")
  })

  it("keeps workflow check report-only even when final guard fails", () => {
    const projectDir = createProfiledTempProject()

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const guard = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(guard.status).toBe(1)
  })
})

describe("ph bootstrap backend", () => {
  it("creates a default backend profile, policy overlay, accepted plan, and workflow reports in a clean project", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness backend bootstrap complete")
    expect(result.stdout).toContain(".persona/harness.jsonc")
    expect(result.stdout).toContain(".persona/rules/")
    expect(result.stdout).toContain(".opencode/opencode.json")
    expect(result.stdout).toContain(".gitignore")
    expect(result.stdout).toContain("AGENTS.md")
    expect(result.stdout).toContain(".persona/project-profile.jsonc")
    expect(result.stdout).toContain(".persona/policies/overlay.jsonc")
    expect(result.stdout).toContain(".persona/workflow/plan.md")
    expect(result.stdout).toContain(".persona/workflow/implementation-report.md")
    expect(result.stdout).toContain(".persona/workflow/review-report.md")
    expect(result.stdout).toContain("npx ph workflow implement")
    expect(existsSync(join(projectDir, ".persona", "harness.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "java-common.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".opencode", "opencode.json"))).toBe(true)
    expect(existsSync(join(projectDir, ".gitignore"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "project-profile.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "policies", "overlay.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "plan.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "implementation-report.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "review-report.md"))).toBe(true)
    expect(readFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "utf8")).toContain("Status: accepted")
    const agents = readFileSync(join(projectDir, "AGENTS.md"), "utf8")
    expect(agents).toContain("Persona Harness")
    expect(agents).toContain("npx ph workflow implement")
    expect(agents).toContain(".persona/project-profile.jsonc")
    expect(agents).toContain("Do not infer a Node/CommonJS project from package.json")
  })

  it("fills missing backend workflow pieces after init without requiring the user to type every command", () => {
    const projectDir = createTempProject()
    const init = runPersonaCli(["init"], { cwd: projectDir, env: {}, invocationName: "ph", packageRoot: process.cwd() })
    expect(init.status).toBe(0)
    rmSync(join(projectDir, ".persona", "project-profile.jsonc"), { force: true })

    const bootstrap = runPersonaCli(["bootstrap", "backend"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })
    const implement = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(bootstrap.status).toBe(0)
    expect(bootstrap.stdout).toContain("created default backend profile")
    expect(implement.status).toBe(0)
    expect(implement.stdout).toContain("Implementation rail status: PASS")
  })

  it("does not overwrite an existing root AGENTS.md during backend bootstrap", () => {
    const projectDir = createTempProject()
    const existingAgents = "# Existing Agent Rules\n\nKeep this project-specific instruction.\n"
    writeFileSync(join(projectDir, "AGENTS.md"), existingAgents)

    const result = runPersonaCli(["bootstrap", "backend"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("AGENTS.md already exists")
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toBe(existingAgents)
  })
})

describe("ph workflow start and finish", () => {
  it("blocks implementation start until the accepted-plan gate passes", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "start", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow start failed: implement")
    expect(result.stderr).toContain(".persona/workflow/plan.md must be accepted")
  })

  it("prints the AI-facing implementation rail after the accepted-plan gate passes", () => {
    const projectDir = createProfiledTempProject()
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

  it("prints the single AI-facing implementation rail with OS-safe README chunk-read commands", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Implement")
    expect(result.stdout).toContain("Implementation rail status: PASS")
    expect(result.stdout).toContain("의도 감지: 구현 요청으로 판단함.")
    expect(result.stdout).toContain("근거: 사용자가 README/요구사항/플랜을 보고 구현하라고 요청한 상황에서 사용하는 AI-facing rail이다.")
    expect(result.stdout).toContain("다음 행동:")
    expect(result.stdout).toContain("1. 요구사항 source를 split/capture/next로 ticket화한다.")
    expect(result.stdout).toContain("2. 현재 ticket만 구현한다.")
    expect(result.stdout).toContain("금지: ticket 없이 바로 production code 작성.")
    expect(result.stdout).toContain("macOS/Linux line count")
    expect(result.stdout).toContain("npx ph bearshell --shell 'wc -l README.md'")
    expect(result.stdout).toContain("macOS/Linux first chunk")
    expect(result.stdout).toContain("npx ph bearshell --shell 'sed -n \"1,220p\" README.md'")
    expect(result.stdout).toContain("Windows PowerShell first chunk")
    expect(result.stdout).toContain("Get-Content README.md -TotalCount 220")
    expect(result.stdout).toContain("Select-Object -Skip 220 -First 220")
    expect(result.stdout).toContain("Get-ChildItem -Recurse -File | Select-String -Pattern")
    expect(result.stdout).not.toContain("Select-String -Recurse")
    expect(result.stdout).toContain("Record README ranges read in `.persona/workflow/implementation-report.md`")
    expect(result.stdout).toContain("If existing Java/Spring source files already exist")
    expect(result.stdout).toContain("existing code wins over greenfield guidance")
    expect(result.stdout).toContain("find src/main/java src/test/java -name \"*.java\"")
    expect(result.stdout).toContain("Get-ChildItem -Path src/main/java,src/test/java -Recurse -File -Filter *.java")
    expect(result.stdout).toContain("Java Role Read Follow-up")
    expect(result.stdout).toContain("Java role discovery/read evidence")
    expect(result.stdout).toContain("Gradle wrapper verification")
    expect(result.stdout).toContain("./gradlew test")
    expect(result.stdout).toContain("gradlew.bat")
    expect(result.stdout).toContain("Do not read `.persona/rules` directly")
    expect(result.stdout).toContain("npx ph workflow finish implement")
  })

  it("blocks the single implementation rail until the plan is accepted", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow implement failed: implement")
    expect(result.stderr).toContain(".persona/workflow/plan.md must be accepted")
  })

  it("blocks implementation finish until final workflow evidence passes", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow finish failed: implement")
    expect(result.stderr).toContain(".persona/workflow/review-report.md must be filled")
  })

  it("allows implementation finish after final guard evidence passes", () => {
    const projectDir = createProfiledTempProject()
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
    writeProfileReadEvidence(projectDir)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Finish: implement")
    expect(result.stdout).toContain("Finish status: PASS")
    expect(result.stdout).toContain("final answer may be reported")
    expect(result.stdout).toContain("npx ph history --id <run-id>")
  })

  it("blocks implementation finish when README exists but README range coverage is empty", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## Read Coverage",
        "- README read method: npx ph bearshell",
        "- README ranges read:",
        "- Plan read method: Read",
        "- Plan ranges read: 1-220",
        "- [x] `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(check.stdout).toContain("README.md exists but README ranges read is empty")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("README ranges read must be recorded")
  })

  it("allows implementation finish when README range coverage is recorded", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## Read Coverage",
        "- README read method: npx ph bearshell",
        "- README ranges read:",
        "  - 1-220",
        "- Plan read method: Read",
        "- Plan ranges read: 1-220",
        "- [x] `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(check.stdout).toContain("read coverage: README ranges observed")
    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
  })

  it("allows implementation finish when README range coverage is recorded under a heading", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "# Implementation Report",
        "",
        "Status: filled",
        "",
        "## README ranges read",
        "",
        "- 1-220",
        "",
        "## Final verification",
        "",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(check.stdout).toContain("read coverage: README ranges observed")
    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
  })

  it("infers README read coverage from Persona evidence when report ranges are missing", () => {
    const projectDir = createProfiledTempProject()
    const readmePath = join(projectDir, "README.md")
    writeFileSync(readmePath, "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## Read Coverage",
        "- README read method: npx ph bearshell",
        "- README ranges read:",
        "- Plan read method: Read",
        "- Plan ranges read: 1-220",
        "- [x] `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "phase0", "2026-06-23T00-00-00-000Z-readme.md.json"),
      `${JSON.stringify({ targetFile: readmePath, fileRole: "project-bootstrap" }, null, 2)}\n`,
    )
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(check.stdout).toContain("read coverage: README read evidence observed")
    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
  })
})
