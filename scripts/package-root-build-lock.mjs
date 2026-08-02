import { existsSync, lstatSync, mkdirSync, realpathSync, rmSync } from "node:fs"
import { isAbsolute, join, resolve } from "node:path"

export const PACKAGE_ROOT_BUILD_LOCK_NAME = ".persona-package-root-build.lock"

const BUILD_LOCK_TIMEOUT_MS = 120_000
const BUILD_LOCK_WAIT_MS = 25

export function withPackageRootBuildLock(root, operation) {
  if (typeof operation !== "function") throw new Error("package-root-build-lock")

  const canonicalRoot = canonicalDirectory(root)
  const lockPath = join(canonicalRoot, PACKAGE_ROOT_BUILD_LOCK_NAME)
  const deadline = Date.now() + BUILD_LOCK_TIMEOUT_MS

  while (true) {
    try {
      mkdirSync(lockPath, { mode: 0o700 })
      break
    } catch (error) {
      if (!isAlreadyExists(error)) throw new Error("package-root-build-lock")
      if (!hasSafeExistingLock(lockPath)) continue
      if (Date.now() >= deadline) throw new Error("package-root-build-lock-timeout")
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, BUILD_LOCK_WAIT_MS)
    }
  }

  try {
    return operation(canonicalRoot)
  } finally {
    releaseBuildLock(lockPath)
  }
}

function canonicalDirectory(root) {
  if (typeof root !== "string" || !isAbsolute(root)) throw new Error("package-root-build-lock")
  const candidate = resolve(root)
  const stat = lstatSync(candidate)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("package-root-build-lock")
  return realpathSync(candidate)
}

function hasSafeExistingLock(lockPath) {
  try {
    const stat = lstatSync(lockPath)
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("package-root-build-lock")
    return true
  } catch (error) {
    if (isMissing(error)) return false
    if (error instanceof Error && error.message === "package-root-build-lock") throw error
    throw new Error("package-root-build-lock")
  }
}

function releaseBuildLock(lockPath) {
  if (!existsSync(lockPath)) return
  const stat = lstatSync(lockPath)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("package-root-build-lock")
  rmSync(lockPath, { force: true, recursive: true })
}

function isAlreadyExists(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "EEXIST"
}

function isMissing(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT"
}
