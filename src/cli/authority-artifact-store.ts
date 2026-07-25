import { createHash, randomUUID } from "node:crypto"
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
import { join } from "node:path"

import { extractOriginalArtifactMembers } from "../../scripts/consumer-authority-artifact-archive.mjs"
import {
  authorityStoreRoot,
  type AuthorityEnrollmentStoreOptions,
} from "./authority-enrollment.js"
import {
  captureNoFollowDirectory,
  readNoFollowRegularFile,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"

const AUTHORITY_ARTIFACT_SCHEMA = "consumer-authority-original-artifact.1" as const
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
const MAX_STORE_BYTES = 12 * 1024 * 1024

export type AuthorityArtifact = {
  readonly archive: Buffer
  readonly artifactDigest: string
  readonly fetchedAt: string
  readonly repositoryId: number
  readonly runId: string
  readonly sourceHead: string
}

export type AuthorityArtifactRead =
  | { readonly state: "invalid" }
  | { readonly state: "missing" }
  | { readonly state: "ready"; readonly value: AuthorityArtifact }

export function authorityArtifactPath(
  repositoryId: number,
  options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {},
): string | undefined {
  return isPositiveInteger(repositoryId)
    ? join(authorityStoreRoot(options), `consumer-authority-artifact-${repositoryId}.json`)
    : undefined
}

export function readAuthorityArtifact(
  repositoryId: number,
  options: Pick<AuthorityEnrollmentStoreOptions, "storeRoot"> = {},
): AuthorityArtifactRead {
  const path = authorityArtifactPath(repositoryId, options)
  if (path === undefined) return { state: "invalid" }
  const root = authorityStoreRoot(options)
  const directory = captureNoFollowDirectory(root)
  if (directory.kind === "absent") return { state: "missing" }
  if (directory.kind !== "ready") return { state: "invalid" }
  const source = readNoFollowRegularFile(path, MAX_STORE_BYTES, root)
  if (source.kind === "absent") return { state: "missing" }
  if (source.kind !== "ready") return { state: "invalid" }
  return parseStoredArtifact(source.value.bytes) ?? { state: "invalid" }
}

export function writeAuthorityArtifact(
  artifact: AuthorityArtifact,
  options: AuthorityEnrollmentStoreOptions = {},
): boolean {
  if (!isAuthorityArtifact(artifact)) return false
  const path = authorityArtifactPath(artifact.repositoryId, options)
  if (path === undefined) return false
  const root = authorityStoreRoot(options)
  const directory = preparePrivateStoreRoot(root)
  if (directory === undefined) return false
  const payload = `${JSON.stringify({
    archiveBase64: artifact.archive.toString("base64"),
    artifactDigest: artifact.artifactDigest,
    fetchedAt: artifact.fetchedAt,
    repositoryId: artifact.repositoryId,
    runId: artifact.runId,
    schemaVersion: AUTHORITY_ARTIFACT_SCHEMA,
    sourceHead: artifact.sourceHead,
  })}\n`
  return writePrivateStoreFile(root, path, payload, directory)
}

function parseStoredArtifact(bytes: Buffer): AuthorityArtifactRead | undefined {
  try {
    const value: unknown = JSON.parse(bytes.toString("utf8"))
    if (!isRecord(value) || !exactKeys(value, [
      "archiveBase64",
      "artifactDigest",
      "fetchedAt",
      "repositoryId",
      "runId",
      "schemaVersion",
      "sourceHead",
    ])) {
      return undefined
    }
    if (
      value.schemaVersion !== AUTHORITY_ARTIFACT_SCHEMA
      || typeof value.archiveBase64 !== "string"
      || typeof value.artifactDigest !== "string"
      || typeof value.fetchedAt !== "string"
      || !isPositiveInteger(value.repositoryId)
      || typeof value.runId !== "string"
      || typeof value.sourceHead !== "string"
    ) {
      return undefined
    }
    const archive = Buffer.from(value.archiveBase64, "base64")
    const artifact: AuthorityArtifact = {
      archive,
      artifactDigest: value.artifactDigest,
      fetchedAt: value.fetchedAt,
      repositoryId: value.repositoryId,
      runId: value.runId,
      sourceHead: value.sourceHead,
    }
    return isAuthorityArtifact(artifact) ? { state: "ready", value: artifact } : undefined
  } catch {
    return undefined
  }
}

function isAuthorityArtifact(value: AuthorityArtifact): boolean {
  if (
    value.archive.byteLength === 0
    || value.archive.byteLength > MAX_ARCHIVE_BYTES
    || !isDigest(value.artifactDigest)
    || value.artifactDigest !== digest(value.archive)
    || !isTimestamp(value.fetchedAt)
    || !isPositiveInteger(value.repositoryId)
    || !isRunId(value.runId)
    || !isCommit(value.sourceHead)
  ) {
    return false
  }
  try {
    extractOriginalArtifactMembers(value.archive)
    return true
  } catch {
    return false
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
  path: string,
  payload: string,
  before: NoFollowPathIdentity,
): boolean {
  const temporaryPath = join(root, `.consumer-authority-artifact-${randomUUID()}.tmp`)
  let descriptor: number | undefined
  try {
    descriptor = openSync(temporaryPath, constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_WRONLY, 0o600)
    writeSync(descriptor, payload, 0, "utf8")
    fsyncSync(descriptor)
    closeSync(descriptor)
    descriptor = undefined
    const afterWrite = captureNoFollowDirectory(root)
    if (afterWrite.kind !== "ready" || !sameDirectoryLocation(before, afterWrite.value)) return false
    renameSync(temporaryPath, path)
    const afterRename = captureNoFollowDirectory(root)
    if (afterRename.kind !== "ready" || !sameDirectoryLocation(before, afterRename.value)) return false
    const source = readNoFollowRegularFile(path, MAX_STORE_BYTES, root)
    return source.kind === "ready" && source.value.bytes.toString("utf8") === payload
  } catch {
    return false
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
    rmSync(temporaryPath, { force: true })
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === keys[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isRunId(value: string): boolean {
  return /^[1-9][0-9]{0,18}$/u.test(value)
}

function isCommit(value: string): boolean {
  return /^[a-f0-9]{40}$/iu.test(value)
}

function isTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value))
}

function isDigest(value: string): boolean {
  return /^sha256:[a-f0-9]{64}$/iu.test(value)
}

function digest(bytes: Buffer): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`
}

function sameDirectoryLocation(left: NoFollowPathIdentity, right: NoFollowPathIdentity): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
}
