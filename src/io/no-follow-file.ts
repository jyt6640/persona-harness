import { createHash } from "node:crypto"
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  type BigIntStats,
} from "node:fs"

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
    if (!before.isFile()) return { code: "unsafe", kind: "blocked" }
    if (before.size > BigInt(maxBytes)) return { code: "limit", kind: "blocked" }

    const bytes = readFileSync(descriptor)
    const after = fstatSync(descriptor, { bigint: true })
    const current = lstatSync(path, { bigint: true })
    if (
      !after.isFile()
      || current.isSymbolicLink()
      || !current.isFile()
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

function errno(error: unknown): string | undefined {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && typeof error.code === "string"
    ? error.code
    : undefined
}
