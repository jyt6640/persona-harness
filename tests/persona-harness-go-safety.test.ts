import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  createGoProject,
  createReadyGoProject,
  initializeHarness,
  prepareProfile,
  removeGoProject,
  workflowSnapshot,
} from "./helpers/go-fixtures.js"

const tempProjects: string[] = []

function track(projectDir: string): string {
  tempProjects.push(projectDir)
  return projectDir
}

function expectSingleNextCommand(stderr: string, command: string): void {
  expect(stderr).toContain(`Next command: ${command}`)
  expect(stderr.match(/npx ph/gu)).toHaveLength(1)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    removeGoProject(projectDir)
  }
  tempProjects.length = 0
})

describe("ph go safety", () => {
  it("does not auto-bootstrap an uninitialized project", () => {
    const projectDir = track(createGoProject())

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph attach --yes")
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
  })

  it("does not write workflow state when the profile is missing", () => {
    const projectDir = track(createGoProject())
    initializeHarness(projectDir)
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph attach --yes")
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("does not write workflow state when the accepted plan is missing", () => {
    const projectDir = track(createGoProject())
    initializeHarness(projectDir)
    prepareProfile(projectDir)
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph plan --auto-accept")
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("does not write workflow state when the plan exists but is not accepted", () => {
    const projectDir = track(createReadyGoProject())
    const planPath = join(projectDir, ".persona", "workflow", "plan.md")
    writeFileSync(planPath, readFileSync(planPath, "utf8").replace("Status: accepted", "Status: draft"))
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph plan --accept")
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("preserves an existing backlog/current ticket and points to workflow next", () => {
    const projectDir = track(createReadyGoProject())
    expect(runPersonaCli(["go", "Add task creation."], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add another task endpoint."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow next")
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("preserves a captured requirement source and points to workflow split", () => {
    const projectDir = track(createReadyGoProject())
    expect(
      runPersonaCli(["workflow", "capture", "--stdin"], {
        cwd: projectDir,
        env: {},
        invocationName: "ph",
        stdin: "Add task creation.",
      }).status,
    ).toBe(0)
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add another task endpoint."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow split")
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("preflights missing workflow report templates without starting capture", () => {
    const projectDir = track(createReadyGoProject())
    rmSync(join(projectDir, ".persona", "workflow", "implementation-report.md"))
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it.each([
    { args: ["go"], expected: "requires one quoted concrete implementation goal", stdin: undefined },
    { args: ["go", ""], expected: "requires one quoted concrete implementation goal", stdin: undefined },
    { args: ["go", "--stdin"], expected: "requires a non-empty concrete implementation goal", stdin: "   " },
    { args: ["go", "goal", "--stdin"], expected: "not both", stdin: "other goal" },
    { args: ["go", "--recover", "goal"], expected: "does not accept a goal", stdin: undefined },
    { args: ["go", "--unknown"], expected: "Unknown ph go option: --unknown", stdin: undefined },
    { args: ["go", "goal one", "goal two"], expected: "requires one quoted concrete implementation goal", stdin: undefined },
  ])("rejects invalid input without workflow writes: $args", ({ args, expected, stdin }) => {
    const projectDir = track(createReadyGoProject())
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(args, {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      ...(stdin === undefined ? {} : { stdin }),
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain(expected)
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("does not overwrite unrelated conflicting ticket fragments", () => {
    const projectDir = track(createReadyGoProject())
    const fragment = join(projectDir, ".persona", "workflow", "work", "req-9", "00-task-card.md")
    mkdirSync(join(projectDir, ".persona", "workflow", "work", "req-9"), { recursive: true })
    writeFileSync(fragment, "existing fragment\n")
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(readFileSync(fragment, "utf8")).toBe("existing fragment\n")
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })
})
