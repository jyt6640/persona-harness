import { createHash } from "node:crypto"
import { closeSync, openSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

const LOCK_WAIT_MS = 25
const LOCK_TIMEOUT_MS = 120_000

function lockPath(): string {
  const projectDigest = createHash("sha256").update(process.cwd()).digest("hex").slice(0, 16)
  return join(tmpdir(), `persona-harness-pack-${projectDigest}.lock`)
}

function isAlreadyLocked(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error["code"] === "EEXIST"
}

function waitForLock(): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_WAIT_MS)
}

export function withPackagePackLock<T>(operation: () => T): T {
  const path = lockPath()
  const deadline = Date.now() + LOCK_TIMEOUT_MS
  let descriptor: number | undefined
  while (descriptor === undefined) {
    try {
      descriptor = openSync(path, "wx", 0o600)
    } catch (error) {
      if (!isAlreadyLocked(error) || Date.now() >= deadline) {
        throw new Error("package-pack-lock-unavailable")
      }
      waitForLock()
    }
  }

  try {
    return operation()
  } finally {
    closeSync(descriptor)
    rmSync(path, { force: true })
  }
}
