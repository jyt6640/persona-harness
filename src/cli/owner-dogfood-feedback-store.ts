import {
  closeSync,
  constants,
  fchmodSync,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  unlinkSync,
  writeSync,
} from "node:fs"

import {
  captureNoFollowDirectory,
  noFollowPathIdentityFromStat,
  readNoFollowRegularFile,
  sameNoFollowPathIdentity,
  sameNoFollowPathLocation,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"
import { withNoFollowDirectoryChain } from "../io/no-follow-directory-chain.js"

const EVENT_FILE_NAME = "events.jsonl"
const EVENT_LOCK_NAME = ".events.lock"
const EVENT_SCHEMA_VERSION = "owner-dogfood-feedback.1"
const MAX_EVENT_BYTES = 512
const MAX_STORE_BYTES = 256 * 1024
const MAX_STORED_EVENTS = 512

export const OWNER_DOGFOOD_FEEDBACK_CODES = [
  "bootstrap-workspace-intake-failed",
  "interview-repeated-question",
  "project-philosophy-not-injected",
  "shared-skill-routing-unavailable",
  "source-read-runtime-unavailable",
  "unnecessary-interview",
  "workflow-history-missing",
] as const

export type OwnerDogfoodFeedbackCode = typeof OWNER_DOGFOOD_FEEDBACK_CODES[number]

type OwnerDogfoodFeedbackEvent = Readonly<{
  readonly code: OwnerDogfoodFeedbackCode
  readonly recordedAt: string
  readonly schemaVersion: typeof EVENT_SCHEMA_VERSION
}>

type ExistingEvents =
  | Readonly<{ readonly kind: "absent" }>
  | Readonly<{ readonly count: number; readonly identity: NoFollowPathIdentity; readonly kind: "ready" }>
  | Readonly<{ readonly kind: "blocked" }>

type EventLock = Readonly<{
  readonly descriptor: number
  readonly identity: NoFollowPathIdentity
}>

export function parseOwnerDogfoodFeedbackCode(value: string | undefined): OwnerDogfoodFeedbackCode | undefined {
  for (const code of OWNER_DOGFOOD_FEEDBACK_CODES) {
    if (value === code) return code
  }
  return undefined
}

export function recordOwnerDogfoodFeedback(
  root: string,
  code: OwnerDogfoodFeedbackCode,
  recordedAt: Date,
): boolean {
  const event = createEvent(code, recordedAt)
  if (event === undefined) return false
  const payload = `${JSON.stringify(event)}\n`
  if (Buffer.byteLength(payload, "utf8") > MAX_EVENT_BYTES) return false
  return withNoFollowDirectoryChain(root, 0o700, () => recordAtCurrentRoot(payload)) === true
}

function createEvent(code: OwnerDogfoodFeedbackCode, recordedAt: Date): OwnerDogfoodFeedbackEvent | undefined {
  try {
    return { code, recordedAt: recordedAt.toISOString(), schemaVersion: EVENT_SCHEMA_VERSION }
  } catch {
    return undefined
  }
}

function recordAtCurrentRoot(payload: string): boolean {
  if (!hasPrivateCurrentRoot()) return false
  const lock = acquireEventLock()
  if (lock === undefined) return false
  try {
    const existing = readExistingEvents()
    if (existing.kind === "blocked" || (existing.kind === "ready" && existing.count >= MAX_STORED_EVENTS)) {
      return false
    }
    return appendEvent(existing, payload)
  } finally {
    releaseEventLock(lock)
  }
}

function readExistingEvents(): ExistingEvents {
  const source = readNoFollowRegularFile(EVENT_FILE_NAME, MAX_STORE_BYTES, ".")
  if (source.kind === "absent") return { kind: "absent" }
  if (source.kind !== "ready") return { kind: "blocked" }
  const count = countEventLines(source.value.bytes.toString("utf8"))
  if (!hasPrivateCurrentRoot() || !isPrivateMode(source.value.identity.mode, "0600") || count === undefined) {
    return { kind: "blocked" }
  }
  return { count, identity: source.value.identity, kind: "ready" }
}

function countEventLines(text: string): number | undefined {
  if (text.length === 0 || !text.endsWith("\n")) return undefined
  const lines = text.slice(0, -1).split("\n")
  if (lines.length > MAX_STORED_EVENTS || lines.some((line) => line.length === 0)) return undefined
  return lines.every((line) => isOwnerDogfoodFeedbackEventJson(line)) ? lines.length : undefined
}

function isOwnerDogfoodFeedbackEventJson(line: string): boolean {
  try {
    return isOwnerDogfoodFeedbackEvent(JSON.parse(line))
  } catch {
    return false
  }
}

function isOwnerDogfoodFeedbackEvent(value: unknown): value is OwnerDogfoodFeedbackEvent {
  if (!isRecord(value)) return false
  const record = value
  return Object.keys(record).length === 3
    && parseOwnerDogfoodFeedbackCode(typeof record.code === "string" ? record.code : undefined) !== undefined
    && typeof record.recordedAt === "string"
    && Number.isFinite(Date.parse(record.recordedAt))
    && record.schemaVersion === EVENT_SCHEMA_VERSION
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function appendEvent(existing: ExistingEvents, payload: string): boolean {
  let descriptor: number | undefined
  try {
    const flags = existing.kind === "absent"
      ? constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY
      : constants.O_APPEND | constants.O_NOFOLLOW | constants.O_WRONLY
    descriptor = openSync(EVENT_FILE_NAME, flags, 0o600)
    const before = fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) return false
    const beforeIdentity = noFollowPathIdentityFromStat(before)
    if (existing.kind === "ready" && !sameNoFollowPathIdentity(existing.identity, beforeIdentity)) return false
    fchmodSync(descriptor, 0o600)
    const afterMode = fstatSync(descriptor, { bigint: true })
    if (!afterMode.isFile() || !isPrivateMode(noFollowPathIdentityFromStat(afterMode).mode, "0600")) return false
    if (!writeAll(descriptor, payload)) return false
    fsyncSync(descriptor)
    const after = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(EVENT_FILE_NAME, { bigint: true })
    return after.isFile()
      && current.isFile()
      && !current.isSymbolicLink()
      && hasPrivateCurrentRoot()
      && sameNoFollowPathLocation(noFollowPathIdentityFromStat(after), noFollowPathIdentityFromStat(current))
      && isPrivateMode(noFollowPathIdentityFromStat(after).mode, "0600")
  } catch {
    return false
  } finally {
    if (descriptor !== undefined) closeDescriptor(descriptor)
  }
}

function acquireEventLock(): EventLock | undefined {
  let descriptor: number | undefined
  let identity: NoFollowPathIdentity | undefined
  try {
    descriptor = openSync(
      EVENT_LOCK_NAME,
      constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY,
      0o600,
    )
    const before = fstatSync(descriptor, { bigint: true })
    if (!before.isFile()) return undefined
    identity = noFollowPathIdentityFromStat(before)
    const current = lstatSync(EVENT_LOCK_NAME, { bigint: true })
    if (!current.isFile() || current.isSymbolicLink() || !sameNoFollowPathIdentity(identity, noFollowPathIdentityFromStat(current))) {
      return undefined
    }
    fchmodSync(descriptor, 0o600)
    const after = fstatSync(descriptor, { bigint: true })
    if (!after.isFile() || !isPrivateMode(noFollowPathIdentityFromStat(after).mode, "0600")) return undefined
    identity = noFollowPathIdentityFromStat(after)
    const updated = lstatSync(EVENT_LOCK_NAME, { bigint: true })
    if (!updated.isFile() || updated.isSymbolicLink() || !sameNoFollowPathIdentity(identity, noFollowPathIdentityFromStat(updated))) {
      return undefined
    }
    const lock = { descriptor, identity }
    descriptor = undefined
    identity = undefined
    return lock
  } catch {
    return undefined
  } finally {
    if (descriptor !== undefined) closeDescriptor(descriptor)
    if (identity !== undefined) removeOwnedEventLock(identity)
  }
}

function releaseEventLock(lock: EventLock): void {
  const current = currentOwnedEventLock(lock)
  closeDescriptor(lock.descriptor)
  if (current) removeOwnedEventLock(lock.identity)
}

function currentOwnedEventLock(lock: EventLock): boolean {
  try {
    const descriptorStat = fstatSync(lock.descriptor, { bigint: true })
    if (!descriptorStat.isFile()) return false
    const descriptor = noFollowPathIdentityFromStat(descriptorStat)
    const current = lstatSync(EVENT_LOCK_NAME, { bigint: true })
    return current.isFile()
      && !current.isSymbolicLink()
      && sameNoFollowPathIdentity(lock.identity, descriptor)
      && sameNoFollowPathIdentity(descriptor, noFollowPathIdentityFromStat(current))
  } catch {
    return false
  }
}

function removeOwnedEventLock(identity: NoFollowPathIdentity): void {
  try {
    const current = lstatSync(EVENT_LOCK_NAME, { bigint: true })
    if (current.isFile() && !current.isSymbolicLink() && sameNoFollowPathIdentity(identity, noFollowPathIdentityFromStat(current))) {
      unlinkSync(EVENT_LOCK_NAME)
    }
  } catch {
    // A changed lock remains in place and blocks later writes rather than removing an unknown file.
  }
}

function writeAll(descriptor: number, payload: string): boolean {
  const bytes = Buffer.from(payload, "utf8")
  let offset = 0
  while (offset < bytes.byteLength) {
    const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset)
    if (written <= 0) return false
    offset += written
  }
  return true
}

function hasPrivateCurrentRoot(): boolean {
  const current = captureNoFollowDirectory(".")
  return current.kind === "ready" && isPrivateMode(current.value.mode, "0700")
}

function isPrivateMode(mode: string, expected: "0600" | "0700"): boolean {
  return process.platform === "win32" || mode === expected
}

function closeDescriptor(descriptor: number): void {
  try {
    closeSync(descriptor)
  } catch {
    // Cleanup must not turn a failed diagnostic recording into a process failure.
  }
}
