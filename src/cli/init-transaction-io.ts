import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmdirSync,
  writeSync,
} from "node:fs"
import { dirname, join, relative, resolve } from "node:path"

import { writeFileAtomic } from "../io/atomic-file.js"

export type FileIdentity = {
  readonly dev: number
  readonly ino: number
  readonly mtimeMs: number
  readonly size: number
}

export type ParentSnapshot = {
  readonly path: string
  readonly identity: FileIdentity | null
}

export type FileSnapshot = {
  readonly path: string
  readonly relativePath: string
  readonly bytes: Buffer | null
  readonly identity: FileIdentity | null
  readonly parents: readonly ParentSnapshot[]
}

export type WrittenFile = {
  readonly snapshot: FileSnapshot
  readonly nextBytes: Buffer
  readonly identity: FileIdentity
}

export class InitTransactionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "InitTransactionError"
  }
}

export function safeProjectPath(projectDir: string, relativePath: string): string {
  const root = resolve(projectDir)
  const target = resolve(root, relativePath)
  const escaped = relative(root, target)
  if (escaped === ".." || escaped.startsWith("../") || escaped.startsWith("/")) {
    throw new InitTransactionError(`Init target escapes the project root: ${relativePath}`)
  }
  let current = root
  for (const segment of relativePath.split("/")) {
    current = join(current, segment)
    if (!existsSync(current)) {
      break
    }
    const stat = lstatSync(current)
    if (stat.isSymbolicLink()) {
      throw new InitTransactionError(`Init target contains a symbolic link: ${relativePath}`)
    }
    if (current !== target && !stat.isDirectory()) {
      throw new InitTransactionError(`Init target parent is not a directory: ${relativePath}`)
    }
  }
  return target
}

export function identity(path: string): FileIdentity {
  const stat = lstatSync(path)
  return {
    dev: stat.dev,
    ino: stat.ino,
    mtimeMs: stat.mtimeMs,
    size: stat.size,
  }
}

export function sameIdentity(left: FileIdentity | null, right: FileIdentity | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  return (
    left.dev === right.dev
    && left.ino === right.ino
    && left.mtimeMs === right.mtimeMs
    && left.size === right.size
  )
}

function sameDirectoryIdentity(left: FileIdentity | null, right: FileIdentity | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  return left.dev === right.dev && left.ino === right.ino
}

function parentSnapshots(projectDir: string, relativePath: string): readonly ParentSnapshot[] {
  const root = resolve(projectDir)
  const segments = relativePath.split("/")
  const parents: ParentSnapshot[] = []
  let current = root
  for (const segment of segments.slice(0, -1)) {
    current = join(current, segment)
    if (!existsSync(current)) {
      parents.push({ path: current, identity: null })
      continue
    }
    const stat = lstatSync(current)
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new InitTransactionError(`Init target parent is unsafe: ${relativePath}`)
    }
    parents.push({ path: current, identity: identity(current) })
  }
  return parents
}

export function readSnapshot(projectDir: string, relativePath: string): FileSnapshot {
  const path = safeProjectPath(projectDir, relativePath)
  if (!existsSync(path)) {
    return { path, relativePath, bytes: null, identity: null, parents: parentSnapshots(projectDir, relativePath) }
  }
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new InitTransactionError(`Init target is not a regular file: ${relativePath}`)
  }
  return {
    path,
    relativePath,
    bytes: readFileSync(path),
    identity: identity(path),
    parents: parentSnapshots(projectDir, relativePath),
  }
}

export function sameSnapshot(expected: FileSnapshot, createdDirs: Set<string> = new Set()): boolean {
  for (const parent of expected.parents) {
    if (!existsSync(parent.path)) {
      if (parent.identity !== null) {
        return false
      }
      continue
    }
    if (parent.identity === null && createdDirs.has(parent.path)) {
      continue
    }
    const stat = lstatSync(parent.path)
    if (
      stat.isSymbolicLink()
      || !stat.isDirectory()
      || !sameDirectoryIdentity(identity(parent.path), parent.identity)
    ) {
      return false
    }
  }
  if (!existsSync(expected.path)) {
    return expected.bytes === null
  }
  const stat = lstatSync(expected.path)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    return false
  }
  if (!sameIdentity(identity(expected.path), expected.identity)) {
    return false
  }
  return expected.bytes !== null && readFileSync(expected.path).equals(expected.bytes)
}

export function ensureParents(projectDir: string, relativePath: string, createdDirs: Set<string>): void {
  const root = resolve(projectDir)
  const parent = dirname(relativePath).replace(/\\/g, "/")
  if (parent === ".") {
    return
  }
  let current = root
  for (const segment of parent.split("/")) {
    current = join(current, segment)
    if (existsSync(current)) {
      const stat = lstatSync(current)
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new InitTransactionError(`Init target parent is unsafe: ${relativePath}`)
      }
      continue
    }
    try {
      mkdirSync(current)
      createdDirs.add(current)
    } catch (error) {
      if (!(error instanceof Error) || !existsSync(current)) {
        throw error
      }
      const stat = lstatSync(current)
      if (stat.isSymbolicLink() || !stat.isDirectory()) {
        throw new InitTransactionError(`Init target parent changed during commit: ${relativePath}`)
      }
    }
  }
}

export function removeEmptyParents(path: string, projectDir: string): void {
  const root = resolve(projectDir)
  let current = dirname(path)
  while (current !== root && current.startsWith(`${root}/`)) {
    try {
      rmdirSync(current)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      return
    }
    current = dirname(current)
  }
}

export function writeNewFile(path: string, bytes: Buffer): void {
  const descriptor = openSync(path, "wx", 0o644)
  try {
    writeSync(descriptor, bytes)
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

export function writeTarget(
  snapshot: FileSnapshot,
  nextBytes: Buffer,
  projectDir: string,
  createdDirs: Set<string>,
): FileIdentity {
  safeProjectPath(projectDir, snapshot.relativePath)
  if (!sameSnapshot(snapshot, createdDirs)) {
    throw new InitTransactionError(`Init target changed before commit: ${snapshot.relativePath}`)
  }
  ensureParents(projectDir, snapshot.relativePath, createdDirs)
  if (snapshot.bytes === null) {
    writeNewFile(snapshot.path, nextBytes)
  } else {
    writeFileAtomic(snapshot.path, nextBytes.toString("utf8"))
  }
  const after = readSnapshot(projectDir, snapshot.relativePath)
  if (after.bytes === null || !after.bytes.equals(nextBytes) || after.identity === null) {
    throw new InitTransactionError(`Init target could not be verified after commit: ${snapshot.relativePath}`)
  }
  return after.identity
}
