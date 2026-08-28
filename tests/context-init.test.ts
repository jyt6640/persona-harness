import { mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { cleanupProjects, createProject } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const repositoryRoot = resolve(process.cwd())

describe("context init", () => {
  it("keeps bare initialization as a no-write preview", () => {
    const projectDir = createProject()

    const result = run(projectDir, ["context", "init"])

    expect(result).toEqual({
      status: 0,
      stderr: "",
      stdout: [
        "Context Personalization (Experimental)",
        "Initialization: preview-only",
        "Context enabled: false",
        "Context Core: available",
        "No files were written.",
        "",
      ].join("\n"),
    })
    expect(readdirSync(projectDir)).toEqual([])
  })

  it("creates only the minimal explicit Context configuration in a fresh safe project", () => {
    const projectDir = createProject()

    const result = run(projectDir, ["context", "init", "--enable"])
    const configuration = JSON.parse(readFileSync(join(projectDir, ".persona", "harness.jsonc"), "utf8"))
    const status = run(projectDir, ["context", "status"])

    expect(result).toEqual({
      status: 0,
      stderr: "",
      stdout: [
        "Context Personalization (Experimental)",
        "Initialization: enabled",
        "Configuration: .persona/harness.jsonc",
        "Context enabled: true",
        "No host adapter was activated.",
        "",
      ].join("\n"),
    })
    expect(configuration).toEqual({
      context: {
        enabled: true,
        maxCapsules: 8,
        maxChars: 1600,
        mode: "targeted",
      },
    })
    expect(readdirSync(join(projectDir, ".persona"))).toEqual(["harness.jsonc"])
    expect(status.stdout).toContain("Context enabled: true")
  })

  it("does not overwrite a pre-existing harness configuration", () => {
    const projectDir = createProject()
    const configPath = join(projectDir, ".persona", "harness.jsonc")
    const existingBytes = "// keep this existing configuration\n{\n  \"context\": { \"enabled\": false }\n}\n"
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeFileSync(configPath, existingBytes)

    const result = run(projectDir, ["context", "init", "--enable"])

    expect(result).toEqual({ status: 1, stderr: "context-init-existing-config\n", stdout: "" })
    expect(readFileSync(configPath, "utf8")).toBe(existingBytes)
  })

  it("fails closed for an unsafe Persona directory without following it", () => {
    const projectDir = createProject()
    const outsideDir = createProject()
    symlinkSync(outsideDir, join(projectDir, ".persona"), "dir")

    const result = run(projectDir, ["context", "init", "--enable"])

    expect(result).toEqual({ status: 1, stderr: "context-init-path-unsafe\n", stdout: "" })
    expect(readdirSync(outsideDir)).toEqual([])
  })

  it("fails closed for malformed arguments without creating state", () => {
    const projectDir = createProject()

    const result = run(projectDir, ["context", "init", "--enable", "--force"])

    expect(result).toEqual({ status: 1, stderr: "context-init-arguments-invalid\n", stdout: "" })
    expect(readdirSync(projectDir)).toEqual([])
  })

  it("keeps initialization free of host, network, shell, and completion dependencies", () => {
    const source = readFileSync(resolve(repositoryRoot, "src/cli/context-init.ts"), "utf8")

    for (const token of ["node:child_process", "node:http", "node:https", "fetch(", "spawn(", "exec(", "@opencode-ai/plugin", "workflow", "authority", "evidence"]) {
      expect(source).not.toContain(token)
    }
  })
})

function run(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph" })
}
