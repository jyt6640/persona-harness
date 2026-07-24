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
import {
  AUTHORITY_STORE_SCHEMA,
  MAX_AUTHORITY_AUDIT_RECORDS,
  authorityAuditRecord,
  authorityEnrollmentFromReadback,
  isAuthorityEnrollment,
  parseAuthorityStore,
  type AuthorityEnrollment,
  type AuthorityEnrollmentReadback,
  type AuthorityStore,
} from "./authority-enrollment-schema.js"

const MAX_STORE_BYTES = 256 * 1024

export type AuthorityEnrollmentRead =
  | { readonly state: "invalid" }
  | { readonly state: "missing" }
  | { readonly state: "ready"; readonly value: readonly AuthorityEnrollment[] }

export type AuthorityEnrollmentStoreOptions = {
  readonly now?: Date
  readonly storeRoot?: string
}

type AuthorityStoreRead =
  | { readonly state: "invalid" }
  | { readonly state: "missing" }
  | { readonly state: "ready"; readonly value: AuthorityStore }

export {
  authorityEnrollmentFromReadback,
} from "./authority-enrollment-schema.js"
export type {
  AuthorityAuditRecord,
  AuthorityEnrollment,
  AuthorityEnrollmentReadback,
} from "./authority-enrollment-schema.js"

export function authorityStoreRoot(options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {}): string {
  return resolve(options.storeRoot ?? join(homedir(), ".persona-harness"))
}

export function authorityStorePath(options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {}): string {
  return join(authorityStoreRoot(options), "consumer-authority-v1.json")
}

export function readAuthorityEnrollments(
  options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {},
): AuthorityEnrollmentRead {
  const store = readAuthorityStore(options)
  return store.state === "ready"
    ? { state: "ready", value: store.value.entries }
    : { state: store.state }
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
  const existing = readAuthorityStore(options)
  if (existing.state === "invalid") return false
  const store = existing.state === "ready"
    ? existing.value
    : { audit: [], entries: [], schemaVersion: AUTHORITY_STORE_SCHEMA }
  if (store.audit.length >= MAX_AUTHORITY_AUDIT_RECORDS) return false
  const action = store.entries.some((entry) => entry.repositoryId === enrollment.repositoryId)
    ? "updated"
    : "enrolled"
  const entries = [
    ...store.entries.filter((entry) => entry.repositoryId !== enrollment.repositoryId),
    enrollment,
  ].sort((left, right) => left.repositoryId - right.repositoryId)
  const payload = `${JSON.stringify({
    audit: [...store.audit, authorityAuditRecord(enrollment, action)],
    entries,
    schemaVersion: AUTHORITY_STORE_SCHEMA,
  })}\n`
  return writePrivateStoreFile(root, authorityStorePath(options), payload, before)
}

function readAuthorityStore(
  options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot">,
): AuthorityStoreRead {
  const root = authorityStoreRoot(options)
  const directory = captureNoFollowDirectory(root)
  if (directory.kind === "absent") return { state: "missing" }
  if (directory.kind !== "ready") return { state: "invalid" }
  const source = readNoFollowRegularFile(authorityStorePath(options), MAX_STORE_BYTES, root)
  if (source.kind === "absent") return { state: "missing" }
  if (source.kind !== "ready") return { state: "invalid" }
  try {
    const parsed: unknown = JSON.parse(source.value.bytes.toString("utf8"))
    const store = parseAuthorityStore(parsed)
    return store === undefined ? { state: "invalid" } : { state: "ready", value: store }
  } catch {
    return { state: "invalid" }
  }
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

function sameDirectory(
  left: NoFollowPathIdentity,
  right: NoFollowPathIdentity,
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
}
