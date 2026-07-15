import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { writeFileAtomic } from "../src/io/atomic-file.js"
import { formatRuntimeWarning } from "../src/runtime/error-boundary.js"
import { writePrivateEvidenceJson } from "../src/runtime/evidence-file.js"
import { writeIntentEvidence } from "../src/runtime/evidence.js"
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

  it("recursively sanitizes role metadata after secret masking and path-shaped prefixes", () => {
    const projectDir = createProject()
    const externalDir = mkdtempSync(join(tmpdir(), "persona-evidence-external-"))
    projects.push(externalDir)
    const token = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const projectPath = join(projectDir, "src", "main", "java", "App.java")
    const externalPath = join(externalDir, "nested-external-marker.txt")
    const windowsPath = "C:\\Users\\runner\\external-windows-marker.txt"
    const uncPath = "\\\\server\\share\\external-unc-marker.txt"
    const sentinelPath = "[REDACTED]-/path"

    appendRoleBoundaryObservation(projectDir, {
      callID: `${token}-${externalPath} ${sentinelPath}`,
      currentTicketId: `${token}-${projectPath} ${sentinelPath}`,
      path: projectPath,
      policy: `${token}-${externalPath} ${sentinelPath}`,
      role: "implementer",
      sessionID: "session-recursive-path-privacy",
    })
    const nestedPath = join(projectDir, ".persona", "evidence", "nested", "metadata.json")
    writePrivateEvidenceJson(join(projectDir, ".persona", "evidence"), nestedPath, {
      nested: {
        arrays: [`${token}-${externalPath}`, [projectPath, windowsPath, uncPath, sentinelPath]],
        currentTicketId: `${token}-${projectPath} ${sentinelPath}`,
      },
    }, { projectDir })

    const roleSource = readFileSync(evidenceFiles(projectDir, "role-boundary")[0] ?? "", "utf8")
    const nestedSource = readFileSync(nestedPath, "utf8")
    const source = `${roleSource}\n${nestedSource}`
    expect(source).not.toContain(token)
    expect(source).not.toContain(projectDir)
    expect(source).not.toContain(externalDir)
    expect(source).not.toContain(windowsPath)
    expect(source).not.toContain(uncPath)
    expect(source).not.toContain(sentinelPath)
    expect(source).toContain("src/main/java/App.java")
    expect(source).toContain("[REDACTED_PATH]")
  })

  it("sanitizes sentinel-prefixed paths in opt-in intent evidence", () => {
    const projectDir = createProject("prompt_diagnostics")
    const externalDir = mkdtempSync(join(tmpdir(), "persona-evidence-external-"))
    projects.push(externalDir)
    const externalPath = join(externalDir, "intent-external-marker.txt")
    writeIntentEvidence(projectDir, {
      hook: "experimental.chat.messages.transform",
      injectedInto: "intent-workflow",
      intent: {
        primary: "programming",
        reason: "Direct code creation or edit request detected.",
        secondary: [],
      },
      railMarker: "[Persona Harness Programming Workflow]",
      sessionID: "intent-path-privacy",
      userPrompt: `[REDACTED]-/path ${externalPath}`,
    })

    const files = evidenceFiles(projectDir, "phase0")
    expect(files).toHaveLength(1)
    const source = readFileSync(files[0] ?? "", "utf8")
    expect(source).not.toContain("[REDACTED]-/path")
    expect(source).not.toContain(externalDir)
    expect(source).toContain("[REDACTED_PATH]")
  })
})
