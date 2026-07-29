#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import {
  CleanPackageBoundaryError,
  assertBundleHeadBinding,
  assertPackRecordBinding,
  assertSourcePackageIdentity,
  parseBundleHeads,
} from "./clean-package-boundary-core.mjs"

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-clean-package-boundary-"))

try {
  if (process.argv.length !== 2) throw new CleanPackageBoundaryError("clean-package-arguments")
  const sourceIdentity = readSourcePackageIdentity(repositoryRoot)
  const base = gitText(repositoryRoot, ["rev-parse", "refs/remotes/origin/main"])
  const head = gitText(repositoryRoot, ["rev-parse", "HEAD"])
  requireSuccess(run("git", ["merge-base", "--is-ancestor", base, head], repositoryRoot), "clean-package-ancestry")

  const bundlePath = join(temporaryRoot, "candidate.bundle")
  requireSuccess(
    run("git", ["bundle", "create", bundlePath, "HEAD", "refs/remotes/origin/main"], repositoryRoot),
    "clean-package-bundle-create",
  )
  assertBundleHeadBinding(parseBundleHeads(gitText(repositoryRoot, ["bundle", "list-heads", bundlePath])), { base, head })

  const checkout = join(temporaryRoot, "checkout")
  requireSuccess(run("git", ["clone", bundlePath, checkout], repositoryRoot), "clean-package-bundle-clone")
  if (gitText(checkout, ["rev-parse", "HEAD"]) !== head) {
    throw new CleanPackageBoundaryError("clean-package-checkout-head")
  }
  const checkoutIdentity = readSourcePackageIdentity(checkout)
  if (checkoutIdentity.name !== sourceIdentity.name || checkoutIdentity.version !== sourceIdentity.version) {
    throw new CleanPackageBoundaryError("clean-package-checkout-version")
  }

  const npmCache = join(temporaryRoot, "npm-cache")
  requireSuccess(
    run("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", npmCache], checkout),
    "clean-package-install",
  )
  const sourceCli = join(checkout, "dist", "cli", "index.js")
  if (existsSync(sourceCli)) throw new CleanPackageBoundaryError("clean-package-prepack-dist")

  const packDirectory = join(temporaryRoot, "pack")
  mkdirSync(packDirectory)
  const packed = run("npm", ["pack", "--json", "--pack-destination", packDirectory], checkout)
  requireSuccess(packed, "clean-package-pack")
  const resolved = resolvePackResult(packed.stdout, packDirectory, sourceIdentity)
  const builtCli = join(checkout, "dist", "cli", "index.js")
  assertCliVersion(checkout, builtCli, sourceIdentity.version, "clean-package-built-cli")

  const consumer = join(temporaryRoot, "consumer")
  mkdirSync(consumer)
  writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ private: true }, null, 2)}\n`)
  requireSuccess(
    run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--cache", npmCache, resolved.tarballPath], consumer),
    "clean-package-consumer-install",
  )
  const installedPackage = join(consumer, "node_modules", sourceIdentity.name)
  const installedIdentity = readPackageJsonIdentity(installedPackage)
  if (installedIdentity.name !== sourceIdentity.name || installedIdentity.version !== sourceIdentity.version) {
    throw new CleanPackageBoundaryError("clean-package-installed-version")
  }
  if (existsSync(join(installedPackage, "src")) || existsSync(join(installedPackage, ".git"))) {
    throw new CleanPackageBoundaryError("clean-package-source-fallback")
  }
  assertCliVersion(consumer, join(installedPackage, "dist", "cli", "index.js"), sourceIdentity.version, "clean-package-installed-cli")

  process.stdout.write(`${JSON.stringify({
    base,
    head,
    package: {
      fileCount: resolved.facts.fileCount,
      name: sourceIdentity.name,
      pathSetSha256: resolved.facts.pathSetSha256,
      tarballSha256: resolved.facts.tarballSha256,
      version: sourceIdentity.version,
    },
    schemaVersion: "clean-package-boundary.1",
  })}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof CleanPackageBoundaryError ? error.code : "clean-package-boundary-failed"}\n`)
  process.exitCode = 1
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function readSourcePackageIdentity(root) {
  return assertSourcePackageIdentity(
    JSON.parse(readFileSync(join(root, "package.json"), "utf8")),
    JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8")),
  )
}

function readPackageJsonIdentity(root) {
  const value = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
  if (typeof value?.name !== "string" || typeof value?.version !== "string") {
    throw new CleanPackageBoundaryError("clean-package-installed-package-json")
  }
  return { name: value.name, version: value.version }
}

function resolvePackResult(output, packDirectory, identity) {
  let parsed
  try {
    parsed = JSON.parse(output)
  } catch {
    throw new CleanPackageBoundaryError("clean-package-pack-json")
  }
  if (!Array.isArray(parsed) || parsed.length !== 1 || !isRecord(parsed[0])) {
    throw new CleanPackageBoundaryError("clean-package-pack-json")
  }
  const record = parsed[0]
  assertPackRecordBinding(record, identity)
  if (!Array.isArray(record.files)) throw new CleanPackageBoundaryError("clean-package-pack-files")
  const paths = record.files.map((file) => {
    if (!isRecord(file) || typeof file.path !== "string" || file.path.length === 0 || file.path.startsWith("/") || file.path.includes("..")) {
      throw new CleanPackageBoundaryError("clean-package-pack-files")
    }
    return file.path
  }).sort()
  if (new Set(paths).size !== paths.length || paths.some((path) => path === ".git" || path.startsWith(".git/") || path === "src" || path.startsWith("src/") || path === "tests" || path.startsWith("tests/"))) {
    throw new CleanPackageBoundaryError("clean-package-pack-files")
  }
  const filename = record.filename
  if (typeof filename !== "string") throw new CleanPackageBoundaryError("clean-package-pack-filename")
  const tarballPath = isAbsolute(filename) ? filename : join(packDirectory, basename(filename))
  const relativePath = relative(packDirectory, tarballPath)
  if (relativePath === "" || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath) || !existsSync(tarballPath)) {
    throw new CleanPackageBoundaryError("clean-package-pack-path")
  }
  return {
    facts: {
      fileCount: paths.length,
      pathSetSha256: sha256(Buffer.from(`${paths.join("\n")}\n`, "utf8")),
      tarballSha256: sha256(readFileSync(tarballPath)),
    },
    tarballPath,
  }
}

function assertCliVersion(cwd, cliPath, expectedVersion, code) {
  if (!existsSync(cliPath)) throw new CleanPackageBoundaryError(`${code}-missing`)
  const result = run(process.execPath, [cliPath, "--version"], cwd)
  if (result.status !== 0) throw new CleanPackageBoundaryError(`${code}-status`)
  if (result.stdout.trim() !== expectedVersion) throw new CleanPackageBoundaryError(`${code}-version`)
  if (result.stderr !== "") throw new CleanPackageBoundaryError(`${code}-stderr`)
}

function gitText(cwd, args) {
  const result = run("git", args, cwd)
  requireSuccess(result, "clean-package-git")
  const value = result.stdout.trim()
  if (value === "") throw new CleanPackageBoundaryError("clean-package-git")
  return value
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, npm_config_audit: "false", npm_config_fund: "false" },
    maxBuffer: 16 * 1024 * 1024,
  })
  return {
    status: result.status,
    stderr: result.stderr ?? "",
    stdout: result.stdout ?? "",
  }
}

function requireSuccess(result, code) {
  if (result.status !== 0) throw new CleanPackageBoundaryError(code)
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
