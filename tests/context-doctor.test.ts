import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const repositoryRoot = resolve(process.cwd())

describe("context doctor", () => {
  it("renders the actual disabled local configuration without creating project state", () => {
    const projectDir = createProject()
    const before = readdirSync(projectDir)

    const result = run(projectDir, ["context", "doctor"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Context Doctor (Experimental)")
    expect(result.stdout).toContain("Configuration: ready")
    expect(result.stdout).toContain("Context enabled: false")
    expect(result.stdout).toContain("CLI inspection: available")
    expect(result.stdout).toContain("Host adapter: bundled (OpenCode 1.x)")
    expect(result.stdout).toContain("Runtime activation: safe target observed when Context is enabled")
    expect(result.stdout).toContain("Network access: not used")
    expect(result.stdout).toContain("Shell access: not used")
    expect(readdirSync(projectDir)).toEqual(before)
  })

  it("reports explicit enablement and safe Team availability without rule content", () => {
    const projectDir = createProject()
    const teamRule = "Keep the Team convention private."
    writeHarnessConfig(projectDir, { context: { enabled: true, maxCapsules: 3, maxChars: 300, mode: "targeted" } })
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "team-profile.json"), `${JSON.stringify({
      rules: [{ id: "team.naming", rule: teamRule, status: "active", topic: "naming" }],
      schemaVersion: "persona-team-profile.v1",
      teamKey: "core-team",
    }, null, 2)}\n`)

    const result = run(projectDir, ["context", "doctor"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Context enabled: true")
    expect(result.stdout).toContain("Context budget: maxCapsules=3 maxChars=300")
    expect(result.stdout).toContain("Team Profile: available")
    expect(result.stdout).not.toContain(teamRule)
  })

  it("fails closed to bounded local diagnostics for malformed configuration and Team input", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { context: { enabled: "yes" } })
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "team-profile.json"), "{ invalid")

    const result = run(projectDir, ["context", "doctor"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Configuration: context-config-invalid")
    expect(result.stdout).toContain("Context enabled: false")
    expect(result.stdout).toContain("Team Profile: invalid")
    expect(result.stdout).toContain("Diagnostics: context-config-invalid, team-profile-invalid")
    expect(result.stdout).not.toContain("{ invalid")
  })

  it("keeps doctor rendering free of host, personal-profile, network, shell, and completion dependencies", () => {
    const source = readFileSync(resolve(repositoryRoot, "src/cli/context-doctor.ts"), "utf8")

    for (const token of ["node:child_process", "node:http", "node:https", "fetch(", "spawn(", "exec(", "@opencode-ai/plugin", "personalization-profile", "workflow", "authority", "evidence"]) {
      expect(source).not.toContain(token)
    }
  })
})

function run(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph" })
}
