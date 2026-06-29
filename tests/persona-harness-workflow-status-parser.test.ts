import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

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

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("workflow report status parser", () => {
  it.each(REPORT_MARKDOWN_CASES)("$name reaches check and finish as filled", (markdownCase) => {
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
    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
  })

  it("connects report-filled status updates to workflow check and finish", () => {
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
      ["# Review Report", "", "Status: template", "- `npx ph bearshell --shell './gradlew bootRun'`"].join("\n"),
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
    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
  })
})
