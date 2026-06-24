import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createHarnessProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-roles-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  return projectDir
}

function writeReadyProfile(projectDir: string): void {
  const profile = {
    schema: "persona.project-profile.v1",
    status: "ready",
    scope: {
      role: "backend",
      mvp: "java-spring-clean-code",
      productized: false,
    },
    questions: [
      { id: "user-language", prompt: "language", choices: [], answer: "ko" },
      { id: "project-context", prompt: "context", choices: [], answer: "solo" },
      { id: "project-goal", prompt: "goal", choices: [], answer: "production-service" },
      { id: "project-scale", prompt: "scale", choices: [], answer: "small" },
      { id: "application-type", prompt: "application", choices: [], answer: "rest-api" },
      { id: "storage", prompt: "storage", choices: [], answer: "database" },
      { id: "persistence-technology", prompt: "persistence", choices: [], answer: "jdbc-template" },
      { id: "migration-style", prompt: "migration", choices: [], answer: "flyway" },
      { id: "package-style", prompt: "package", choices: [], answer: "domain-first" },
      { id: "architecture-style", prompt: "architecture", choices: [], answer: "clean-architecture-light" },
      { id: "boundary-strictness", prompt: "boundary", choices: [], answer: "strict" },
    ],
    notes: {
      project: "",
    },
  }
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(profile, null, 2)}\n`)
}

function rolesPath(projectDir: string): string {
  return join(projectDir, ".persona", "workflow", "roles.md")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow roles", () => {
  it("writes and prints non-autonomous workflow role boundaries", () => {
    const projectDir = createHarnessProject()

    const result = runPersonaCli(["workflow", "roles"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Workflow Role Boundaries")
    expect(result.stdout).toContain("blackbear")
    expect(result.stdout).toContain("Charles")
    expect(result.stdout).toContain("jaeki")
    expect(result.stdout).toContain("roach")
    expect(result.stdout).toContain("No autonomous role-agent execution")
    expect(existsSync(rolesPath(projectDir))).toBe(true)
    expect(readFileSync(rolesPath(projectDir), "utf8")).toContain(
      "Current implementation: role boundary artifact only",
    )
  })

  it("creates role boundaries with the blackbear plan artifacts", () => {
    const projectDir = createHarnessProject()
    writeReadyProfile(projectDir)
    writeFileSync(join(projectDir, "README.md"), "# Equipment API\n\n- 장비 등록\n")

    const result = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(existsSync(rolesPath(projectDir))).toBe(true)
    expect(readFileSync(rolesPath(projectDir), "utf8")).toContain("`jaeki` | implementation")
  })

  it("keeps workflow roles inactive before Persona Harness opt-in", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-roles-no-harness-test-"))
    tempProjects.push(projectDir)

    const result = runPersonaCli(["workflow", "roles"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Persona Harness is not initialized")
    expect(result.stderr).toContain("npx ph init")
  })
})
