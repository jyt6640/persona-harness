import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { rulePackContentHash } from "../src/rules/rule-delivery.js"

type ReportMarkdownCase = {
  readonly name: string
  readonly implementationStatusLine: string
  readonly reviewStatusLine: string
  readonly readmeCoverageBlock: readonly string[]
  readonly profileCoverageBlock: readonly string[]
}

const tempProjects: string[] = []

const REPORT_MARKDOWN_CASES: readonly ReportMarkdownCase[] = [
  {
    name: "plain status with inline range fields",
    implementationStatusLine: "Status: filled",
    reviewStatusLine: "Status: filled",
    readmeCoverageBlock: ["- README ranges read: 1-220"],
    profileCoverageBlock: ["- Project profile ranges read: all"],
  },
  {
    name: "checklist bold status with multiline field and heading ranges",
    implementationStatusLine: "- **Status:** filled",
    reviewStatusLine: "- **Status:** filled",
    readmeCoverageBlock: ["- README ranges read:", "  - 1-220"],
    profileCoverageBlock: ["## Project profile ranges read", "all"],
  },
  {
    name: "bold status with heading ranges",
    implementationStatusLine: "**Status**: filled",
    reviewStatusLine: "**Status**: filled",
    readmeCoverageBlock: ["## README ranges read", "complete"],
    profileCoverageBlock: ["## Profile ranges read", "1-80"],
  },
] as const

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-status-parser-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeJavaBackendMarkers(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
}

function writeStructuredVerificationSuccessEvidence(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({ command: "npx ph bearshell --shell './gradlew test'", status: 0, tool: "bearshell", toolOutput: "BUILD SUCCESSFUL" }, null, 2)}\n`,
  )
}

function writeCurrentLoopStates(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "workflow-loop-state.json"),
    `${JSON.stringify({
      finalDecision: "not-run",
      iterations: [],
      rulePackHash: rulePackContentHash(projectDir),
      schemaVersion: "workflow-loop-state.2",
      startedAt: "2026-07-01T00:00:00.000Z",
    }, null, 2)}\n`,
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "ralph-loop-state.json"),
    `${JSON.stringify({
      schemaVersion: "workflow-ralph-loop-state.1",
      sessions: {},
      updatedAt: "2026-07-01T00:00:00.000Z",
    }, null, 2)}\n`,
  )
}

function createPlannedBackendProject(): string {
  const projectDir = createTempProject()
  writeFileSync(join(projectDir, "README.md"), "# Equipment API\n\n- 장비 등록\n")
  const intake = runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(intake.status).toBe(0)
  expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  writeJavaBackendMarkers(projectDir)
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeStructuredVerificationSuccessEvidence(projectDir)
  writeCurrentLoopStates(projectDir)
  return projectDir
}

function writeReports(projectDir: string, markdownCase: ReportMarkdownCase): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "# Implementation Report",
      "",
      markdownCase.implementationStatusLine,
      "",
      ...markdownCase.readmeCoverageBlock,
      ...markdownCase.profileCoverageBlock,
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    ["# Review Report", "", markdownCase.reviewStatusLine, "", "- `npx ph bearshell --shell './gradlew bootRun'`"].join(
      "\n",
    ),
  )
}

function writeFrontmatterReports(projectDir: string, implementationStatus: string, reviewStatus: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "---",
      `status: ${implementationStatus}`,
      "---",
      "# Implementation Report",
      "",
      "- README ranges read: 1-220",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "---",
      `status: ${reviewStatus}`,
      "---",
      "# Review Report",
      "",
      "- `npx ph bearshell --shell './gradlew bootRun'`",
    ].join("\n"),
  )
}

function writeConflictingReports(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "---",
      "status: template",
      "---",
      "# Implementation Report",
      "",
      "Status: filled",
      "- README ranges read: 1-220",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "---",
      "status: template",
      "---",
      "# Review Report",
      "",
      "Status: filled",
      "- `npx ph bearshell --shell './gradlew bootRun'`",
    ].join("\n"),
  )
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("workflow report status parser", () => {
  it.each(REPORT_MARKDOWN_CASES)("$name reaches check as filled while finish requires trusted authority", (markdownCase) => {
    const projectDir = createPlannedBackendProject()
    writeReports(projectDir, markdownCase)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain(".persona/workflow/implementation-report.md: filled")
    expect(check.stdout).toContain(".persona/workflow/review-report.md: filled")
    expect(check.stdout).toContain("read coverage: README ranges observed")
    expect(check.stdout).toContain("profile read coverage: project profile ranges observed")
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("connects report-filled status updates to workflow check while finish requires trusted authority", () => {
    const projectDir = createPlannedBackendProject()
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "# Implementation Report",
        "",
        "Status: template",
        "- README ranges read: 1-220",
        "- Project profile ranges read: all",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      [
        "# Review Report",
        "",
        "Status: template",
        "- Requirements reviewed against the accepted plan.",
        "- Manual QA completed.",
        "- `npx ph bearshell --shell './gradlew bootRun'`",
      ].join("\n"),
    )

    const implementation = runPersonaCli(["plan", "--report-filled", "implementation"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const review = runPersonaCli(["plan", "--report-filled", "review"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(implementation.status).toBe(0)
    expect(review.status).toBe(0)
    expect(check.status).toBe(0)
    expect(check.stdout).toContain(".persona/workflow/implementation-report.md: filled")
    expect(check.stdout).toContain(".persona/workflow/review-report.md: filled")
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("accepts report status frontmatter without legacy Status lines", () => {
    const projectDir = createPlannedBackendProject()
    writeFrontmatterReports(projectDir, "filled", "filled")

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain(".persona/workflow/implementation-report.md: filled")
    expect(check.stdout).toContain(".persona/workflow/review-report.md: filled")
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("fails closed when frontmatter and legacy report statuses conflict", () => {
    const projectDir = createPlannedBackendProject()
    writeConflictingReports(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain(".persona/workflow/implementation-report.md: conflicting")
    expect(check.stdout).toContain(".persona/workflow/review-report.md: conflicting")
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: implementation-report-conflicting")
  })
})
