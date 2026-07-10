import { createHash } from "node:crypto"
import {
  closeSync,
  linkSync,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

export type GoCommandLock = {
  readonly device: number
  readonly generation: string
  readonly inode: number
  readonly owner: GoLockOwner
  readonly path: string
}

export type GoLockOwner = {
  readonly pid: number
  readonly token: string
}

export type GoLockRecord = {
  readonly generation: string
  readonly owner: GoLockOwner
  readonly schemaVersion: "ph-go-lock.2"
}

export type GoLegacyLockRecord = {
  readonly legacy: true
  readonly owner: GoLockOwner
}

export type GoParsedLockRecord = GoLegacyLockRecord | GoLockRecord

export type GoLockSnapshot =
  | { readonly kind: "missing" }
  | {
      readonly device: number
      readonly generation: string
      readonly inode: number
      readonly kind: "regular"
      readonly raw: string
      readonly record: GoParsedLockRecord | undefined
    }
  | { readonly kind: "unsafe" }

export type GoLockPublishOptions = {
  readonly onBeforePublish?: () => void
}

export class GoCommandLockLostError extends Error {
  constructor() {
    super("ph go lock generation changed while the command was running")
    this.name = "GoCommandLockLostError"
  }
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined
}

export function isGoLockOwner(value: unknown): value is GoLockOwner {
  return (
    typeof value === "object"
    && value !== null
    && "pid" in value
    && typeof value.pid === "number"
    && Number.isSafeInteger(value.pid)
    && value.pid > 0
    && "token" in value
    && typeof value.token === "string"
    && value.token.length > 0
  )
}

function parseGoLockRecord(raw: string): GoParsedLockRecord | undefined {
  try {
    const value: unknown = JSON.parse(raw)
    if (isGoLockOwner(value)) {
      return { legacy: true, owner: value }
    }
    if (
      typeof value !== "object"
      || value === null
      || !("generation" in value)
      || typeof value.generation !== "string"
      || value.generation.length === 0
      || !("owner" in value)
      || !isGoLockOwner(value.owner)
      || !("schemaVersion" in value)
      || value.schemaVersion !== "ph-go-lock.2"
    ) {
      return undefined
    }
    return { generation: value.generation, owner: value.owner, schemaVersion: "ph-go-lock.2" }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined
    }
    throw error
  }
}

function snapshotGeneration(raw: string, device: number, inode: number): string {
  return `opaque-${createHash("sha256").update(`${device}:${inode}:${raw}`).digest("hex")}`
}

export function lockPath(projectDir: string): string {
  return join(projectDir, ".persona", "go.lock")
}

export function recoveryClaimPath(
  projectDir: string,
  generation: string,
  owner?: GoLockOwner,
): string {
  const key = createHash("sha256").update(generation).digest("hex")
  const base = `go.lock.recovery-${key}.claim`
  if (owner === undefined) {
    return join(projectDir, ".persona", base)
  }
  const ownerKey = createHash("sha256").update(`${owner.pid}:${owner.token}`).digest("hex")
  return join(projectDir, ".persona", `${base}.${ownerKey}`)
}

export function readGoLockSnapshot(path: string): GoLockSnapshot {
  try {
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { kind: "unsafe" }
    }
    const raw = readFileSync(path, "utf8")
    const record = parseGoLockRecord(raw)
    return {
      device: stat.dev,
      generation: record !== undefined && "generation" in record
        ? record.generation
        : snapshotGeneration(raw, stat.dev, stat.ino),
      inode: stat.ino,
      kind: "regular",
      raw,
      record,
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

export function snapshotMatches(
  left: Extract<GoLockSnapshot, { readonly kind: "regular" }>,
  right: GoLockSnapshot,
): boolean {
  return (
    right.kind === "regular"
    && left.device === right.device
    && left.inode === right.inode
    && left.generation === right.generation
    && left.raw === right.raw
  )
}

export function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    return errorCode(error) !== "ESRCH"
  }
}

function removePendingLock(path: string): void {
  try {
    unlinkSync(path)
  } catch (error) {
    if (!(error instanceof Error) || errorCode(error) !== "ENOENT") {
      throw error
    }
  }
}

export function writeLockRecord(
  path: string,
  record: GoLockRecord,
  options: GoLockPublishOptions = {},
): GoCommandLock {
  const pendingPath = `${path}.pending-${record.owner.token}`
  try {
    const descriptor = openSync(pendingPath, "wx")
    try {
      writeFileSync(descriptor, `${JSON.stringify(record)}\n`)
    } finally {
      closeSync(descriptor)
    }
    options.onBeforePublish?.()
    linkSync(pendingPath, path)
  } finally {
    removePendingLock(pendingPath)
  }
  const snapshot = readGoLockSnapshot(path)
  if (
    snapshot.kind !== "regular"
    || snapshot.record === undefined
    || !("generation" in snapshot.record)
  ) {
    throw new GoCommandLockLostError()
  }
  return {
    device: snapshot.device,
    generation: record.generation,
    inode: snapshot.inode,
    owner: record.owner,
    path,
  }
}
