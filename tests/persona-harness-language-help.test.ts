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

  it("keeps default help English and makes explicit English selection identical", () => {
    const projectDir = createTempProject()
    const defaultHelp = runPersonaCli(["--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const explicitEnglish = runPersonaCli(["--help", "--lang", "en"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(defaultHelp.status).toBe(0)
    expect(explicitEnglish.status).toBe(0)
    expect(explicitEnglish.stdout).toBe(defaultHelp.stdout)
    expect(defaultHelp.stdout).not.toContain("공개 명령")
  })

  it("prints Korean public help only after explicit locale selection", () => {
    const result = runPersonaCli(["--help", "--lang", "ko"], { cwd: createTempProject(), env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("사용법: ph <명령> [인자...]")
    expect(result.stdout).toContain("공개 명령:")
    expect(result.stdout).toContain("도움말 언어 선택")
    expect(result.stdout).toContain("ph go")
    expect(result.stdout).not.toContain("Public commands:")
  })

  it("rejects missing, unsupported, and duplicate help locale selection", () => {
    const projectDir = createTempProject()
    const missing = runPersonaCli(["--help", "--lang"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const unsupported = runPersonaCli(["--help", "--lang", "fr"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const duplicate = runPersonaCli(["--help", "--lang", "ko", "--lang", "en"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(missing.status).toBe(1)
    expect(missing.stderr).toContain("--lang requires one of: en, ko")
    expect(unsupported.status).toBe(1)
    expect(unsupported.stderr).toContain("Unsupported help language: fr")
    expect(duplicate.status).toBe(1)
    expect(duplicate.stderr).toContain("--lang may be provided only once")
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
