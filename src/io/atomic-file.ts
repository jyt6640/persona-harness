import { randomUUID } from "node:crypto"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
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

export class PrivateFilePermissionError extends Error {
  constructor(
    readonly targetPath: string,
    readonly expectedMode: number,
    readonly actualMode: number,
  ) {
    super(
      `Persona Harness could not enforce private permissions on ${targetPath}: `
      + `expected ${modeText(expectedMode)}, observed ${modeText(actualMode)}.`,
    )
    this.name = "PrivateFilePermissionError"
  }
}

function atomicTempPath(targetPath: string): string {
  const dir = dirname(targetPath)
  const safeName = basename(targetPath).replace(/[^a-zA-Z0-9._-]/gu, "_")
  return join(dir, `.${safeName}.${randomUUID()}.tmp`)
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
  writeFileAtomicWithModes(targetPath, data, options)
}

export function writePrivateFileAtomic(
  targetPath: string,
  data: string,
  options: WriteFileAtomicOptions = {},
): void {
  writeFileAtomicWithModes(targetPath, data, options, 0o700, 0o600)
}

export function ensurePrivateDirectory(targetPath: string): void {
  mkdirSync(targetPath, { mode: 0o700, recursive: true })
  enforceMode(targetPath, 0o700)
}

export function supportsPosixFileModes(platform: NodeJS.Platform = process.platform): boolean {
  return platform !== "win32"
}

function writeFileAtomicWithModes(
  targetPath: string,
  data: string,
  options: WriteFileAtomicOptions,
  directoryMode?: number,
  fileMode?: number,
): void {
  const dir = dirname(targetPath)
  if (directoryMode === undefined) {
    mkdirSync(dir, { recursive: true })
  } else {
    ensurePrivateDirectory(dir)
  }
  const tempPath = atomicTempPath(targetPath)
  try {
    writeFileSync(tempPath, data, {
      encoding: options.encoding ?? "utf8",
      flag: "wx",
      ...(fileMode === undefined ? {} : { mode: fileMode }),
    })
    if (fileMode !== undefined) {
      enforceMode(tempPath, fileMode)
    }
    renameSync(tempPath, targetPath)
    if (fileMode !== undefined) {
      verifyMode(targetPath, fileMode)
    }
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

function enforceMode(targetPath: string, expectedMode: number): void {
  if (!supportsPosixFileModes()) {
    return
  }
  chmodSync(targetPath, expectedMode)
  verifyMode(targetPath, expectedMode)
}

function verifyMode(targetPath: string, expectedMode: number): void {
  if (!supportsPosixFileModes()) {
    return
  }
  const actualMode = statSync(targetPath).mode & 0o777
  if (actualMode !== expectedMode) {
    throw new PrivateFilePermissionError(targetPath, expectedMode, actualMode)
  }
}

function modeText(mode: number): string {
  return `0${mode.toString(8).padStart(3, "0")}`
}
