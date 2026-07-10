import { existsSync, lstatSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  acquireGoCommandLock,
  recoverGoCommandLock,
} from "../src/cli/go-lock.js"
import { recoveryClaimPath } from "../src/cli/go-lock-state.js"
import {
  createGoRecoveryClaim,
  ownsGoRecoveryClaim,
  releaseGoRecoveryClaim,
} from "../src/cli/go-recovery-claim.js"
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

function lockText(generation: string, pid: number, token: string): string {
  return `${JSON.stringify({ generation, owner: { pid, token }, schemaVersion: "ph-go-lock.2" })}\n`
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    removeGoProject(projectDir)
  }
  tempProjects.length = 0
})

describe("ph go recovery claim ownership", () => {
  it("does not expose a pending recovery claim as a live owner", () => {
    const projectDir = readyProject()
    const generation = "stale-generation"
    const lockPath = join(projectDir, ".persona", "go.lock")
    writeFileSync(lockPath, lockText(generation, 99999999, "stale-owner"))
    let nestedKind = ""

    const claim = createGoRecoveryClaim(projectDir, generation, {
      onBeforePublish: () => {
        nestedKind = acquireGoCommandLock(projectDir).kind
      },
      owner: { pid: process.pid, token: "pending-recoverer" },
    })

    expect(claim).toBeDefined()
    expect(nestedKind).toBe("recoverable")
    if (claim === undefined) {
      throw new TypeError("expected the recovery claim to publish")
    }
    releaseGoRecoveryClaim(claim)
  })

  it("preserves a second live recoverer claim published before the first recovery commit", () => {
    const projectDir = readyProject()
    const generation = "stale-generation"
    const lockPath = join(projectDir, ".persona", "go.lock")
    const legacyClaimPath = recoveryClaimPath(projectDir, generation)
    const before = workflowSnapshot(projectDir)
    const staleLock = lockText(generation, 99999999, "stale-owner")
    const abandonedClaim = `${JSON.stringify({
      generation,
      owner: { pid: 99999999, token: "abandoned-recoverer" },
      schemaVersion: "ph-go-recovery-claim.1",
    })}\n`
    const firstOwner = { pid: process.pid, token: "z-first-recoverer" }
    const secondOwner = { pid: process.pid, token: "a-second-recoverer" }
    writeFileSync(lockPath, staleLock)
    writeFileSync(legacyClaimPath, abandonedClaim)
    let secondClaim: ReturnType<typeof createGoRecoveryClaim> | undefined
    let secondClaimInode: number | undefined
    let secondClaimRaw = ""

    const first = recoverGoCommandLock(projectDir, {
      onBeforeClear: () => {
        secondClaim = createGoRecoveryClaim(projectDir, generation, { owner: secondOwner })
        if (secondClaim !== undefined) {
          secondClaimInode = lstatSync(secondClaim.path).ino
          secondClaimRaw = readFileSync(secondClaim.path, "utf8")
        }
      },
      recoveryOwner: firstOwner,
    })

    expect(secondClaim).toBeDefined()
    if (secondClaim === undefined) {
      throw new TypeError("expected the second recovery claim to publish")
    }
    expect(first.kind).toBe("claim-contended")
    expect(existsSync(secondClaim.path)).toBe(true)
    expect(readFileSync(secondClaim.path, "utf8")).toBe(secondClaimRaw)
    expect(lstatSync(secondClaim.path).ino).toBe(secondClaimInode)
    expect(ownsGoRecoveryClaim(projectDir, secondClaim)).toBe(true)
    expect(existsSync(recoveryClaimPath(projectDir, generation, firstOwner))).toBe(false)
    expect(readFileSync(legacyClaimPath, "utf8")).toBe(abandonedClaim)
    expect(readFileSync(lockPath, "utf8")).toBe(staleLock)
    expect(workflowSnapshot(projectDir)).toEqual(before)

    const rejected = recoverGoCommandLock(projectDir, { recoveryOwner: firstOwner })
    const second = recoverGoCommandLock(projectDir, { recoveryOwner: secondOwner })

    expect(rejected.kind).toBe("claim-contended")
    expect(second.kind).toBe("recovered")
    expect(existsSync(lockPath)).toBe(false)
    expect(existsSync(secondClaim.path)).toBe(false)
    expect(readFileSync(legacyClaimPath, "utf8")).toBe(abandonedClaim)
    expect(workflowSnapshot(projectDir)).toEqual(before)
  })
})
