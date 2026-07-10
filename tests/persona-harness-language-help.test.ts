import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-language-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph help and language", () => {
  it("shows public usage from ph help without exposing language discovery", () => {
    const result = runPersonaCli(["help"], { cwd: createTempProject(), env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Usage: ph <command> [args...]")
    expect(result.stdout).toContain("Public commands:")
    expect(result.stdout).not.toContain("  language")
  })

  it("prints supported user languages for intake and agent output", () => {
    const result = runPersonaCli(["language"], { cwd: createTempProject(), env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Persona Harness supported languages")
    expect(result.stdout).toContain("ko")
    expect(result.stdout).toContain("en")
    expect(result.stdout).toContain("ja")
    expect(result.stdout).toContain("zh-cn")
    expect(result.stdout).toContain("Profile question id: user-language")
  })

  it("shows language help and rejects unknown language options", () => {
    const projectDir = createTempProject()

    const help = runPersonaCli(["language", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const invalid = runPersonaCli(["language", "--unknown"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("Usage: ph language")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain("Unknown option: --unknown")
  })
})
