import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-staged-package-command-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("staged package verification CLI", () => {
  it("exposes a read-only staged verifier through the installed developer command surface", () => {
    const result = runPersonaCli(["dev", "staged-package", "--help"], {
      cwd: createTempProject(),
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Usage: ph dev staged-package")
    expect(result.stdout).toContain("never publishes, tags, moves a dist-tag")
    expect(result.stdout).toContain("authorizes channel promotion")
  })

  it("keeps hostile verification paths bounded and non-promoting", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const hostilePath = `/private/tmp/${secret}/fact.json`
    const result = runPersonaCli([
      "dev",
      "staged-package",
      "--plan",
      hostilePath,
      "--preflight",
      hostilePath,
      "--registry-facts",
      hostilePath,
      "--tarball",
      hostilePath,
      "--json",
    ], {
      cwd: createTempProject(),
      env: {},
      invocationName: "ph",
    })
    const output = `${result.stdout}\n${result.stderr}`

    expect(result.status).toBe(1)
    expect(output).toContain("staged-plan-invalid")
    expect(output).not.toContain(secret)
    expect(output).not.toContain("/private/tmp/")
    expect(output).toContain("\"promotionAuthorized\": false")
    expect(output).toContain("\"registryMutation\": \"not-performed\"")
  })
})
