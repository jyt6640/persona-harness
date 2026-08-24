import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
} from "node:fs"
import { isAbsolute, join, parse, relative, resolve, sep } from "node:path"
import process from "node:process"

import {
  captureNoFollowDirectory,
  noFollowPathIdentityFromStat,
  sameNoFollowPathIdentity,
  sameNoFollowPathLocation,
  type NoFollowPathIdentity,
} from "./no-follow-file.js"

type DirectoryReservation = Readonly<{
  readonly descriptor: number
  readonly identity: NoFollowPathIdentity
  readonly path: string
}>

class NoFollowDirectoryChainError extends Error {
  constructor() {
    super("directory chain is unsafe")
    this.name = "NoFollowDirectoryChainError"
  }
}

export function withNoFollowDirectoryChain<T>(
  requestedPath: string,
  mode: number,
  operation: () => T,
): T | undefined {
  let current: DirectoryReservation | undefined
  let previous: DirectoryReservation | undefined
  try {
    const absolutePath = absoluteDirectoryPath(requestedPath)
    previous = reserveCurrentDirectory()
    process.chdir(parse(absolutePath).root)
    current = reserveCurrentDirectory()

    for (const segment of childSegments(absolutePath)) {
      const parent = current
      current = reserveOrCreateCurrentChildDirectory(parent, segment, mode)
      closeSync(parent.descriptor)
    }
    assertCurrentDirectory(current)
    return operation()
  } catch {
    return undefined
  } finally {
    if (current !== undefined) closeReservedDirectory(current)
    if (previous !== undefined) {
      restoreCurrentDirectory(previous)
      closeReservedDirectory(previous)
    }
  }
}

function absoluteDirectoryPath(path: string): string {
  if (!isAbsolute(path) || path.includes("\0")) throw new NoFollowDirectoryChainError()
  return resolve(path)
}

function childSegments(absolutePath: string): readonly string[] {
  const root = parse(absolutePath).root
  const childPath = relative(root, absolutePath)
  if (childPath.length === 0) return []
  const segments = childPath.split(sep)
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) {
    throw new NoFollowDirectoryChainError()
  }
  return segments
}

function reserveCurrentDirectory(): DirectoryReservation {
  const path = process.cwd()
  const current = captureNoFollowDirectory(path)
  if (current.kind !== "ready") throw new NoFollowDirectoryChainError()
  let descriptor: number | undefined
  try {
    descriptor = openNoFollowDirectory(".")
    const identity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    if (!sameNoFollowPathLocation(current.value, identity)) throw new NoFollowDirectoryChainError()
    const reservation = { descriptor, identity, path }
    descriptor = undefined
    return reservation
  } finally {
    if (descriptor !== undefined) closeReservedDescriptor(descriptor)
  }
}

function reserveOrCreateCurrentChildDirectory(
  parent: DirectoryReservation,
  name: string,
  mode: number,
): DirectoryReservation {
  assertCurrentDirectory(parent)
  try {
    mkdirSync(name, { mode })
  } catch (error) {
    if (errorCode(error) !== "EEXIST") throw new NoFollowDirectoryChainError()
  }

  let descriptor: number | undefined
  try {
    const beforeStat = lstatSync(name, { bigint: true })
    if (!beforeStat.isDirectory() || beforeStat.isSymbolicLink()) throw new NoFollowDirectoryChainError()
    const before = noFollowPathIdentityFromStat(beforeStat)
    descriptor = openNoFollowDirectory(name)
    const descriptorIdentity = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    const after = noFollowPathIdentityFromStat(lstatSync(name, { bigint: true }))
    if (!sameNoFollowPathIdentity(before, after) || !sameNoFollowPathLocation(after, descriptorIdentity)) {
      throw new NoFollowDirectoryChainError()
    }
    const reservation = { descriptor, identity: after, path: join(parent.path, name) }
    process.chdir(name)
    assertCurrentDirectory(reservation)
    descriptor = undefined
    return reservation
  } finally {
    if (descriptor !== undefined) closeReservedDescriptor(descriptor)
  }
}

function assertCurrentDirectory(reservation: DirectoryReservation): void {
  let descriptor: number | undefined
  try {
    descriptor = openNoFollowDirectory(".")
    const current = noFollowPathIdentityFromStat(fstatSync(descriptor, { bigint: true }))
    if (!sameNoFollowPathLocation(reservation.identity, current)) throw new NoFollowDirectoryChainError()
  } finally {
    if (descriptor !== undefined) closeReservedDescriptor(descriptor)
  }
}

function openNoFollowDirectory(path: string): number {
  const flags = process.platform === "win32"
    ? constants.O_RDONLY
    : constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  const descriptor = openSync(path, flags)
  try {
    if (!fstatSync(descriptor, { bigint: true }).isDirectory()) throw new NoFollowDirectoryChainError()
    return descriptor
  } catch (error) {
    closeReservedDescriptor(descriptor)
    throw error
  }
}

function restoreCurrentDirectory(previous: DirectoryReservation): void {
  try {
    const current = captureNoFollowDirectory(previous.path)
    if (current.kind === "ready" && sameNoFollowPathLocation(current.value, previous.identity)) {
      process.chdir(previous.path)
      assertCurrentDirectory(previous)
      return
    }
  } catch {
    // The fallback keeps a failed reservation from retaining an attacker-controlled cwd.
  }
  try {
    process.chdir(parse(previous.path).root)
  } catch {
    // No further filesystem work occurs after a failed restoration.
  }
}

function closeReservedDirectory(reservation: DirectoryReservation): void {
  closeReservedDescriptor(reservation.descriptor)
}

function closeReservedDescriptor(descriptor: number): void {
  try {
    closeSync(descriptor)
  } catch {
    // Descriptor cleanup is best effort at this fail-closed filesystem boundary.
  }
}

function errorCode(error: unknown): string | undefined {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && typeof error.code === "string"
    ? error.code
    : undefined
}
