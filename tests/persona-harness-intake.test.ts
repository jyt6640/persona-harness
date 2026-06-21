import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { initializeProjectIntake } from "../src/cli/intake.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-intake-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function readProfile(projectDir: string): Record<string, unknown> {
  const raw = readFileSync(join(projectDir, ".persona", "project-profile.jsonc"), "utf8")
  return JSON.parse(raw) as Record<string, unknown>
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph intake", () => {
  it("creates a backend project profile draft", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["intake"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness project intake draft created.")
    expect(result.stderr).toBe("")
    expect(existsSync(join(projectDir, ".persona", "project-profile.jsonc"))).toBe(true)

    const profile = readProfile(projectDir)
    expect(profile.schema).toBe("persona.project-profile.v1")
    expect(profile.status).toBe("draft")
    expect(profile.scope).toEqual({
      role: "backend",
      mvp: "java-spring-clean-code",
      productized: false,
    })
    expect(profile.defaults).toMatchObject({
      language: "java",
      framework: "spring",
      buildTool: "gradle",
      testPolicy: "deferred",
    })
    expect(profile.questions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "user-language",
          choices: ["ko", "en", "ja", "zh-cn", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "project-context",
          choices: ["solo", "team", "company", "open-source", "learning", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "project-goal",
          choices: ["prototype", "production-service", "study", "internal-tool", "portfolio", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "project-scale",
          choices: ["throwaway", "small", "medium", "long-lived", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "application-type",
          choices: ["rest-api", "mvc-web", "batch", "library", "mixed", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "storage",
          choices: ["none", "in-memory", "file", "database", "external-api", "mixed", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "persistence-technology",
          choices: ["not-needed", "jdbc-template", "jpa", "mybatis", "custom", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "migration-style",
          choices: ["schema.sql", "flyway", "liquibase", "none", "not-needed", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "package-style",
          choices: ["simple-mvc", "layer-first", "domain-first", "feature-first", "recommend"],
          answer: null,
        }),
        expect.objectContaining({
          id: "architecture-style",
          choices: [
            "simple-layered",
            "clean-architecture-light",
            "hexagonal-light",
            "strict-clean-architecture",
            "recommend",
          ],
          answer: null,
        }),
        expect.objectContaining({
          id: "boundary-strictness",
          choices: ["lightweight", "pragmatic", "strict", "recommend"],
          answer: null,
        }),
      ]),
    )
    expect(profile.questions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dto-strictness" }),
        expect.objectContaining({ id: "philosophy-overlay" }),
      ]),
    )
    expect(profile.notes).toEqual({ project: null })
    expect(profile.philosophy).toEqual({
      company: null,
      personal: null,
      project: null,
      priority: ["project-specific", "company/team", "personal", "clean-code-baseline", "framework-default"],
    })
  })

  it("does not overwrite an existing profile unless --force is used", () => {
    const projectDir = createTempProject()
    initializeProjectIntake({ projectDir })

    const duplicate = runPersonaCli(["intake"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const forced = runPersonaCli(["intake", "--force"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(duplicate.status).toBe(1)
    expect(duplicate.stderr).toContain("already exists")
    expect(forced.status).toBe(0)
    expect(forced.stdout).toContain("project-profile.jsonc")
  })

  it("shows usage and rejects unknown options", () => {
    const projectDir = createTempProject()

    const help = runPersonaCli(["intake", "--help"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const invalid = runPersonaCli(["intake", "--unknown"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("Usage: ph intake [--force | --interactive]")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain("Unknown option: --unknown")
  })

  it("advertises intake in the shared CLI usage", () => {
    const result = runPersonaCli(["--help"], {
      cwd: createTempProject(),
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("intake")
    expect(result.stdout).toContain("Create a draft backend project profile")
  })
})
