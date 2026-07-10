import { rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  createReadyGoProject,
  removeGoProject,
  workflowSnapshot,
} from "./helpers/go-fixtures.js"

const tempProjects: string[] = []

function readyProject(): string {
  const projectDir = createReadyGoProject()
  tempProjects.push(projectDir)
  return projectDir
}

function lockText(generation: string): string {
  return `${JSON.stringify({
    generation,
    owner: { pid: process.pid, token: "replacement-owner" },
    schemaVersion: "ph-go-lock.2",
  })}\n`
}

function expectSingleNextCommand(stderr: string): void {
  expect(stderr).toContain("Next command: npx ph workflow check")
  expect(stderr.match(/npx ph/gu)).toHaveLength(1)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    removeGoProject(projectDir)
  }
  tempProjects.length = 0
})

describe("ph go lock revalidation", () => {
  it("revalidates the holder generation before commit", () => {
    const projectDir = readyProject()
    const path = join(projectDir, ".persona", "go.lock")
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onAfterGoTransactionCopy: () => {
        rmSync(path)
        writeFileSync(path, lockText("replacement-generation"))
      },
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr)
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("revalidates the holder generation before transaction start", () => {
    const projectDir = readyProject()
    const path = join(projectDir, ".persona", "go.lock")
    const before = workflowSnapshot(projectDir)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      onBeforeGoTransactionStart: () => {
        rmSync(path)
        writeFileSync(path, lockText("replacement-generation"))
      },
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr)
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })
})
