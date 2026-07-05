import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createProfiledProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-rail-cache-test-"))
  tempProjects.push(projectDir)
  expect(runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  return projectDir
}

function railMarkerPath(projectDir: string): string {
  return join(projectDir, ".persona", "workflow", "rail-body-cache.json")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("workflow rail body cache", () => {
  it("suppresses repeated workflow implement rail body and keeps --full as an escape hatch", () => {
    const projectDir = createProfiledProject()

    const first = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const repeated = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const full = runPersonaCli(["workflow", "implement", "--full"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(first.stdout).toContain("Implementation rail status: PASS")
    expect(first.stdout).toContain("Implementation checklist:")
    expect(existsSync(railMarkerPath(projectDir))).toBe(true)
    expect(repeated.status).toBe(0)
    expect(repeated.stdout).toContain("Implementation rail status: PASS")
    expect(repeated.stdout).toContain("rail unchanged (full text: `ph workflow implement --full`)")
    expect(repeated.stdout).not.toContain("Implementation checklist:")
    expect(repeated.stdout.length).toBeLessThan(first.stdout.length)
    expect(full.stdout).toContain("Implementation checklist:")
    expect(full.stdout).not.toContain("rail unchanged")
  })

  it("prints full workflow implement body again when the rail body changes", () => {
    const projectDir = createProfiledProject()
    expect(runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    writeFileSync(join(projectDir, "README.md"), "# Backend task\n\nBuild the tiny API.\n")
    const changed = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(changed.status).toBe(0)
    expect(changed.stdout).not.toContain("rail unchanged")
    expect(changed.stdout).toContain("Read README completely through OS-safe bearshell chunks:")
    expect(changed.stdout).toContain("Implementation checklist:")
  })

  it("suppresses only the fallback rail body in repeated workflow continue output", () => {
    const projectDir = createProfiledProject()

    const first = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const repeated = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const full = runPersonaCli(["workflow", "continue", "--full"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(first.stdout).toContain("Persona Harness resume prompt")
    expect(first.stdout).toContain("Implementation prompt:")
    expect(repeated.status).toBe(0)
    expect(repeated.stdout).toContain("Persona Harness resume prompt")
    expect(repeated.stdout).toContain("rail unchanged (full text: `ph workflow implement --full`)")
    expect(repeated.stdout).not.toContain("Implementation prompt:")
    expect(repeated.stdout.length).toBeLessThan(first.stdout.length)
    expect(full.stdout).toContain("Implementation prompt:")
    expect(full.stdout).not.toContain("rail unchanged")
  })

  it("suppresses repeated workflow check details while preserving status and --full", () => {
    const projectDir = createProfiledProject()

    const first = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const repeated = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const full = runPersonaCli(["workflow", "check", "--full"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(first.stdout).toContain("Persona Harness Workflow Check")
    expect(first.stdout).toContain("Artifacts:")
    expect(repeated.status).toBe(0)
    expect(repeated.stdout).toContain("Workflow status:")
    expect(repeated.stdout).toContain("rail unchanged (full text: `ph workflow implement --full`)")
    expect(repeated.stdout).not.toContain("Artifacts:")
    expect(repeated.stdout.length).toBeLessThan(first.stdout.length)
    expect(full.stdout).toContain("Artifacts:")
    expect(full.stdout).not.toContain("rail unchanged")
  })

  it("uses the first full rail print as a workspace marker for later workflow surfaces", () => {
    const projectDir = createProfiledProject()

    const implement = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const continuation = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(implement.status).toBe(0)
    expect(implement.stdout).toContain("Implementation checklist:")
    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status:")
    expect(check.stdout).toContain("rail unchanged (full text: `ph workflow implement --full`)")
    expect(check.stdout).not.toContain("Artifacts:")
    expect(continuation.status).toBe(0)
    expect(continuation.stdout).toContain("Persona Harness resume prompt")
    expect(continuation.stdout).toContain("rail unchanged (full text: `ph workflow implement --full`)")
    expect(continuation.stdout).not.toContain("Implementation prompt:")
  })
})
