import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const temporaryProjects: string[] = []

afterEach(() => {
  for (const projectDir of temporaryProjects) rmSync(projectDir, { force: true, recursive: true })
  temporaryProjects.length = 0
})

describe("context-only CLI routing", () => {
  it("makes the experimental track and all bounded commands discoverable", () => {
    const projectDir = createProject()
    const rootHelp = runPersonaCli(["--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const contextHelp = runPersonaCli(["context", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(rootHelp.status).toBe(0)
    expect(rootHelp.stdout).toContain("Workflow Integrity")
    expect(rootHelp.stdout).toContain("Context Personalization (Experimental)")
    expect(rootHelp.stdout).toContain("  context")
    expect(contextHelp.status).toBe(0)
    expect(contextHelp.stdout).toContain("Usage: ph context <init|status|preview|explain|doctor>")
    for (const command of ["init", "status", "preview <target-file>", "explain <target-file>", "doctor"]) {
      expect(contextHelp.stdout).toContain(command)
    }
  })

  it("keeps discovery commands default-off and preview-only without project mutation", () => {
    const projectDir = createProject()
    const before = readdirSync(projectDir)
    const init = runPersonaCli(["context", "init"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const status = runPersonaCli(["context", "status"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const doctor = runPersonaCli(["context", "doctor"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(init).toMatchObject({ status: 0, stderr: "" })
    expect(init.stdout).toContain("Initialization: preview-only")
    expect(init.stdout).toContain("Context enabled: false")
    expect(init.stdout).toContain("No files were written.")
    expect(status).toMatchObject({ status: 0, stderr: "" })
    expect(status.stdout).toContain("Context Core: available")
    expect(doctor).toMatchObject({ status: 0, stderr: "" })
    expect(doctor.stdout).toContain("Context Core: available")
    expect(doctor.stdout).toContain("Network access: not used")
    expect(doctor.stdout).toContain("Shell access: not used")
    expect(readdirSync(projectDir)).toEqual(before)
  })

  it("keeps explain read-only while failing closed for a missing target", () => {
    const projectDir = createProject()
    const result = runPersonaCli(["context", "explain"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    expect(result).toEqual({ status: 1, stdout: "", stderr: "context-target-required\n" })
    expect(readdirSync(projectDir)).toEqual([])
  })

  it("returns bounded usage for malformed input without reflecting it", () => {
    const projectDir = createProject()
    const unsafeInput = "unknown-secret-value"
    const unknown = runPersonaCli(["context", unsafeInput], { cwd: projectDir, env: {}, invocationName: "ph" })
    const missingTarget = runPersonaCli(["context", "preview"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(unknown.status).toBe(1)
    expect(unknown.stderr).toContain("Unknown context command.")
    expect(unknown.stderr).not.toContain(unsafeInput)
    expect(missingTarget.status).toBe(1)
    expect(missingTarget.stderr).toContain("context-target-required")
  })

  it("keeps context dispatch source free of workflow, authority, host, network, and process dependencies", () => {
    const source = readFileSync(resolve(process.cwd(), "src/cli/context-command.ts"), "utf8")
    const forbidden = [
      "workflow",
      "socratic-interview",
      "authority",
      "evidence",
      "@opencode-ai/plugin",
      "node:child_process",
      "node:http",
      "node:https",
      "fetch(",
      "spawn(",
      "exec(",
    ]

    for (const token of forbidden) expect(source).not.toContain(token)
  })
})

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-context-command-test-"))
  temporaryProjects.push(projectDir)
  return projectDir
}
