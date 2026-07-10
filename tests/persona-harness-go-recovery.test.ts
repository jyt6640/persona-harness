import {
  existsSync,
  lstatSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { join, relative } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  acquireGoCommandLock,
  recoverGoCommandLock,
  releaseGoCommandLock,
} from "../src/cli/go-lock.js"
import { recoveryClaimPath } from "../src/cli/go-lock-state.js"
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

describe("ph go recovery", () => {
  it.each([
    { content: lockText("stale-generation", 99999999, "stale-owner"), label: "stale" },
    { content: "malformed lock\n", label: "malformed" },
    { content: lockText("invalid-zero-pid", 0, "invalid-owner"), label: "invalid PID" },
    { content: legacyLockText(99999999, "legacy-stale-owner"), label: "stale legacy" },
  ])("clears a $label lock without workflow state", ({ content }) => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    const before = workflowSnapshot(projectDir)
    writeFileSync(path, content)

    const result = runPersonaCli(["go", "--recover"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("recovered")
    expect(existsSync(path)).toBe(false)
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("preserves an abandoned recovery claim while clearing its stale generation", () => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    const generation = "stale-generation"
    const before = workflowSnapshot(projectDir)
    writeFileSync(path, lockText(generation, 99999999, "stale-owner"))
    const claimPath = recoveryClaimPath(projectDir, generation)
    writeFileSync(
      claimPath,
      `${JSON.stringify({
        generation,
        owner: { pid: 99999999, token: "abandoned-recoverer" },
        schemaVersion: "ph-go-recovery-claim.1",
      })}\n`,
    )

    const result = runPersonaCli(["go", "--recover"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(0)
    expect(existsSync(path)).toBe(false)
    expect(existsSync(claimPath)).toBe(true)
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })

  it("does not delete a malformed abandoned recovery claim", () => {
    const projectDir = readyProject()
    const generation = "stale-generation"
    const claimPath = recoveryClaimPath(projectDir, generation)
    const claimContent = "malformed abandoned recovery claim\n"
    writeFileSync(lockPath(projectDir), lockText(generation, 99999999, "stale-owner"))
    writeFileSync(claimPath, claimContent)

    const result = recoverGoCommandLock(projectDir)

    expect(result.kind).toBe("recovered")
    expect(readFileSync(claimPath, "utf8")).toBe(claimContent)
  })

  it("keeps recovery claims inside the persona directory for crafted generations", () => {
    const projectDir = readyProject()
    const claimPath = recoveryClaimPath(projectDir, "../../../../../tmp/escape")

    expect(relative(join(projectDir, ".persona"), claimPath).startsWith("..")).toBe(false)
  })

  it("does not clear a live lock through recovery", () => {
    const projectDir = readyProject()
    const acquired = acquireGoCommandLock(projectDir)
    if (acquired.kind !== "acquired") {
      throw new TypeError(`expected lock acquisition, received ${acquired.kind}`)
    }
    const before = readFileSync(lockPath(projectDir), "utf8")

    const result = runPersonaCli(["go", "--recover"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(readFileSync(lockPath(projectDir), "utf8")).toBe(before)
    releaseGoCommandLock(acquired.lock)
  })

  it("does not follow a symbolic-linked lock path during recovery", () => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    const externalPath = join(projectDir, "external-go-lock")
    const externalContent = "external lock content\n"
    writeFileSync(externalPath, externalContent)
    symlinkSync(externalPath, path, "file")

    const result = runPersonaCli(["go", "--recover"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expectSingleNextCommand(result.stderr, "npx ph workflow check")
    expect(readFileSync(externalPath, "utf8")).toBe(externalContent)
    expect(lstatSync(path).isSymbolicLink()).toBe(true)
  })

  it("keeps a replacement live lock when recovery observes a changed generation", () => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    const replacement = lockText("live-generation", process.pid, "live-owner")
    writeFileSync(path, lockText("stale-generation", 99999999, "stale-owner"))
    const before = lstatSync(path)

    const result = recoverGoCommandLock(projectDir, {
      onBeforeClear: () => {
        rmSync(path)
        writeFileSync(path, replacement)
      },
    })

    expect(result.kind).toBe("changed")
    expect(readFileSync(path, "utf8")).toBe(replacement)
    expect(lstatSync(path).ino).not.toBe(before.ino)
  })

  it("allows at most one stale recoverer to own a generation", () => {
    const projectDir = readyProject()
    const path = lockPath(projectDir)
    writeFileSync(path, lockText("stale-generation", 99999999, "stale-owner"))
    let secondKind = ""

    const first = recoverGoCommandLock(projectDir, {
      recoveryOwner: { pid: process.pid, token: "a-first-recoverer" },
      onAfterClaim: () => {
        secondKind = recoverGoCommandLock(projectDir, {
          recoveryOwner: { pid: process.pid, token: "z-second-recoverer" },
        }).kind
      },
    })

    expect(first.kind).toBe("recovered")
    expect(secondKind).toBe("claim-contended")
    expect(existsSync(path)).toBe(false)
  })
})
