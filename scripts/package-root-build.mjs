#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

const packageRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."))
const BUILD_LOCK_NAME = ".persona-package-root-build.lock"
const BUILD_LOCK_TIMEOUT_MS = 120_000
const BUILD_LOCK_WAIT_MS = 25

try {
  const cleanOnly = parseArgs(process.argv.slice(2))
  process.umask(0o022)
  withBuildLock(packageRoot, () => {
    assertPackageIdentity(packageRoot)
    removeDist(packageRoot)
    if (!cleanOnly) buildDist(packageRoot)
  })
} catch (error) {
  process.stderr.write(`${error instanceof Error && error.message.startsWith("package-root-build-") ? error.message : "package-root-build-failed"}\n`)
  process.exitCode = 1
}

function parseArgs(args) {
  if (args.length === 0) return false
  if (args.length === 1 && args[0] === "--clean") return true
  throw new Error("package-root-build-arguments")
}

function assertPackageIdentity(root) {
  const packagePath = join(root, "package.json")
  const lockPath = join(root, "package-lock.json")
  assertRegularFile(packagePath, "package-root-build-package")
  assertRegularFile(lockPath, "package-root-build-lock")
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"))
  const packageLock = JSON.parse(readFileSync(lockPath, "utf8"))
  const lockRoot = packageLock?.packages?.[""]
  if (
    typeof packageJson?.name !== "string"
    || typeof packageJson?.version !== "string"
    || lockRoot?.name !== packageJson.name
    || lockRoot?.version !== packageJson.version
  ) {
    throw new Error("package-root-build-identity")
  }
}

function removeDist(root) {
  rmSync(join(root, "dist"), { force: true, recursive: true })
}

function buildDist(root) {
  const tsc = join(root, "node_modules", "typescript", "bin", "tsc")
  assertRegularFile(tsc, "package-root-build-typescript")
  const result = spawnSync(process.execPath, [tsc, "-p", join(root, "tsconfig.build.json")], {
    cwd: root,
    env: buildEnvironment(),
    stdio: "inherit",
  })
  if (result.status !== 0) throw new Error("package-root-build-typescript")
  const cli = join(root, "dist", "cli", "index.js")
  assertRegularFile(cli, "package-root-build-cli")
  chmodSync(cli, 0o755)
}

function buildEnvironment() {
  return {
    HOME: process.env.HOME ?? "",
    LANG: "C",
    LC_ALL: "C",
    PATH: process.env.PATH ?? "",
    SOURCE_DATE_EPOCH: "0",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    TZ: "UTC",
  }
}

function withBuildLock(root, operation) {
  const lockPath = join(root, BUILD_LOCK_NAME)
  const deadline = Date.now() + BUILD_LOCK_TIMEOUT_MS
  while (true) {
    try {
      mkdirSync(lockPath, { mode: 0o700 })
      break
    } catch (error) {
      if (!(error instanceof Error) || !isAlreadyExists(error)) throw new Error("package-root-build-lock")
      const stat = lstatSync(lockPath)
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("package-root-build-lock")
      if (Date.now() >= deadline) throw new Error("package-root-build-lock-timeout")
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, BUILD_LOCK_WAIT_MS)
    }
  }
  try {
    operation()
  } finally {
    if (existsSync(lockPath)) {
      const stat = lstatSync(lockPath)
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error("package-root-build-lock")
      rmSync(lockPath, { force: true, recursive: true })
    }
  }
}

function isAlreadyExists(error) {
  return "code" in error && error.code === "EEXIST"
}

function assertRegularFile(path, code) {
  if (!existsSync(path)) throw new Error(code)
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(code)
}
