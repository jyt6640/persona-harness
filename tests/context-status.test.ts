import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const repositoryRoot = resolve(process.cwd())

describe("context status", () => {
  it("reports missing config as disabled without creating Context state", () => {
    const projectDir = createProject()
    const before = readDirectory(projectDir)

    const result = runPersonaCli(["context", "status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result).toEqual({
      status: 0,
      stderr: "",
      stdout: [
        "Context Personalization (Experimental)",
        "Configuration: ready",
        "Context enabled: false",
        "Context mode: targeted",
        "Context budget: maxCapsules=8 maxChars=1600",
        "Context Core: available",
        "Team Profile: missing",
        "Host adapter: bundled (OpenCode 1.x)",
        "Runtime activation: safe target observed when Context is enabled",
        "Network access: not used",
        "Shell access: not used",
        "Diagnostics: none",
        "",
      ].join("\n"),
    })
    expect(readDirectory(projectDir)).toEqual(before)
  })

  it("reports explicit Context opt-in and an available Team Profile without rendering rule content", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 4, maxChars: 900 } })
    writeTeamProfile(projectDir, {
      rules: [
        {
          id: "team.naming",
          rule: "Use a stable domain name.",
          status: "active",
          topic: "naming",
        },
      ],
      schemaVersion: "persona-team-profile.v1",
      teamKey: "core-team",
    })

    const result = runPersonaCli(["context", "status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Configuration: ready")
    expect(result.stdout).toContain("Context enabled: true")
    expect(result.stdout).toContain("Context budget: maxCapsules=4 maxChars=900")
    expect(result.stdout).toContain("Team Profile: available")
    expect(result.stdout).toContain("Diagnostics: none")
    expect(result.stdout).not.toContain("Use a stable domain name.")
    expect(result.stdout).not.toContain("core-team")
  })

  it("fails closed for invalid Context configuration without reflecting its contents", () => {
    const projectDir = createProject()
    const unsafeValue = "untrusted-context-value"
    writeHarnessConfig(projectDir, { context: { enabled: true, unexpected: unsafeValue } })

    const result = runPersonaCli(["context", "status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Configuration: context-config-invalid")
    expect(result.stdout).toContain("Context enabled: false")
    expect(result.stdout).toContain("Diagnostics: context-config-invalid")
    expect(result.stdout).not.toContain(unsafeValue)
  })

  it("reports an invalid Team Profile with only its finite diagnostic", () => {
    const projectDir = createProject()
    const unsafeValue = "untrusted-team-profile-value"
    mkdirSync(`${projectDir}/.persona`, { recursive: true })
    writeFileSync(`${projectDir}/.persona/team-profile.json`, `{ ${unsafeValue}`)

    const result = runPersonaCli(["context", "status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Team Profile: invalid")
    expect(result.stdout).toContain("Diagnostics: team-profile-invalid-json")
    expect(result.stdout).not.toContain(unsafeValue)
  })

  it("keeps legacy runtime injection independent from Context status", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { features: { runtimeInjection: true } })

    const result = runPersonaCli(["context", "status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.stdout).toContain("Context enabled: false")
    expect(result.stdout).toContain("Runtime activation: safe target observed when Context is enabled")
  })

  it("keeps the local status reader free of process, network, and host dependencies", () => {
    const source = readFileSync(resolve(repositoryRoot, "src/cli/context-status.ts"), "utf8")

    for (const token of ["node:child_process", "node:http", "node:https", "fetch(", "spawn(", "exec(", "@opencode-ai/plugin"]) {
      expect(source).not.toContain(token)
    }
  })
})

function writeTeamProfile(projectDir: string, profile: Record<string, unknown>): void {
  mkdirSync(`${projectDir}/.persona`, { recursive: true })
  writeFileSync(`${projectDir}/.persona/team-profile.json`, `${JSON.stringify(profile, null, 2)}\n`)
}

function readDirectory(projectDir: string): readonly string[] {
  return readdirSync(projectDir).sort()
}
