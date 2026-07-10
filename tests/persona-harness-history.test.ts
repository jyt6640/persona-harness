import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-history-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createProfiledTempProject(): string {
  const projectDir = createTempProject()
  const result = runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  return projectDir
}

function workflowPath(projectDir: string, path: string): string {
  return join(projectDir, ".persona", "workflow", path)
}

function writeWorkflowArtifacts(projectDir: string): void {
  const plan = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(plan.status).toBe(0)
  writeFileSync(workflowPath(projectDir, "plan.md"), "completed plan\n")
  writeFileSync(workflowPath(projectDir, "implementation-report.md"), "implementation evidence\n")
  writeFileSync(workflowPath(projectDir, "review-report.md"), "review evidence\n")
}

function writeEvidenceSummary(projectDir: string): void {
  const evidenceDir = join(projectDir, ".persona", "evidence")
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, "summary.md"), "# Persona Evidence Summary\n\nTotal evidence files: 2\n")
}

function readHistoryFile(projectDir: string, archiveId: string, filename: string): string {
  return readFileSync(workflowPath(projectDir, join("history", archiveId, filename)), "utf8")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph history", () => {
  it("archives completed workflow artifacts without removing active files", () => {
    const projectDir = createProfiledTempProject()
    writeWorkflowArtifacts(projectDir)
    writeEvidenceSummary(projectDir)

    const result = runPersonaCli(["history", "--id", "run-001"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness workflow history archived.")
    expect(result.stdout).toContain(`Archive: ${workflowPath(projectDir, "history/run-001")}`)
    expect(result.stdout).toContain(`Summary: ${workflowPath(projectDir, "history/run-001/summary.md")}`)
    expect(result.stdout).toContain(`Evidence summary source: ${join(projectDir, ".persona", "evidence", "summary.md")}`)
    expect(readHistoryFile(projectDir, "run-001", "plan.md")).toBe("completed plan\n")
    expect(readHistoryFile(projectDir, "run-001", "implementation-report.md")).toBe("implementation evidence\n")
    expect(readHistoryFile(projectDir, "run-001", "review-report.md")).toBe("review evidence\n")
    expect(readHistoryFile(projectDir, "run-001", "summary.md")).toContain("Archived Files")
    expect(readHistoryFile(projectDir, "run-001", "summary.md")).toContain("Evidence Summary")
    expect(readHistoryFile(projectDir, "run-001", "summary.md")).toContain("Total evidence files: 2")
    expect(readFileSync(workflowPath(projectDir, "plan.md"), "utf8")).toBe("completed plan\n")
  })

  it("records missing workflow artifacts in the history summary", () => {
    const projectDir = createProfiledTempProject()
    const plan = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
    expect(plan.status).toBe(0)
    rmSync(workflowPath(projectDir, "review-report.md"))

    const result = runPersonaCli(["history", "--id", "missing-review"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(existsSync(workflowPath(projectDir, "history/missing-review/review-report.md"))).toBe(false)
    const summary = readHistoryFile(projectDir, "missing-review", "summary.md")
    expect(summary).toContain("- plan.md")
    expect(summary).toContain("- implementation-report.md")
    expect(summary).toContain("- review-report.md")
  })

  it("fails when there are no workflow artifacts to archive", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["history", "--id", "empty"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("No workflow artifacts found")
    expect(existsSync(workflowPath(projectDir, "history/empty"))).toBe(false)
  })

  it("does not overwrite an existing history archive id", () => {
    const projectDir = createProfiledTempProject()
    writeWorkflowArtifacts(projectDir)

    const first = runPersonaCli(["history", "--id", "same-id"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const duplicate = runPersonaCli(["history", "--id", "same-id"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(duplicate.status).toBe(1)
    expect(duplicate.stderr).toContain("already exists")
  })

  it("shows usage and rejects invalid archive ids without advertising history at the public front door", () => {
    const projectDir = createTempProject()

    const help = runPersonaCli(["history", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const invalid = runPersonaCli(["history", "--id", "../bad"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const rootHelp = runPersonaCli(["--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("Usage: ph history")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain("Archive id may contain")
    expect(rootHelp.stdout).not.toContain("  history")
  })
})
