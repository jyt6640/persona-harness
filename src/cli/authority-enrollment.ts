import { randomUUID } from "node:crypto"
import {
  closeSync,
  constants,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs"
import { homedir } from "node:os"
import { join, resolve } from "node:path"

import {
  captureNoFollowDirectory,
  readNoFollowRegularFile,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"
import type { ProjectFinishAttestationEnrolledPolicy } from "./project-finish-attestation-verifier.js"

const AUTHORITY_ENROLLMENT_SCHEMA = "consumer-authority-enrollment.1" as const
const AUTHORITY_STORE_SCHEMA = "consumer-authority-store.1" as const
const MAX_STORE_BYTES = 256 * 1024

export type AuthorityEnrollment = ProjectFinishAttestationEnrolledPolicy & {
  readonly enrolledAt: string
  readonly event: "push"
  readonly policyMarker: "user-scoped-enrollment-v1"
  readonly ref: "refs/heads/main"
  readonly schemaVersion: typeof AUTHORITY_ENROLLMENT_SCHEMA
}

export type AuthorityEnrollmentRead =
  | { readonly state: "invalid" }
  | { readonly state: "missing" }
  | { readonly state: "ready"; readonly value: readonly AuthorityEnrollment[] }

export type AuthorityEnrollmentReadback = {
  readonly callerWorkflowPath: string
  readonly repositoryId: number
  readonly repositorySlug: string
  readonly reusableWorkflowSha: string
}

export type AuthorityEnrollmentStoreOptions = {
  readonly now?: Date
  readonly storeRoot?: string
}

export function authorityStoreRoot(options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {}): string {
  return resolve(options.storeRoot ?? join(homedir(), ".persona-harness"))
}

export function authorityStorePath(options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {}): string {
  return join(authorityStoreRoot(options), "consumer-authority-v1.json")
}

export function authorityEnrollmentFromReadback(
  readback: AuthorityEnrollmentReadback,
  now = new Date(),
): AuthorityEnrollment | undefined {
  const callerWorkflowPath = normalizeCallerWorkflowPath(readback.callerWorkflowPath)
  if (
    callerWorkflowPath === undefined
    || !isPositiveInteger(readback.repositoryId)
    || !isPublicRepositorySlug(readback.repositorySlug)
    || !isCommit(readback.reusableWorkflowSha)
    || !Number.isFinite(now.getTime())
  ) {
    return undefined
  }
  return {
    callerWorkflowPath,
    enrolledAt: now.toISOString(),
    event: "push",
    policyMarker: "user-scoped-enrollment-v1",
    ref: "refs/heads/main",
    repositoryId: readback.repositoryId,
    repositorySlug: readback.repositorySlug,
    reusableWorkflowSha: readback.reusableWorkflowSha.toLowerCase(),
    schemaVersion: AUTHORITY_ENROLLMENT_SCHEMA,
  }
}

export function readAuthorityEnrollments(
  options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {},
): AuthorityEnrollmentRead {
  const root = authorityStoreRoot(options)
  const directory = captureNoFollowDirectory(root)
  if (directory.kind === "absent") return { state: "missing" }
  if (directory.kind !== "ready") return { state: "invalid" }

  const source = readNoFollowRegularFile(authorityStorePath(options), MAX_STORE_BYTES, root)
  if (source.kind === "absent") return { state: "missing" }
  if (source.kind !== "ready") return { state: "invalid" }
  try {
    const parsed: unknown = JSON.parse(source.value.bytes.toString("utf8"))
    const entries = parseAuthorityStore(parsed)
    return entries === undefined ? { state: "invalid" } : { state: "ready", value: entries }
  } catch {
    return { state: "invalid" }
  }
}

export function readAuthorityEnrollment(
  _projectDir: string,
  options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {},
): AuthorityEnrollmentRead {
  return readAuthorityEnrollments(options)
}

export function writeAuthorityEnrollment(
  enrollment: AuthorityEnrollment,
  options: AuthorityEnrollmentStoreOptions = {},
): boolean {
  if (!isAuthorityEnrollment(enrollment)) return false
  const root = authorityStoreRoot(options)
  const before = preparePrivateStoreRoot(root)
  if (before === undefined) return false
  const existing = readAuthorityEnrollments(options)
  if (existing.state === "invalid") return false
  const entries = existing.state === "ready" ? [...existing.value] : []
  const next = [
    ...entries.filter((entry) => entry.repositoryId !== enrollment.repositoryId),
    enrollment,
  ].sort((left, right) => left.repositoryId - right.repositoryId)
  const payload = `${JSON.stringify({ entries: next, schemaVersion: AUTHORITY_STORE_SCHEMA })}\n`
  return writePrivateStoreFile(root, authorityStorePath(options), payload, before)
}

function preparePrivateStoreRoot(root: string): NoFollowPathIdentity | undefined {
  try {
    mkdirSync(root, { mode: 0o700, recursive: true })
  } catch {
    return undefined
  }
  const directory = captureNoFollowDirectory(root)
  return directory.kind === "ready" ? directory.value : undefined
}

function writePrivateStoreFile(
  root: string,
  targetPath: string,
  payload: string,
  before: NoFollowPathIdentity,
): boolean {
  const tempPath = join(root, `.consumer-authority-${randomUUID()}.tmp`)
  let descriptor: number | undefined
  try {
    descriptor = openSync(tempPath, constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY, 0o600)
    writeSync(descriptor, payload, 0, "utf8")
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    const afterWrite = captureNoFollowDirectory(root)
    if (afterWrite.kind !== "ready" || !sameDirectory(before, afterWrite.value)) return false
    renameSync(tempPath, targetPath)
    const afterRename = captureNoFollowDirectory(root)
    if (afterRename.kind !== "ready" || !sameDirectory(before, afterRename.value)) return false
    const source = readNoFollowRegularFile(targetPath, MAX_STORE_BYTES, root)
    return source.kind === "ready" && source.value.bytes.toString("utf8") === payload
  } catch {
    return false
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    rmSync(tempPath, { force: true })
  }
}

function parseAuthorityStore(value: unknown): readonly AuthorityEnrollment[] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["entries", "schemaVersion"]) || value.schemaVersion !== AUTHORITY_STORE_SCHEMA || !Array.isArray(value.entries) || value.entries.length > 128) {
    return undefined
  }
  const entries = value.entries.map(parseAuthorityEnrollment)
  if (entries.some((entry) => entry === undefined)) return undefined
  const ready = entries as AuthorityEnrollment[]
  const ids = new Set(ready.map((entry) => entry.repositoryId))
  return ids.size === ready.length ? ready : undefined
}

function parseAuthorityEnrollment(value: unknown): AuthorityEnrollment | undefined {
  if (!isRecord(value) || !exactKeys(value, [
    "callerWorkflowPath",
    "enrolledAt",
    "event",
    "policyMarker",
    "ref",
    "repositoryId",
    "repositorySlug",
    "reusableWorkflowSha",
    "schemaVersion",
  ])) {
    return undefined
  }
  return isAuthorityEnrollment(value) ? value : undefined
}

function isAuthorityEnrollment(value: unknown): value is AuthorityEnrollment {
  return isRecord(value)
    && normalizeCallerWorkflowPath(value.callerWorkflowPath) === value.callerWorkflowPath
    && isTimestamp(value.enrolledAt)
    && value.event === "push"
    && value.policyMarker === "user-scoped-enrollment-v1"
    && value.ref === "refs/heads/main"
    && isPositiveInteger(value.repositoryId)
    && isPublicRepositorySlug(value.repositorySlug)
    && isCommit(value.reusableWorkflowSha)
    && value.schemaVersion === AUTHORITY_ENROLLMENT_SCHEMA
}

function normalizeCallerWorkflowPath(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const prefix = ".github/workflows/"
  const path = value.startsWith(prefix) ? value.slice(prefix.length) : value
  if (
    path.length === 0
    || path.length > 256
    || path.includes("\\")
    || !path.endsWith(".yml")
    || path.split("/").some((part) => part === "" || part === "." || part === "..")
  ) {
    return undefined
  }
  return path
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === keys[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isPublicRepositorySlug(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value)
    && !value.split("/").some((part) => part === "." || part === "..")
}

function isCommit(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/iu.test(value)
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
}

function sameDirectory(
  left: NoFollowPathIdentity,
  right: NoFollowPathIdentity,
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
}
