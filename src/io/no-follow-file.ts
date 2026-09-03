import { createHash } from "node:crypto"
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readSync,
  type BigIntStats,
} from "node:fs"
import { isAbsolute, join, resolve } from "node:path"

export type NoFollowPathIdentity = {
  readonly ctimeNs: string
  readonly dev: string
  readonly ino: string
  readonly mode: string
  readonly mtimeNs: string
  readonly size: string
}

export type NoFollowDirectoryCapture =
  | { readonly kind: "absent" }
  | { readonly code: "unsafe" | "unreadable"; readonly kind: "blocked" }
  | { readonly kind: "ready"; readonly value: NoFollowPathIdentity }

export type NoFollowRegularFileRead =
  | { readonly kind: "absent" }
  | { readonly code: "limit" | "replaced" | "unsafe" | "unreadable"; readonly kind: "blocked" }
  | {
      readonly kind: "ready"
      readonly value: {
        readonly bytes: Buffer
        readonly identity: NoFollowPathIdentity
      }
    }

export function captureNoFollowDirectory(path: string): NoFollowDirectoryCapture {
  try {
    const stat = lstatSync(path, { bigint: true })
    if (stat.isSymbolicLink() || !stat.isDirectory()) return { code: "unsafe", kind: "blocked" }
    return { kind: "ready", value: pathIdentity(stat) }
  } catch (error) {
    return errno(error) === "ENOENT" ? { kind: "absent" } : { code: "unreadable", kind: "blocked" }
  }
}

export function readNoFollowRegularFile(
  path: string,
  maxBytes: number,
  parentPath?: string,
): NoFollowRegularFileRead {
  const beforeParent = parentPath === undefined ? undefined : captureNoFollowDirectory(parentPath)
  if (beforeParent?.kind === "blocked") return beforeParent
  if (beforeParent?.kind === "absent") return { code: "unsafe", kind: "blocked" }

  let descriptor: number | undefined
  try {
    descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW)
  } catch (error) {
    return errno(error) === "ENOENT" ? { kind: "absent" } : { code: "unsafe", kind: "blocked" }
  }

  try {
    const before = fstatSync(descriptor, { bigint: true })
    if (!isNoFollowSingleLinkRegularFile(before)) return { code: "unsafe", kind: "blocked" }
    if (before.size > BigInt(maxBytes)) return { code: "limit", kind: "blocked" }

    const bytes = readFixedSizeDescriptor(descriptor, Number(before.size))
    const after = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(path, { bigint: true })
    if (
      !isNoFollowSingleLinkRegularFile(after)
      || !isNoFollowSingleLinkRegularFile(current)
      || !sameNoFollowPathIdentity(pathIdentity(before), pathIdentity(after))
      || !sameNoFollowPathIdentity(pathIdentity(after), pathIdentity(current))
      || bytes.byteLength !== Number(after.size)
    ) {
      return { code: "replaced", kind: "blocked" }
    }

    if (beforeParent !== undefined && parentPath !== undefined) {
      const afterParent = captureNoFollowDirectory(parentPath)
      if (
        afterParent.kind !== "ready"
        || !sameNoFollowPathIdentity(beforeParent.value, afterParent.value)
      ) {
        return { code: "replaced", kind: "blocked" }
      }
    }

    return { kind: "ready", value: { bytes, identity: pathIdentity(after) } }
  } catch {
    return { code: "unreadable", kind: "blocked" }
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
}

export function readNoFollowProjectFile(
  projectDir: string,
  relativePath: string,
  maxBytes: number,
): NoFollowRegularFileRead {
  const segments = safeRelativeSegments(relativePath)
  if (segments === undefined) return { code: "unsafe", kind: "blocked" }

  const rootPath = resolve(projectDir)
  const root = captureNoFollowDirectory(rootPath)
  if (root.kind !== "ready") return root.kind === "absent" ? { kind: "absent" } : root

  const reservations: Array<{ readonly identity: NoFollowPathIdentity; readonly path: string }> = [
    { identity: root.value, path: rootPath },
  ]
  let parentPath = rootPath
  for (const segment of segments.slice(0, -1)) {
    parentPath = join(parentPath, segment)
    const directory = captureNoFollowDirectory(parentPath)
    if (directory.kind !== "ready") return directory.kind === "absent" ? { kind: "absent" } : directory
    reservations.push({ identity: directory.value, path: parentPath })
  }

  const leaf = segments.at(-1)
  if (leaf === undefined) return { code: "unsafe", kind: "blocked" }
  const file = readNoFollowRegularFile(join(parentPath, leaf), maxBytes, parentPath)
  if (file.kind !== "ready") return file

  for (const reservation of reservations) {
    const current = captureNoFollowDirectory(reservation.path)
    if (current.kind !== "ready" || !sameNoFollowPathIdentity(reservation.identity, current.value)) {
      return { code: "replaced", kind: "blocked" }
    }
  }
  return file
}

export function sameNoFollowPathIdentity(
  left: NoFollowPathIdentity,
  right: NoFollowPathIdentity,
): boolean {
  return left.ctimeNs === right.ctimeNs
    && left.dev === right.dev
    && left.ino === right.ino
    && left.mode === right.mode
    && left.mtimeNs === right.mtimeNs
    && left.size === right.size
}

export function sameNoFollowPathLocation(
  left: NoFollowPathIdentity,
  right: NoFollowPathIdentity,
): boolean {
  return left.dev === right.dev && left.ino === right.ino && left.mode === right.mode
}

export function noFollowPathIdentityFromStat(stat: BigIntStats): NoFollowPathIdentity {
  return pathIdentity(stat)
}

export function isNoFollowSingleLinkRegularFile(stat: BigIntStats): boolean {
  return stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1n
}

export function noFollowPathIdentityDigest(identity: NoFollowPathIdentity): string {
  return `sha256:${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`
}

export function noFollowPathLocationDigest(identity: NoFollowPathIdentity): string {
  return `sha256:${createHash("sha256").update(JSON.stringify({
    dev: identity.dev,
    ino: identity.ino,
    mode: identity.mode,
  })).digest("hex")}`
}

function pathIdentity(stat: BigIntStats): NoFollowPathIdentity {
  return {
    ctimeNs: stat.ctimeNs.toString(),
    dev: stat.dev.toString(),
    ino: stat.ino.toString(),
    mode: Number(stat.mode & 0o777n).toString(8).padStart(4, "0"),
    mtimeNs: stat.mtimeNs.toString(),
    size: stat.size.toString(),
  }
}

function readFixedSizeDescriptor(descriptor: number, expectedBytes: number): Buffer {
  if (!Number.isSafeInteger(expectedBytes) || expectedBytes < 0) {
    throw new Error("invalid bounded file size")
  }
  const bytes = Buffer.alloc(expectedBytes)
  let offset = 0
  while (offset < expectedBytes) {
    const read = readSync(descriptor, bytes, offset, expectedBytes - offset, offset)
    if (!Number.isSafeInteger(read) || read <= 0) {
      throw new Error("bounded file read ended early")
    }
    offset += read
  }
  return bytes
}

function errno(error: unknown): string | undefined {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && typeof error.code === "string"
    ? error.code
    : undefined
}

function safeRelativeSegments(relativePath: string): readonly string[] | undefined {
  if (
    relativePath.length === 0
    || relativePath.length > 240
    || relativePath.includes("\\0")
    || relativePath.includes("\\")
    || isAbsolute(relativePath)
  ) {
    return undefined
  }
  const segments = relativePath.split("/")
  return segments.length === 0
    || segments.some((segment) => !isSafeNoFollowRelativeSegment(segment))
    ? undefined
    : segments
}

function isSafeNoFollowRelativeSegment(segment: string): boolean {
  return segment.length > 0
    && segment !== "."
    && segment !== ".."
    && !segment.endsWith(".")
    && /^[A-Za-z0-9._@+-]+$/u.test(segment)
}
