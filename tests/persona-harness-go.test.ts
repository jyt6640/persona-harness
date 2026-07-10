import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  createReadyGoProject,
  removeGoProject,
} from "./helpers/go-fixtures.js"

const tempProjects: string[] = []

function readyProject(): string {
  const projectDir = createReadyGoProject()
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    removeGoProject(projectDir)
  }
  tempProjects.length = 0
})

describe("ph go", () => {
  it("accepts one positional implementation goal and prints the implementation rail", () => {
    const projectDir = readyProject()
    const goal = "Add a TaskController endpoint that creates one task."

    const result = runPersonaCli(["go", goal], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Go")
    expect(result.stdout).toContain("Ticket: req-1")
    expect(result.stdout).toContain("Persona Harness Workflow Implement")
    expect(readFileSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"), "utf8")).toBe(`${goal}\n`)
  })

  it("accepts a quoted markdown-bullet implementation goal", () => {
    const projectDir = readyProject()
    const goal = "- Add task creation."

    const result = runPersonaCli(["go", goal], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(readFileSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"), "utf8")).toBe(`${goal}\n`)
  })

  it("accepts a concrete implementation goal from stdin", () => {
    const projectDir = readyProject()
    const goal = "Add repository persistence for task creation."

    const result = runPersonaCli(["go", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: goal,
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Goal source: stdin")
    expect(result.stdout).toContain("Ticket: req-1")
    expect(readFileSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"), "utf8")).toBe(`${goal}\n`)
  })

  it("uses the existing single-ticket fallback for one concrete requirement", () => {
    const projectDir = readyProject()

    const result = runPersonaCli(["go", "Add validation for blank task titles."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(readFileSync(join(projectDir, ".persona", "workflow", "requirements-analysis.md"), "utf8")).toContain(
      "Split strategy: single-ticket-fallback",
    )
    expect(existsSync(join(projectDir, ".persona", "workflow", "work", "req-1", "00-task-card.md"))).toBe(true)
  })

  it("preserves existing multi-step requirement splitting", () => {
    const projectDir = readyProject()
    const goal = [
      "## Step 1. Create tasks",
      "",
      "- Add the create endpoint.",
      "",
      "## Step 2. List tasks",
      "",
      "- Add the list endpoint.",
    ].join("\n")

    const result = runPersonaCli(["go", goal], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Ticket: step-1")
    expect(existsSync(join(projectDir, ".persona", "workflow", "work", "step-1", "00-task-card.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "work", "step-2", "00-task-card.md"))).toBe(true)
  })

  it("promotes go without exposing recovery in normal help or enabling runtime injection", () => {
    const projectDir = readyProject()

    const commandHelp = runPersonaCli(["go", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const topHelp = runPersonaCli(["--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const result = runPersonaCli(["go", "Add a task lookup endpoint."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(commandHelp.status).toBe(0)
    expect(commandHelp.stdout).toContain('Usage: ph go "<concrete implementation goal>"')
    expect(commandHelp.stdout).toContain("ph go --stdin")
    expect(commandHelp.stdout).not.toContain("recover")
    expect(topHelp.stdout).toContain("go")
    expect(topHelp.stdout).toContain("single entry")
    expect(topHelp.stdout).not.toContain("recover")
    expect(result.status).toBe(0)
    expect(readFileSync(join(projectDir, ".persona", "harness.jsonc"), "utf8")).toContain('"runtimeInjection": false')
    expect(existsSync(join(projectDir, ".opencode"))).toBe(false)
  })
})
