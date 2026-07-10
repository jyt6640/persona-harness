import { randomUUID } from "node:crypto"
import {
  closeSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"

import { type GoLockOwner, isGoLockOwner, processIsRunning } from "./go-lock-state.js"

export type GoRecoveryClaim = {
  readonly generation: string
  readonly owner: GoLockOwner
  readonly path: string
}

export type GoRecoveryClaimOptions = {
  readonly onBeforeDiscard?: () => void
}

type GoRecoveryClaimRecord = {
  readonly generation: string
  readonly owner: GoLockOwner
  readonly schemaVersion: "ph-go-recovery-claim.1"
}

type GoRecoveryClaimSnapshot =
  | { readonly kind: "missing" | "unsafe" }
  | {
      readonly device: number
      readonly inode: number
      readonly kind: "regular"
      readonly raw: string
      readonly record: GoRecoveryClaimRecord | undefined
    }

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined
}

function parseRecoveryClaim(raw: string): GoRecoveryClaimRecord | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    if (
      typeof value !== "object"
      || value === null
      || !("generation" in value)
      || typeof value.generation !== "string"
      || value.generation.length === 0
      || !("owner" in value)
      || !isGoLockOwner(value.owner)
      || !("schemaVersion" in value)
      || value.schemaVersion !== "ph-go-recovery-claim.1"
    ) {
      return undefined
    }
    return { generation: value.generation, owner: value.owner, schemaVersion: "ph-go-recovery-claim.1" }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
}

function readRecoveryClaim(path: string): GoRecoveryClaimSnapshot {
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { kind: "unsafe" }
    }
    const raw = readFileSync(path, "utf8")
    return {
      device: stat.dev,
      inode: stat.ino,
      kind: "regular",
      raw,
      record: parseRecoveryClaim(raw),
    }
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    if (errorCode(error) === "ENOENT") {
      return { kind: "missing" }
    }
    throw error
  }
}

function recoveryClaimMatches(
  left: Extract<GoRecoveryClaimSnapshot, { readonly kind: "regular" }>,
  right: Extract<GoRecoveryClaimSnapshot, { readonly kind: "regular" }>,
): boolean {
  return (
    left.device === right.device
    && left.inode === right.inode
    && left.raw === right.raw
  )
}

function discardAbandonedRecoveryClaim(
  path: string,
  observed: Extract<GoRecoveryClaimSnapshot, { readonly kind: "regular" }>,
  options: GoRecoveryClaimOptions,
): boolean {
  const current = readRecoveryClaim(path)
  if (current.kind !== "regular" || !recoveryClaimMatches(observed, current)) {
    return false
  }
  if (current.record !== undefined && processIsRunning(current.record.owner.pid)) {
    return false
  }
  try {
    options.onBeforeDiscard?.()
    unlinkSync(path)
    return true
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    if (errorCode(error) === "ENOENT") {
      return false
    }
    throw error
  }
}

function removePendingRecoveryClaim(path: string): void {
  try {
    unlinkSync(path)
  } catch (error) {
    if (!(error instanceof Error) || errorCode(error) !== "ENOENT") {
      throw error
    }
  }
}

export function createGoRecoveryClaim(
  path: string,
  generation: string,
  options: GoRecoveryClaimOptions = {},
): GoRecoveryClaim | undefined {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const owner = { pid: process.pid, token: randomUUID() }
    const record: GoRecoveryClaimRecord = {
      generation,
      owner,
      schemaVersion: "ph-go-recovery-claim.1",
    }
    const pendingPath = `${path}.pending-${owner.token}`
    try {
      const descriptor = openSync(pendingPath, "wx")
      try {
        writeFileSync(descriptor, `${JSON.stringify(record)}\n`)
      } finally {
        closeSync(descriptor)
      }
      linkSync(pendingPath, path)
      return { generation, owner, path }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      if (errorCode(error) !== "EEXIST") {
        throw error
      }
    } finally {
      removePendingRecoveryClaim(pendingPath)
    }
    const existing = readRecoveryClaim(path)
    if (existing.kind !== "regular" || !discardAbandonedRecoveryClaim(path, existing, options)) {
      return undefined
    }
  }
  return undefined
}

export function releaseGoRecoveryClaim(claim: GoRecoveryClaim): void {
  const snapshot = readRecoveryClaim(claim.path)
  if (
    snapshot.kind !== "regular"
    || snapshot.record === undefined
    || snapshot.record.generation !== claim.generation
    || snapshot.record.owner.pid !== claim.owner.pid
    || snapshot.record.owner.token !== claim.owner.token
  ) {
    return
  }
  try {
    unlinkSync(claim.path)
  } catch (error) {
    if (!(error instanceof Error) || errorCode(error) !== "ENOENT") {
      throw error
    }
  }
}
