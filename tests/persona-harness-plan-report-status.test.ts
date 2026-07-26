import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-plan-report-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph plan report status errors", () => {
  it("fails report status changes when workflow reports do not exist", () => {
    const projectDir = createTempProject()

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
    const invalid = runPersonaCli(["plan", "--report-filled", "unknown"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(implementation.status).toBe(1)
    expect(implementation.stderr).toContain("No implementation report found")
    expect(review.status).toBe(1)
    expect(review.stderr).toContain("No review report found")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain("Report kind must be implementation or review.")
  })

  it("reports malformed workflow report status files without crashing", () => {
    const projectDir = createTempProject()
    const workflowDir = join(projectDir, ".persona", "workflow")
    mkdirSync(workflowDir, { recursive: true })
    writeFileSync(join(workflowDir, "implementation-report.md"), "Status")

    const result = runPersonaCli(["plan", "--report-filled", "implementation"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("No Status line found in .persona/workflow/implementation-report.md.")
  })

  it("updates workflow report status frontmatter without requiring a legacy Status line", () => {
    const projectDir = createTempProject()
    const workflowDir = join(projectDir, ".persona", "workflow")
    const reportPath = join(workflowDir, "implementation-report.md")
    mkdirSync(workflowDir, { recursive: true })
    writeFileSync(
      reportPath,
      [
        "---",
        "status: template",
        "---",
        "# Implementation Report",
        "",
        "- README ranges read: 1-220",
        "- Project profile ranges read: all",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )

    const result = runPersonaCli(["plan", "--report-filled", "implementation"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    const updatedReport = readFileSync(reportPath, "utf8")
    expect(updatedReport).toContain("status: filled")
    expect(updatedReport).not.toContain("Status: filled")
  })

  it("submits one bounded substantive report through the public stdin surface", () => {
    const projectDir = createTempProject()
    const workflowDir = join(projectDir, ".persona", "workflow")
    const reportPath = join(workflowDir, "implementation-report.md")
    mkdirSync(workflowDir, { recursive: true })
    writeFileSync(reportPath, "Status: template\n")

    const result = runPersonaCli(["plan", "--report-filled", "implementation", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: [
        "Status: filled",
        "- README ranges read: 1-220",
        "- Project profile ranges read: all",
        "- `npx ph bearshell ./gradlew test`",
      ].join("\n"),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow report: .persona/workflow/implementation-report.md")
    expect(readFileSync(reportPath, "utf8")).toContain("Status: filled")
  })

  it("rejects malformed, oversized, and replacement stdin without changing a template report", () => {
    const projectDir = createTempProject()
    const workflowDir = join(projectDir, ".persona", "workflow")
    const reportPath = join(workflowDir, "review-report.md")
    const template = "Status: template\n"
    mkdirSync(workflowDir, { recursive: true })
    writeFileSync(reportPath, template)

    const malformed = runPersonaCli(["plan", "--report-filled", "review", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: "Status: template\n- Manual QA reviewed the boundary.\n- `npx ph bearshell ./gradlew build`",
    })
    const oversized = runPersonaCli(["plan", "--report-filled", "review", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: `Status: filled\n${"x".repeat(64 * 1024)}`,
    })

    expect(malformed.status).toBe(1)
    expect(malformed.stderr).toContain("must declare exactly one filled Status value")
    expect(oversized.status).toBe(1)
    expect(oversized.stderr).toContain("exceeds the 65536-byte limit")
    expect(readFileSync(reportPath, "utf8")).toBe(template)
  })
})
