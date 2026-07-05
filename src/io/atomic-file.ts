import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join } from "node:path"
import process from "node:process"

export type WriteFileAtomicOptions = {
  readonly encoding?: BufferEncoding
}

export type FileChangeToken = {
  readonly mtimeMs: number
  readonly size: number
}

export type TextFileSnapshot = {
  readonly path: string
  readonly text: string
  readonly token: FileChangeToken
}

export class AtomicWriteConflictError extends Error {
  constructor(readonly targetPath: string) {
    super(`Workflow state changed while Persona Harness was updating ${targetPath}. Refusing to overwrite concurrent changes.`)
    this.name = "AtomicWriteConflictError"
  }
}

function atomicTempPath(targetPath: string): string {
  const dir = dirname(targetPath)
  const safeName = basename(targetPath).replace(/[^a-zA-Z0-9._-]/gu, "_")
  return join(dir, `.${safeName}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`)
}

function changeToken(targetPath: string): FileChangeToken | null {
  if (!existsSync(targetPath)) {
    return null
  }
  const stat = statSync(targetPath)
  return stat.isFile() ? { mtimeMs: stat.mtimeMs, size: stat.size } : null
}

function sameToken(left: FileChangeToken | null, right: FileChangeToken | null): boolean {
  if (left === null || right === null) {
    return left === right
  }
  return left.mtimeMs === right.mtimeMs && left.size === right.size
}

export function writeFileAtomic(targetPath: string, data: string, options: WriteFileAtomicOptions = {}): void {
  const dir = dirname(targetPath)
  mkdirSync(dir, { recursive: true })
  const tempPath = atomicTempPath(targetPath)
  try {
    writeFileSync(tempPath, data, options.encoding ?? "utf8")
    renameSync(tempPath, targetPath)
  } finally {
    if (existsSync(tempPath)) {
      rmSync(tempPath, { force: true })
    }
  }
}

export function readTextFileSnapshot(targetPath: string, options: WriteFileAtomicOptions = {}): TextFileSnapshot {
  const text = readFileSync(targetPath, options.encoding ?? "utf8")
  const token = changeToken(targetPath)
  if (token === null) {
    throw new AtomicWriteConflictError(targetPath)
  }
  return { path: targetPath, text, token }
}

export function writeFileAtomicIfUnchanged(
  snapshot: TextFileSnapshot,
  data: string,
  options: WriteFileAtomicOptions = {},
): void {
  if (!sameToken(changeToken(snapshot.path), snapshot.token)) {
    throw new AtomicWriteConflictError(snapshot.path)
  }
  writeFileAtomic(snapshot.path, data, options)
}

export function writeFileAtomicIfTokenUnchanged(
  targetPath: string,
  expectedToken: FileChangeToken | null,
  data: string,
  options: WriteFileAtomicOptions = {},
): FileChangeToken {
  if (!sameToken(changeToken(targetPath), expectedToken)) {
    throw new AtomicWriteConflictError(targetPath)
  }
  writeFileAtomic(targetPath, data, options)
  const nextToken = changeToken(targetPath)
  if (nextToken === null) {
    throw new AtomicWriteConflictError(targetPath)
  }
  return nextToken
}

export function fileChangeToken(targetPath: string): FileChangeToken | null {
  return changeToken(targetPath)
}
