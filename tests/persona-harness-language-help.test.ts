import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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

function publicCommandNames(output: string): readonly string[] {
  const publicCommands = output.split("Public commands:\n")[1]?.split("\n\nExamples:")[0] ?? ""
  return publicCommands
    .split("\n")
    .filter((line) => line.startsWith("  "))
    .map((line) => line.trim().split(/\s+/)[0] ?? "")
}

function setPersistedUserLanguage(projectDir: string, userLanguage: string): void {
  const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
  const profile = readFileSync(profilePath, "utf8")
  writeFileSync(
    profilePath,
    profile.replace(/("id": "user-language",[\s\S]*?"answer": )"[^"]*"/, `$1"${userLanguage}"`),
  )
}

function clearDefaultProfileMarker(projectDir: string): void {
  const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
  const profile = readFileSync(profilePath, "utf8")
  writeFileSync(profilePath, profile.replace('"project": "Default backend profile created by Persona Harness."', '"project": null'))
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph help and language", () => {
  it("keeps English as the default root-help locale and exposes exactly five public commands", () => {
    const projectDir = createTempProject()

    expect(runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Usage: ph <command> [args...]")
    expect(result.stdout).toContain("Public commands:")
    expect(publicCommandNames(result.stdout)).toEqual(["version", "init", "attach", "go", "doctor"])
    expect(result.stdout).not.toContain("  language")
    expect(result.stdout).not.toContain("사용법:")
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
    expect(result.stdout).toContain("Locale selection contract:")
    expect(result.stdout).toContain("answer `ko`")
  })

  it("falls back to English for unavailable, unknown, and malformed profile language values", () => {
    const projectDir = createTempProject()

    expect(runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    clearDefaultProfileMarker(projectDir)

    for (const userLanguage of ["ja", "unrecognized"]) {
      setPersistedUserLanguage(projectDir, userLanguage)

      const rootHelp = runPersonaCli(["help"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const language = runPersonaCli(["language"], { cwd: projectDir, env: {}, invocationName: "ph" })

      expect(rootHelp.status).toBe(0)
      expect(rootHelp.stdout).toContain("Usage: ph <command> [args...]")
      expect(rootHelp.stdout).not.toContain("사용법:")
      expect(language.status).toBe(0)
      expect(language.stdout).toContain("Persona Harness supported languages")
      expect(language.stdout).not.toContain("Persona Harness 지원 언어")
    }

    writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), "{ malformed profile")

    const rootHelp = runPersonaCli(["help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const language = runPersonaCli(["language"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(rootHelp.status).toBe(0)
    expect(rootHelp.stdout).toContain("Usage: ph <command> [args...]")
    expect(language.status).toBe(0)
    expect(language.stdout).toContain("Persona Harness supported languages")
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
