import { randomUUID } from "node:crypto"
import { unlinkSync } from "node:fs"

import {
  GoCommandLockLostError,
  type GoCommandLock,
  type GoLockOwner,
  type GoLockRecord,
  lockPath,
  processIsRunning,
  readGoLockSnapshot,
  snapshotMatches,
  writeLockRecord,
} from "./go-lock-state.js"
import {
  createGoRecoveryClaim,
  hasActiveGoRecoveryClaim,
  ownsGoRecoveryClaim,
  releaseGoRecoveryClaim,
} from "./go-recovery-claim.js"

export type { GoCommandLock }
export { GoCommandLockLostError }

export type GoLockAcquireResult =
  | { readonly kind: "acquired"; readonly lock: GoCommandLock }
  | { readonly kind: "active" | "recoverable" | "recovery-claim" | "unsafe" }

export type GoLockRecoveryResult =
  | { readonly kind: "active" | "changed" | "claim-contended" | "missing" | "recovered" | "unsafe" }

export type GoLockRecoveryOptions = {
  readonly onAfterClaim?: () => void
  readonly onBeforeClear?: () => void
  readonly recoveryOwner?: GoLockOwner
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined
}

export function acquireGoCommandLock(projectDir: string): GoLockAcquireResult {
  const path = lockPath(projectDir)
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const snapshot = readGoLockSnapshot(path)
    if (snapshot.kind === "unsafe") {
      return { kind: "unsafe" }
    }
    if (snapshot.kind === "regular") {
      if (hasActiveGoRecoveryClaim(projectDir, snapshot.generation)) {
        return { kind: "recovery-claim" }
      }
      return snapshot.record !== undefined && processIsRunning(snapshot.record.owner.pid)
        ? { kind: "active" }
        : { kind: "recoverable" }
    }
    const owner = { pid: process.pid, token: randomUUID() }
    const record: GoLockRecord = { generation: randomUUID(), owner, schemaVersion: "ph-go-lock.2" }
    try {
      return { kind: "acquired", lock: writeLockRecord(path, record) }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      if (errorCode(error) !== "EEXIST") {
        throw error
      }
    }
  }
  return { kind: "active" }
}

export function assertGoCommandLock(lock: GoCommandLock): void {
  const snapshot = readGoLockSnapshot(lock.path)
  if (
    snapshot.kind !== "regular"
    || snapshot.record === undefined
    || !("generation" in snapshot.record)
    || snapshot.device !== lock.device
    || snapshot.inode !== lock.inode
    || snapshot.record.generation !== lock.generation
    || snapshot.record.owner.pid !== lock.owner.pid
    || snapshot.record.owner.token !== lock.owner.token
  ) {
    throw new GoCommandLockLostError()
  }
}

export function recoverGoCommandLock(
  projectDir: string,
  options: GoLockRecoveryOptions = {},
): GoLockRecoveryResult {
  const path = lockPath(projectDir)
  const observed = readGoLockSnapshot(path)
  if (observed.kind === "missing" || observed.kind === "unsafe") {
    return { kind: observed.kind }
  }
  const claim = createGoRecoveryClaim(projectDir, observed.generation, {
    owner: options.recoveryOwner,
  })
  if (claim === undefined) {
    return { kind: "claim-contended" }
  }
  try {
    options.onAfterClaim?.()
    if (!ownsGoRecoveryClaim(projectDir, claim)) {
      return { kind: "claim-contended" }
    }
    const current = readGoLockSnapshot(path)
    if (!snapshotMatches(observed, current)) {
      return { kind: "changed" }
    }
    if (current.kind === "regular" && current.record !== undefined && processIsRunning(current.record.owner.pid)) {
      return { kind: "active" }
    }
    options.onBeforeClear?.()
    if (!ownsGoRecoveryClaim(projectDir, claim)) {
      return { kind: "claim-contended" }
    }
    if (!snapshotMatches(observed, readGoLockSnapshot(path))) {
      return { kind: "changed" }
    }
    unlinkSync(path)
    return { kind: "recovered" }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    if (errorCode(error) === "ENOENT") {
      return { kind: "changed" }
    }
    throw error
  } finally {
    releaseGoRecoveryClaim(claim)
  }
}

export function releaseGoCommandLock(lock: GoCommandLock): void {
  try {
    assertGoCommandLock(lock)
    unlinkSync(lock.path)
  } catch (error) {
    if (!(error instanceof GoCommandLockLostError) && !(error instanceof Error && errorCode(error) === "ENOENT")) {
      throw error
    }
  }
}
