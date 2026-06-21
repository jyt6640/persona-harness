import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-policy-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function readProjectFile(projectDir: string, path: string): string {
  return readFileSync(join(projectDir, path), "utf8")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph policy init", () => {
  it("creates backend-only policy overlay files without frontend or infra policy files", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["policy", "init"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness policy overlay initialized.")
    expect(result.stdout).toContain(".persona/policies/overlay.jsonc")
    expect(result.stderr).toBe("")
    expect(existsSync(join(projectDir, ".persona", "policies", "overlay.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "policies", "company", "backend.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "policies", "personal", "backend.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "policies", "company", "frontend.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "policies", "infra"))).toBe(false)

    const overlay = JSON.parse(readProjectFile(projectDir, ".persona/policies/overlay.jsonc")) as Record<string, unknown>
    expect(overlay).toMatchObject({
      schema: "persona.policy-overlay.v1",
      enabled: true,
      priority: ["company", "personal", "clean-code-baseline"],
    })
  })

  it("preserves existing policy files unless --force is used", () => {
    const projectDir = createTempProject()

    const first = runPersonaCli(["policy", "init"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    writeFileSync(join(projectDir, ".persona", "policies", "personal", "backend.md"), "# Existing\n\n- Keep me.\n")

    const duplicate = runPersonaCli(["policy", "init"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const preservedPolicy = readProjectFile(projectDir, ".persona/policies/personal/backend.md")
    const forced = runPersonaCli(["policy", "init", "--force"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(first.status).toBe(0)
    expect(duplicate.status).toBe(1)
    expect(duplicate.stderr).toContain("already exists")
    expect(preservedPolicy).toContain("Keep me.")
    expect(forced.status).toBe(0)
    expect(readProjectFile(projectDir, ".persona/policies/personal/backend.md")).toContain("# Backend Personal Philosophy")
    expect(readProjectFile(projectDir, ".persona/policies/personal/backend.md")).not.toContain("Keep me.")
  })

  it("shows usage and rejects unknown policy commands", () => {
    const projectDir = createTempProject()

    const help = runPersonaCli(["policy", "--help"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const invalid = runPersonaCli(["policy", "status"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("Usage: ph policy <command>")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain("Unknown policy command: status")
  })
})
