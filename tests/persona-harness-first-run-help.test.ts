import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

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
      "Usage: ph bootstrap backend [--force] [--strict] [--multi-agent-preview] [--code-nav-preview]",
    )
    expect(result.stdout).toContain("Strict mode:")
    expect(result.stdout).toContain("sets enforce.executeVerification: true")
    expect(result.stdout).toContain("expect toolchain command cost")
    expect(result.stdout).toContain("sets enforce.systemConstitution: true")
    expect(result.stdout).toContain("does not enable enforce.writeDeny or enforce.idleContinuation")
    expect(result.stdout).toContain("no generated app product-quality certification or closure guarantee")
    expect(result.stdout).toContain("Multi-agent relay preview:")
    expect(result.stdout).toContain("opt-in only via --multi-agent-preview")
    expect(result.stdout).toContain("does not dispatch native subtasks")
    expect(result.stdout).toContain("Code-nav MCP preview:")
    expect(result.stdout).toContain("opt-in only via --code-nav-preview")
    expect(result.stdout).toContain("persona-harness-code-nav_search_text")
    expect(result.stdout).toContain("no codegraph/indexer and no token-saving claim")
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
  })
})
