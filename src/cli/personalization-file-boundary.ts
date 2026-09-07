import { randomUUID } from "node:crypto"
import { closeSync, constants, fchmodSync, fstatSync, fsyncSync, lstatSync, openSync, renameSync, unlinkSync, writeFileSync } from "node:fs"
import { withNoFollowDirectoryChain } from "../io/no-follow-directory-chain.js"
import {
  captureNoFollowDirectory, noFollowPathIdentityFromStat, readNoFollowRegularFile,
  sameNoFollowPathIdentity, sameNoFollowPathLocation, type NoFollowRegularFileRead,
} from "../io/no-follow-file.js"

export const MAX_PERSONALIZATION_FILE_BYTES = 8 * 1024 * 1024
type FileSnapshot = Exclude<NoFollowRegularFileRead, { readonly kind: "blocked" }>
type FileMutation = { readonly snapshot: FileSnapshot; readonly publish: (bytes: Buffer) => void }

export class PersonalizationFileError extends Error {
  constructor(readonly code: "unsafe" | "busy") {
    super(code)
    this.name = "PersonalizationFileError"
  }
}

export function readPersonalizationFile(root: string): FileSnapshot {
  const directory = captureNoFollowDirectory(root)
  if (directory.kind === "absent") return { kind: "absent" }
  if (directory.kind === "blocked") throw new PersonalizationFileError("unsafe")
  return withStoreDirectory(root, undefined, readCurrentFile)
}

export function withPersonalizationFileMutation<T>(root: string, operation: (file: FileMutation) => T): T {
  return withStoreDirectory(root, 0o700, (assertLocation) => {
    let lock: number
    try {
      lock = openSync("profile.json.lock", constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    } catch (error) {
      throw new PersonalizationFileError(error !== null && typeof error === "object" && "code" in error && error.code === "EEXIST" ? "busy" : "unsafe")
    }
    try {
      const snapshot = readCurrentFile()
      return operation({ snapshot, publish: (bytes) => publishCurrentFile(bytes, snapshot, assertLocation) })
    } finally {
      try {
        const opened = noFollowPathIdentityFromStat(fstatSync(lock, { bigint: true }))
        const current = lstatSync("profile.json.lock", { bigint: true })
        if (current.isSymbolicLink() || !sameNoFollowPathLocation(opened, noFollowPathIdentityFromStat(current))) {
          throw new PersonalizationFileError("unsafe")
        }
        unlinkSync("profile.json.lock")
      } finally {
        closeSync(lock)
      }
    }
  })
}

function withStoreDirectory<T>(root: string, mode: number | undefined, operation: (assertLocation: () => void) => T): T {
  const result = withNoFollowDirectoryChain(root, mode, (assertLocation) => {
    try { return { kind: "ready", value: operation(assertLocation) } as const }
    catch (error) { return { kind: "failed", error } as const }
  })
  if (result === undefined) throw new PersonalizationFileError("unsafe")
  if (result.kind === "failed") throw result.error
  return result.value
}

function readCurrentFile(): FileSnapshot {
  const file = readNoFollowRegularFile("profile.json", MAX_PERSONALIZATION_FILE_BYTES, ".")
  if (file.kind === "blocked") throw new PersonalizationFileError("unsafe")
  return file
}

function sameSnapshot(left: FileSnapshot, right: FileSnapshot): boolean {
  return left.kind === "absent"
    ? right.kind === "absent"
    : right.kind === "ready" && sameNoFollowPathIdentity(left.value.identity, right.value.identity)
}

function publishCurrentFile(bytes: Buffer, expected: FileSnapshot, assertLocation: () => void): void {
  assertLocation()
  if (bytes.byteLength > MAX_PERSONALIZATION_FILE_BYTES || !sameSnapshot(expected, readCurrentFile())) {
    throw new PersonalizationFileError("unsafe")
  }
  const temporary = `.profile-${randomUUID()}.tmp`
  const descriptor = openSync(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  let temporaryPresent = true
  try {
    if (process.platform !== "win32") fchmodSync(descriptor, 0o600)
    writeFileSync(descriptor, bytes)
    fsyncSync(descriptor)
    assertLocation()
    if (!sameSnapshot(expected, readCurrentFile())) throw new PersonalizationFileError("unsafe")
    renameSync(temporary, "profile.json")
    temporaryPresent = false
    const opened = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    const published = readCurrentFile()
    if (published.kind !== "ready" || !sameNoFollowPathIdentity(opened, published.value.identity)) {
      throw new PersonalizationFileError("unsafe")
    }
  } finally {
    closeSync(descriptor)
    if (temporaryPresent) unlinkSync(temporary)
  }
}
