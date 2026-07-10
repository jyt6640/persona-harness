import { randomUUID } from "node:crypto"
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export type GoCommandLock = {
  readonly path: string
  readonly token: string
}

type LockOwner = {
  readonly pid: number
  readonly token: string
}

function errorCode(error: unknown): string | undefined {
  return error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined
}

function readLockOwner(path: string): LockOwner | undefined {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (
    typeof value !== "object"
    || value === null
    || !("pid" in value)
    || typeof value.pid !== "number"
    || !("token" in value)
    || typeof value.token !== "string"
  ) {
    return undefined
  }
  return { pid: value.pid, token: value.token }
}

function processIsRunning(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    if (!(error instanceof Error)) {
      throw error
    }
    return errorCode(error) !== "ESRCH"
  }
}

function removeStaleLock(path: string): boolean {
  try {
    const owner = readLockOwner(path)
    if (owner === undefined || processIsRunning(owner.pid)) {
      return false
    }
    unlinkSync(path)
    return true
  } catch (error) {
    if (error instanceof Error) {
      return false
    }
    throw error
  }
}

export function acquireGoCommandLock(projectDir: string): GoCommandLock | undefined {
  const path = join(projectDir, ".persona", "go.lock")
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const token = randomUUID()
    try {
      const descriptor = openSync(path, "wx")
      try {
        writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, token })}\n`)
      } finally {
        closeSync(descriptor)
      }
      return { path, token }
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      if (errorCode(error) !== "EEXIST" || !removeStaleLock(path)) {
        return undefined
      }
    }
  }
  return undefined
}

export function releaseGoCommandLock(lock: GoCommandLock): void {
  try {
    const owner = readLockOwner(lock.path)
    if (owner?.token === lock.token) {
      unlinkSync(lock.path)
    }
  } catch (error) {
    if (error instanceof Error) {
      return
    }
    throw error
  }
}
