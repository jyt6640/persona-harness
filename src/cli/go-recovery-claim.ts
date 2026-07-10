import { randomUUID } from "node:crypto"
import {
  closeSync,
  linkSync,
  lstatSync,
  openSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { basename, dirname, join } from "node:path"

import {
  type GoLockOwner,
  isGoLockOwner,
  processIsRunning,
  recoveryClaimPath,
} from "./go-lock-state.js"

export type GoRecoveryClaim = {
  readonly device: number
  readonly generation: string
  readonly inode: number
  readonly owner: GoLockOwner
  readonly path: string
  readonly raw: string
}

export type GoRecoveryClaimOptions = {
  readonly onBeforePublish?: () => void
  readonly owner?: GoLockOwner
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

function claimFromSnapshot(
  path: string,
  snapshot: Extract<GoRecoveryClaimSnapshot, { readonly kind: "regular" }>,
): GoRecoveryClaim | undefined {
  if (snapshot.record === undefined) {
    return undefined
  }
  return {
    device: snapshot.device,
    generation: snapshot.record.generation,
    inode: snapshot.inode,
    owner: snapshot.record.owner,
    path,
    raw: snapshot.raw,
  }
}

function recoveryClaimMatches(
  claim: GoRecoveryClaim,
  snapshot: Extract<GoRecoveryClaimSnapshot, { readonly kind: "regular" }>,
): boolean {
  return (
    claim.device === snapshot.device
    && claim.inode === snapshot.inode
    && claim.raw === snapshot.raw
    && snapshot.record !== undefined
    && claim.generation === snapshot.record.generation
    && claim.owner.pid === snapshot.record.owner.pid
    && claim.owner.token === snapshot.record.owner.token
  )
}

function activeRecoveryClaims(projectDir: string, generation: string): readonly GoRecoveryClaim[] {
  const canonicalPath = recoveryClaimPath(projectDir, generation)
  const canonicalName = basename(canonicalPath)
  const claimPaths = readdirSync(dirname(canonicalPath))
    .filter((entry) => (
      entry === canonicalName
      || (entry.startsWith(`${canonicalName}.`) && !entry.includes(".pending-"))
    ))
    .sort()
    .map((entry) => join(dirname(canonicalPath), entry))
  const claims: GoRecoveryClaim[] = []
  for (const path of claimPaths) {
    const snapshot = readRecoveryClaim(path)
    const claim = snapshot.kind === "regular" ? claimFromSnapshot(path, snapshot) : undefined
    if (
      claim !== undefined
      && claim.generation === generation
      && processIsRunning(claim.owner.pid)
    ) {
      claims.push(claim)
    }
  }
  return claims
}

function claimOrder(left: GoRecoveryClaim, right: GoRecoveryClaim): number {
  const tokenOrder = left.owner.token.localeCompare(right.owner.token)
  if (tokenOrder !== 0) {
    return tokenOrder
  }
  if (left.owner.pid !== right.owner.pid) {
    return left.owner.pid < right.owner.pid ? -1 : 1
  }
  return left.path.localeCompare(right.path)
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
  projectDir: string,
  generation: string,
  options: GoRecoveryClaimOptions = {},
): GoRecoveryClaim | undefined {
  const owner = options.owner ?? { pid: process.pid, token: randomUUID() }
  const path = recoveryClaimPath(projectDir, generation, owner)
  const record: GoRecoveryClaimRecord = {
    generation,
    owner,
    schemaVersion: "ph-go-recovery-claim.1",
  }
  const pendingPath = `${path}.pending-${randomUUID()}`
  try {
    const descriptor = openSync(pendingPath, "wx")
    try {
      writeFileSync(descriptor, `${JSON.stringify(record)}\n`)
    } finally {
      closeSync(descriptor)
    }
    options.onBeforePublish?.()
    linkSync(pendingPath, path)
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
  const snapshot = readRecoveryClaim(path)
  if (snapshot.kind !== "regular") {
    return undefined
  }
  const claim = claimFromSnapshot(path, snapshot)
  return (
    claim !== undefined
    && claim.generation === generation
    && claim.owner.pid === owner.pid
    && claim.owner.token === owner.token
  ) ? claim : undefined
}

export function hasActiveGoRecoveryClaim(projectDir: string, generation: string): boolean {
  return activeRecoveryClaims(projectDir, generation).length > 0
}

export function ownsGoRecoveryClaim(projectDir: string, claim: GoRecoveryClaim): boolean {
  const snapshot = readRecoveryClaim(claim.path)
  if (snapshot.kind !== "regular" || !recoveryClaimMatches(claim, snapshot)) {
    return false
  }
  const elected = [...activeRecoveryClaims(projectDir, claim.generation)].sort(claimOrder)[0]
  return (
    elected !== undefined
    && elected.path === claim.path
    && elected.device === claim.device
    && elected.inode === claim.inode
    && elected.raw === claim.raw
  )
}

export function releaseGoRecoveryClaim(claim: GoRecoveryClaim): void {
  const snapshot = readRecoveryClaim(claim.path)
  if (snapshot.kind !== "regular" || !recoveryClaimMatches(claim, snapshot)) {
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
