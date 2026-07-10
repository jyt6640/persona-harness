import { existsSync, lstatSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  acquireGoCommandLock,
  recoverGoCommandLock,
  releaseGoCommandLock,
} from "../src/cli/go-lock.js"
import { writeLockRecord } from "../src/cli/go-lock-state.js"
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

function lockPath(projectDir: string): string {
  return join(projectDir, ".persona", "go.lock")
}

function lockText(generation: string, pid: number, token: string): string {
  return `${JSON.stringify({ generation, owner: { pid, token }, schemaVersion: "ph-go-lock.2" })}\n`
}

function legacyLockText(pid: number, token: string): string {
  return `${JSON.stringify({ pid, token })}\n`
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

describe("ph go generation lock", () => {
  it.each([
    { content: lockText("stale-generation", 99999999, "stale-owner"), label: "stale" },
    { content: "not a go lock\n", label: "malformed" },
    { content: lockText("invalid-zero-pid", 0, "invalid-owner"), label: "zero-PID malformed" },
    { content: lockText("invalid-negative-pid", -1, "invalid-owner"), label: "negative-PID malformed" },
  ])("does not delete a $label lock during normal go", ({ content }) => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    const before = workflowSnapshot(projectDir)
    writeFileSync(path, content)

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph go --recover")
    expect(readFileSync(path, "utf8")).toBe(content)
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("blocks normal go while a live generation is held", () => {
    const projectDir = readyProject()
    const acquired = acquireGoCommandLock(projectDir)
    if (acquired.kind !== "acquired") {
      throw new TypeError(`expected lock acquisition, received ${acquired.kind}`)
    }

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    releaseGoCommandLock(acquired.lock)
  })

  it("does not publish a partial normal lock to recovery", () => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    let recoveryKind = ""

    const lock = writeLockRecord(
      path,
      {
        generation: "published-generation",
        owner: { pid: process.pid, token: "publishing-owner" },
        schemaVersion: "ph-go-lock.2",
      },
      {
        onBeforePublish: () => {
          recoveryKind = recoverGoCommandLock(projectDir).kind
          expect(existsSync(path)).toBe(false)
        },
      },
    )

    expect(recoveryKind).toBe("missing")
    expect(existsSync(path)).toBe(true)
    releaseGoCommandLock(lock)
  })

  it("honors an active legacy lock instead of recovering it", () => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    const activePid = process.pid
    const content = legacyLockText(activePid, "legacy-active-owner")
    writeFileSync(path, content)

    const normal = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const recover = runPersonaCli(["go", "--recover"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(normal.status).toBe(1)
    expectSingleNextCommand(normal.stderr, "npx ph workflow check")
    expect(recover.status).toBe(1)
    expectSingleNextCommand(recover.stderr, "npx ph workflow check")
    expect(readFileSync(path, "utf8")).toBe(content)
  })

  it("does not follow a symbolic-linked lock path during normal go", () => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    const externalPath = join(projectDir, "external-go-lock")
    const externalContent = "external lock content\n"
    writeFileSync(externalPath, externalContent)
    symlinkSync(externalPath, path, "file")

    const result = runPersonaCli(["go", "Add task creation."], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(readFileSync(externalPath, "utf8")).toBe(externalContent)
    expect(lstatSync(path).isSymbolicLink()).toBe(true)
  })

  it("blocks normal go while a recovery claim is held", () => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    writeFileSync(path, lockText("stale-generation", 99999999, "stale-owner"))
    let nestedStatus: number | undefined
    let nestedStderr = ""

    const recovered = recoverGoCommandLock(projectDir, {
      onAfterClaim: () => {
        const nested = runPersonaCli(["go", "Add task creation."], {
          cwd: projectDir,
          env: {},
          invocationName: "ph",
        })
        nestedStatus = nested.status
        nestedStderr = nested.stderr
      },
    })

    expect(recovered.kind).toBe("recovered")
    expect(nestedStatus).toBe(1)
    expectSingleNextCommand(nestedStderr, "npx ph go --recover")
  })

})
