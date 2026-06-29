import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-closure-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createWorkflowProject(planStatus = "accepted"): string {
  const projectDir = createTempProject()
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), `Status: ${planStatus}\n`)
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  return projectDir
}

function writeEvidence(projectDir: string, text: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "verification.json"), `${JSON.stringify({ toolOutput: text }, null, 2)}\n`)
}

function writeStructuredVerificationEvidence(projectDir: string, status: number, text: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({ command: "npx ph bearshell ./gradlew test", status, toolOutput: text, tool: "bearshell" }, null, 2)}\n`,
  )
}

function writeJUnitResult(projectDir: string, xmlText: string): void {
  mkdirSync(join(projectDir, "build", "test-results", "test"), { recursive: true })
  writeFileSync(join(projectDir, "build", "test-results", "test", "TEST-sample.xml"), xmlText)
}

function writeFilledReports(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    ["Status: filled", "- README ranges read: all", "- Project profile ranges read: all", "- `npx ph bearshell ./gradlew test`", "BUILD SUCCESSFUL"].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    ["Status: filled", "- `npx ph bearshell ./gradlew bootRun`", "Tomcat started on port 8080", "Started TaskApplication"].join("\n"),
  )
}

function writeActiveTicket(projectDir: string, ticketId = "req-1"): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", ticketId), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "backlog.md"),
    [
      "# Persona Workflow Backlog",
      "",
      "Status: active",
      "",
      "| Order | Ticket | Title | Status | Path |",
      "| --- | --- | --- | --- | --- |",
      `| 1 | ${ticketId} | Task CRUD API | pending | .persona/workflow/work/${ticketId}/00-task-card.md |`,
    ].join("\n"),
  )
  writeFileSync(join(projectDir, ".persona", "workflow", "work", ticketId, "00-task-card.md"), `# Task Card: ${ticketId}\n`)
}

function writeHistoryOnlyTicket(projectDir: string, ticketId = "req-1"): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "history", ticketId), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "backlog.md"),
    [
      "# Persona Workflow Backlog",
      "",
      "Status: active",
      "",
      "| Order | Ticket | Title | Status | Path |",
      "| --- | --- | --- | --- | --- |",
      `| 1 | ${ticketId} | Task CRUD API | pending | .persona/workflow/work/${ticketId}/00-task-card.md |`,
    ].join("\n"),
  )
  writeFileSync(join(projectDir, ".persona", "workflow", "history", ticketId, "00-task-card.md"), `# Task Card: ${ticketId}\n`)
}

function closureJson(projectDir: string, action: "next" | "status" = "next") {
  const result = runPersonaCli(["workflow", "closure", action, "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  return JSON.parse(result.stdout)
}

const REQUIRED_STATE_KEYS = [
  "plan",
  "currentTicket",
  "pendingTickets",
  "implementationReport",
  "reviewReport",
  "evidence",
  "verification",
  "reportCoverage",
  "archive",
  "finish",
  "blockers",
] as const

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow closure read-only planner", () => {
  it("reports plan as the first blocker when workflow plan is missing", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })

    const output = closureJson(projectDir)

    expect(output.state.plan).toBe("missing")
    expect(output.steps[0]).toMatchObject({
      id: "accept-plan",
      kind: "cli-command",
      status: "blocked",
      command: "npx ph plan",
      source: ".persona/workflow/plan.md",
    })
  })

  it("keeps the required state schema stable when no current ticket exists", () => {
    const projectDir = createWorkflowProject()
    writeEvidence(projectDir, "gradlew.bat test\nBUILD SUCCESSFUL")

    const status = closureJson(projectDir, "status")
    const next = closureJson(projectDir, "next")

    for (const key of REQUIRED_STATE_KEYS) {
      expect(Object.hasOwn(status.state, key)).toBe(true)
      expect(Object.hasOwn(next.state, key)).toBe(true)
    }
    expect(status.state.currentTicket).toBeNull()
    expect(next.state.currentTicket).toBeNull()
    expect(Object.hasOwn(status, "nextStep")).toBe(false)
    expect(next.nextStep).toMatchObject(next.steps[0])
  })

  it("uses report content as the first actionable blocker for the post-build alpha6-like state", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL\ngradlew.bat build\nBUILD SUCCESSFUL\nruntime smoke PASS")
    writeActiveTicket(projectDir)

    const output = closureJson(projectDir, "status")

    expect(output.state).toMatchObject({
      plan: "accepted",
      implementationReport: "template",
      reviewReport: "template",
      evidence: "present",
      verification: "passed",
      archive: "pending",
      finish: "blocked",
    })
    expect(output.state.currentTicket).toMatchObject({ id: "req-1", state: "active-work" })
    expect(output.state.pendingTickets).toEqual(["req-1"])
    expect(output.steps[0]).toMatchObject({
      id: "fill-implementation-report",
      kind: "human-or-model-content",
      status: "blocked",
      commandAfterContent: "npx ph plan --report-filled implementation",
      source: ".persona/workflow/implementation-report.md",
      evidenceRef: ".persona/evidence",
    })
  })

  it("orders verification unknown before report closure", () => {
    const projectDir = createWorkflowProject()
    writeEvidence(projectDir, "gradlew.bat test")

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("unknown")
    expect(output.steps[0]).toMatchObject({
      id: "verify-app",
      kind: "human-or-model-content",
      status: "blocked",
      blockerId: "verification-unknown",
    })
    expect(output.steps[1]).toMatchObject({ id: "fill-implementation-report" })
  })

  it("keeps report prose success unknown without structured execution evidence", () => {
    const projectDir = createWorkflowProject()
    writeFilledReports(projectDir)

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("unknown")
    expect(output.steps[0]).toMatchObject({
      id: "verify-app",
      blockerId: "verification-unknown",
      status: "blocked",
    })
    expect(output.steps[0].reason).toContain("no structured execution evidence")
  })

  it("accepts structured bearshell execution success evidence", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL")

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("passed")
    expect(output.steps[0]).toMatchObject({ id: "fill-implementation-report" })
  })

  it("orders explicit verification failure before report closure", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 1, "gradlew.bat build\nBUILD FAILED\nCould not resolve org.springframework.boot:spring-boot-starter-web:.")

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("failed")
    expect(output.steps[0]).toMatchObject({
      id: "fix-verification",
      kind: "human-or-model-content",
      status: "blocked",
      blockerId: "verification-failed",
    })
  })

  it("orders JUnit XML verification failure before report closure", () => {
    const projectDir = createWorkflowProject()
    writeJUnitResult(projectDir, '<testsuite tests="2" failures="1" errors="0" skipped="0"></testsuite>\n')

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("failed")
    expect(output.steps[0]).toMatchObject({
      id: "fix-verification",
      blockerId: "verification-failed",
      status: "blocked",
    })
    expect(output.steps[0].reason).toContain("JUnit XML")
  })

  it("moves from implementation report to review report after implementation is filled", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL")
    writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: filled\n- verification evidence recorded\n")

    const output = closureJson(projectDir)

    expect(output.steps[0]).toMatchObject({
      id: "fill-review-report",
      kind: "human-or-model-content",
      status: "blocked",
      commandAfterContent: "npx ph plan --report-filled review",
      source: ".persona/workflow/review-report.md",
    })
  })

  it("keeps pending active tickets behind a review confirmation boundary", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL\ngradlew.bat build\nBUILD SUCCESSFUL")
    writeFilledReports(projectDir)
    writeActiveTicket(projectDir)

    const output = closureJson(projectDir)

    expect(output.steps[0]).toMatchObject({
      id: "archive-current-ticket",
      kind: "human-or-model-content",
      status: "blocked",
      blockerId: "pending-ticket",
      commandAfterContent: "npx ph workflow archive req-1",
    })
  })

  it("shows history-only backlog mismatch as a repairable action without repairing it", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL\ngradlew.bat build\nBUILD SUCCESSFUL")
    writeFilledReports(projectDir)
    writeHistoryOnlyTicket(projectDir)

    const output = closureJson(projectDir)

    expect(output.state.archive).toBe("history-only-repair")
    expect(output.steps[0]).toMatchObject({
      id: "repair-archive-state",
      kind: "cli-command",
      status: "blocked",
      command: "npx ph workflow archive req-1",
      blockerId: "history-backlog-mismatch",
    })
  })

  it("returns a terminal step when finish state is passable", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL\ngradlew.bat build\nBUILD SUCCESSFUL\nTomcat started on port 8080")
    writeFilledReports(projectDir)

    const output = closureJson(projectDir)

    expect(output.state.finish).toBe("passed")
    expect(output.steps[0]).toMatchObject({
      id: "terminal",
      kind: "terminal",
      status: "complete",
    })
  })
})
