import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const temporaryProjects: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-staged-provenance-command-"))
  temporaryProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of temporaryProjects) {
    rmSync(projectDir, { force: true, recursive: true })
  }
  temporaryProjects.length = 0
})

describe("staged package artifact provenance command", () => {
  it("exposes only fixed channel and version selection without caller fact inputs", () => {
    const projectDir = createProject()
    const help = runPersonaCli(["dev", "staged-package-provenance", "--help"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const hostile = runPersonaCli([
      "dev",
      "staged-package-provenance",
      "--channel",
      "staging",
      "--version",
      "0.7.0-rc.6",
      "--registry-facts",
      "caller.json",
    ], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const secretVersion = "0.7.0-sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const secret = runPersonaCli([
      "dev",
      "staged-package-provenance",
      "--channel",
      "staging",
      "--version",
      secretVersion,
      "--json",
    ], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("Usage: ph dev staged-package-provenance")
    expect(help.stdout).toContain("--channel <staging|next>")
    expect(help.stdout).not.toContain("--registry-facts")
    expect(hostile.status).toBe(1)
    expect(hostile.stdout).toBe("")
    expect(hostile.stderr).toContain("Usage: ph dev staged-package-provenance")
    expect(hostile.stderr).not.toContain("caller.json")
    expect(secret.status).toBe(1)
    expect(`${secret.stdout}${secret.stderr}`).not.toContain(secretVersion)
  })
})
