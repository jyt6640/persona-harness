import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { personaHarnessVersion } from "../src/cli/version.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-first-run-help-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("first-run command help", () => {
  it("prints the packaged Persona Harness version", () => {
    const projectDir = createTempProject()
    const packageJson = JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { readonly version?: unknown }
    const expectedVersion = typeof packageJson.version === "string" ? packageJson.version : "0.0.0-unknown"

    const flagResult = runPersonaCli(["--version"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const commandResult = runPersonaCli(["version"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(personaHarnessVersion()).toBe(expectedVersion)
    expect(flagResult).toEqual({ status: 0, stdout: `${expectedVersion}\n`, stderr: "" })
    expect(commandResult).toEqual({ status: 0, stdout: `${expectedVersion}\n`, stderr: "" })
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
  })

  it("prints init help without initializing the project", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["init", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: ph init")
    expect(result.stdout).toContain("Next for backend projects: npx ph bootstrap backend")
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
    expect(existsSync(join(projectDir, ".opencode"))).toBe(false)
  })

  it("prints strict bootstrap cost and opt-in boundaries in help", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(
      "Usage: ph bootstrap backend [--force] [--strict] [--runtime-injection-preview] [--multi-agent-preview] [--code-nav-preview] [--lsp-preview] [--codegraph-preview] [--no-codegraph] [--no-developer-mcp]",
    )
    expect(result.stdout).toContain("Strict mode:")
    expect(result.stdout).toContain("sets enforce.executeVerification: true")
    expect(result.stdout).toContain("expect toolchain command cost")
    expect(result.stdout).toContain("sets features.runtimeInjection: true and enforce.systemConstitution: true")
    expect(result.stdout).toContain("does not enable enforce.writeDeny, enforce.idleContinuation, or enforce.ralphLoop")
    expect(result.stdout).toContain("no generated app product-quality certification or closure guarantee")
    expect(result.stdout).toContain("Runtime injection preview:")
    expect(result.stdout).toContain("default init/bootstrap keeps PH as gate-first CLI/evidence tooling")
    expect(result.stdout).toContain("parked after the Stage 9 banner-only H1 measurement")
    expect(result.stdout).toContain("measured 10-pair OpenCode A/B was worse")
    expect(result.stdout).toContain("Role Checklist Relay preview:")
    expect(result.stdout).toContain("flag/config name is kept as a compatibility alias")
    expect(result.stdout).toContain("role checklist guidance")
    expect(result.stdout).toContain("does not guarantee or enforce host subagent invocation")
    expect(result.stdout).toContain("main session completes the current role checklist")
    expect(result.stdout).toContain("Code-nav MCP preview:")
    expect(result.stdout).toContain("opt-in only via --code-nav-preview")
    expect(result.stdout).toContain("persona-harness-code-nav_search_text")
    expect(result.stdout).toContain("no codegraph/indexer and no token-saving claim")
    expect(result.stdout).toContain("LSP MCP preview:")
    expect(result.stdout).toContain("opt-in only via --lsp-preview")
    expect(result.stdout).toContain("lsp_status unavailable facade")
    expect(result.stdout).toContain("no auto-install")
    expect(result.stdout).toContain("Developer MCP bundle:")
    expect(result.stdout).toContain("remote grep_app and context7 are registered by default")
    expect(result.stdout).toContain("disable all bundle entries with --no-developer-mcp")
    expect(result.stdout).toContain("registers remote grep_app and context7")
    expect(result.stdout).toContain("codegraph is not registered by default")
    expect(result.stdout).toContain("use --codegraph-preview")
    expect(result.stdout).toContain("PH does not run codegraph init")
    expect(result.stdout).toContain("git_bash and lsp are not registered")
    expect(result.stdout).toContain("no PH-owned codegraph")
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
  })
})
