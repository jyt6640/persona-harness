import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { writeFileAtomic } from "../src/io/atomic-file.js"
import { formatRuntimeWarning } from "../src/runtime/error-boundary.js"
import { appendRoleBoundaryObservation, readRoleBoundaryHeuristicFindings } from "../src/runtime/role-boundary-evidence.js"
import { writeBearshellExecutionEvidence } from "../src/runtime/execution-evidence.js"

const projects: string[] = []

function createProject(evidenceMode = "redacted_diagnostics"): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-path-privacy-"))
  projects.push(projectDir)
  mkdirHarnessConfig(projectDir, evidenceMode)
  return projectDir
}

function mkdirHarnessConfig(projectDir: string, evidenceMode: string): void {
  writeFileAtomic(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({ evidenceMode })}\n`)
}

function evidenceFiles(projectDir: string, category: string): readonly string[] {
  const directory = join(projectDir, ".persona", "evidence", category)
  if (!existsSync(directory)) {
    return []
  }
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => join(directory, fileName))
}

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("evidence absolute path privacy", () => {
  it("stores contained role paths as relative refs and external paths as a fixed marker", () => {
    const projectDir = createProject()
    const externalDir = mkdtempSync(join(tmpdir(), "persona-evidence-external-"))
    projects.push(externalDir)
    const projectPath = join(projectDir, "src", "main", "java", "App.java")
    const externalPath = join(externalDir, "external-secret-marker.txt")

    appendRoleBoundaryObservation(projectDir, {
      currentTicketId: "ticket-path-privacy",
      path: projectPath,
      policy: `outside ${externalPath}`,
      role: "implementer",
      sessionID: "session-path-privacy",
    })

    const files = evidenceFiles(projectDir, "role-boundary")
    expect(files).toHaveLength(1)
    const source = readFileSync(files[0] ?? "", "utf8")
    expect(source).not.toContain(projectDir)
    expect(source).not.toContain(externalDir)
    expect(source).toContain('"path": "src/main/java/App.java"')
    expect(source).toContain("[REDACTED_PATH]")

    const findings = readRoleBoundaryHeuristicFindings(projectDir)
    expect(JSON.stringify(findings)).not.toContain(projectDir)
    expect(JSON.stringify(findings)).not.toContain(externalDir)
  })

  it("redacts execution paths before bounded preview truncation", () => {
    const projectDir = createProject()
    const externalDir = mkdtempSync(join(tmpdir(), "persona-evidence-external-"))
    projects.push(externalDir)
    const projectPath = join(projectDir, "build", "reports", "result.xml")
    const externalPath = join(externalDir, "external-preview-secret-marker.xml")
    const ref = writeBearshellExecutionEvidence(projectDir, {
      command: `./gradlew test --project-dir ${projectPath} --external ${externalPath}`,
      durationMs: 21,
      endedAt: "2026-07-15T12:00:00.000Z",
      status: 0,
      stderr: `${"prefix ".repeat(400)} ${externalPath}`,
      stdout: `${"prefix ".repeat(400)} ${projectPath} ${externalPath}`,
    })

    expect(ref).toMatch(/^\.persona\/evidence\/phase0\/bearshell-[a-f0-9-]+\.json$/u)
    const files = evidenceFiles(projectDir, "phase0")
    expect(files).toHaveLength(1)
    const source = readFileSync(files[0] ?? "", "utf8")
    expect(source).not.toContain(projectDir)
    expect(source).not.toContain(externalDir)
    expect(source).toContain("[REDACTED_PATH]")
    expect(source).toContain("build/reports/result.xml")
  })

  it("keeps runtime warning diagnostics free of absolute paths", () => {
    const projectDir = createProject()
    const externalDir = mkdtempSync(join(tmpdir(), "persona-evidence-external-"))
    projects.push(externalDir)
    const warning = formatRuntimeWarning({
      detail: join(projectDir, "evidence-write.json"),
      error: new Error(join(externalDir, "external-error.txt")),
      kind: "evidence-write",
      scope: "path-privacy",
    })

    expect(warning).not.toContain(projectDir)
    expect(warning).not.toContain(externalDir)
    expect(warning).toContain("[REDACTED_PATH]")
  })
})
