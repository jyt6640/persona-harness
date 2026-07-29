#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
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
  assertCheckoutPackageBinding,
  assertNpmExecutionPolicy,
  assertPackRecordBinding,
  assertSourcePackageIdentity,
  parseBundleHeads,
} from "./clean-package-boundary-core.mjs"

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-clean-package-boundary-"))

try {
  const input = parseInput(process.argv.slice(2))
  const bundle = input.mode === "source"
    ? createSourceBundle(sourceRoot)
    : verifySuppliedBundle(input)
  const checkout = materializeCheckout(bundle, bundle.head, "target")
  const source = readSourceIdentity(checkout)
  const npm = createNpmEnvironment(temporaryRoot, "target")

  assertCheckoutIntegrity(checkout, source, npm)
  requireSuccess(runNpm(["ci", "--ignore-scripts", "--no-audit", "--no-fund"], checkout, npm), "clean-package-install")
  if (existsSync(join(checkout, "dist"))) throw new CleanPackageBoundaryError("clean-package-prepack-dist")

  assertCheckoutIntegrity(checkout, source, npm)
  const packed = packCheckout(checkout, source, npm, "target")
  assertCheckoutIntegrity(checkout, source, npm)
  assertCliVersion(checkout, join(checkout, "dist", "cli", "index.js"), source.identity.version, npm, "clean-package-built-cli")

  const consumer = installFreshTarball(packed.tarballPath, source.identity, npm)
  const baseCheckout = materializeCheckout(bundle, bundle.base, "base")
  const baseSource = readSourceIdentity(baseCheckout)
  const baseNpm = createNpmEnvironment(temporaryRoot, "base")
  assertCheckoutIntegrity(baseCheckout, baseSource, baseNpm)
  requireSuccess(runNpm(["ci", "--ignore-scripts", "--no-audit", "--no-fund"], baseCheckout, baseNpm), "clean-package-base-install")
  if (existsSync(join(baseCheckout, "dist"))) throw new CleanPackageBoundaryError("clean-package-base-prepack-dist")
  assertCheckoutIntegrity(baseCheckout, baseSource, baseNpm)
  const basePacked = packCheckout(baseCheckout, baseSource, baseNpm, "base")
  assertCheckoutIntegrity(baseCheckout, baseSource, baseNpm)
  process.stdout.write(`${JSON.stringify({
    base: bundle.base,
    basePackage: {
      fileCount: basePacked.facts.fileCount,
      name: baseSource.identity.name,
      pathSetSha256: basePacked.facts.pathSetSha256,
      tarballSha256: basePacked.facts.tarballSha256,
      version: baseSource.identity.version,
    },
    head: bundle.head,
    package: {
      fileCount: packed.facts.fileCount,
      name: source.identity.name,
      pathSetSha256: packed.facts.pathSetSha256,
      tarballSha256: packed.facts.tarballSha256,
      version: source.identity.version,
    },
    packageRoot: {
      checkoutCwd: checkout,
      gitRoot: realpathSync(gitText(checkout, ["rev-parse", "--show-toplevel"])),
      lockSha256: source.lockSha256,
      npmPrefix: npmPrefix(checkout, npm),
      packageSha256: source.packageSha256,
    },
    schemaVersion: "clean-package-boundary.2",
    source: input.mode,
    installedPackage: {
      cliVersion: consumer.cliVersion,
      sourceFallback: false,
      version: consumer.version,
    },
  })}\n`)
} catch (error) {
  process.stderr.write(`${error instanceof CleanPackageBoundaryError ? error.code : "clean-package-boundary-failed"}\n`)
  process.exitCode = 1
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function parseInput(args) {
  if (args.length === 0) return { mode: "source" }
  if (args.length !== 6 || args[0] !== "--bundle" || args[2] !== "--head" || args[4] !== "--base") {
    throw new CleanPackageBoundaryError("clean-package-arguments")
  }
  if (!isSha(args[3]) || !isSha(args[5])) throw new CleanPackageBoundaryError("clean-package-arguments")
  return {
    base: args[5],
    bundlePath: args[1],
    head: args[3],
    mode: "bundle",
  }
}

function createSourceBundle(root) {
  assertDirectory(root, "clean-package-source-root")
  assertCleanGit(root)
  const base = gitText(root, ["rev-parse", "refs/remotes/origin/main"])
  const head = gitText(root, ["rev-parse", "HEAD"])
  requireSuccess(run("git", ["merge-base", "--is-ancestor", base, head], root), "clean-package-ancestry")
  const bundlePath = join(temporaryRoot, "candidate.bundle")
  requireSuccess(run("git", ["bundle", "create", bundlePath, "HEAD", "refs/remotes/origin/main"], root), "clean-package-bundle-create")
  return verifyBundle(bundlePath, { base, head })
}

function verifySuppliedBundle(input) {
  if (typeof input.bundlePath !== "string" || typeof input.base !== "string" || typeof input.head !== "string") {
    throw new CleanPackageBoundaryError("clean-package-arguments")
  }
  const bundlePath = realpathSync(input.bundlePath)
  assertRegularFile(bundlePath, "clean-package-bundle-file")
  return verifyBundle(bundlePath, { base: input.base, head: input.head })
}

function verifyBundle(bundlePath, expected) {
  const bare = join(temporaryRoot, "bundle-verify.git")
  requireSuccess(run("git", ["init", "--bare", bare], temporaryRoot), "clean-package-bundle-verify")
  requireSuccess(run("git", ["bundle", "verify", bundlePath], bare), "clean-package-bundle-verify")
  const heads = parseBundleHeads(gitText(bare, ["bundle", "list-heads", bundlePath]))
  const binding = assertBundleHeadBinding(heads, expected)
  return { ...binding, bundlePath }
}

function materializeCheckout(bundle, revision, label) {
  const checkout = join(temporaryRoot, `checkout-${label}`)
  requireSuccess(run("git", ["clone", "--no-local", "--no-checkout", bundle.bundlePath, checkout], temporaryRoot), "clean-package-bundle-clone")
  requireSuccess(run("git", ["checkout", "--detach", revision], checkout), "clean-package-checkout-head")
  assertDirectory(checkout, "clean-package-checkout-root")
  if (gitText(checkout, ["rev-parse", "HEAD"]) !== revision) throw new CleanPackageBoundaryError("clean-package-checkout-head")
  assertCleanGit(checkout)
  return realpathSync(checkout)
}

function readSourceIdentity(root) {
  const packageBytes = readFileSync(join(root, "package.json"))
  const lockBytes = readFileSync(join(root, "package-lock.json"))
  const headPackageBytes = gitBytes(root, "package.json")
  const headLockBytes = gitBytes(root, "package-lock.json")
  const identity = assertSourcePackageIdentity(
    JSON.parse(packageBytes.toString("utf8")),
    JSON.parse(lockBytes.toString("utf8")),
  )
  return {
    headLockSha256: sha256(headLockBytes),
    headPackageSha256: sha256(headPackageBytes),
    identity,
    lockSha256: sha256(lockBytes),
    packageSha256: sha256(packageBytes),
  }
}

function assertCheckoutIntegrity(root, source, npm) {
  assertCleanGit(root)
  const gitRoot = realpathSync(gitText(root, ["rev-parse", "--show-toplevel"]))
  const prefix = npmPrefix(root, npm)
  assertCheckoutPackageBinding({
    gitRoot,
    headLockSha256: source.headLockSha256,
    headPackageSha256: source.headPackageSha256,
    lockSha256: sha256(readFileSync(join(root, "package-lock.json"))),
    npmPrefix: prefix,
    packageSha256: sha256(readFileSync(join(root, "package.json"))),
    root,
  })
  assertNpmExecutionPolicy({
    global: npmText(["config", "get", "global"], root, npm),
    ignoreScripts: npmText(["config", "get", "ignore-scripts"], root, npm),
    workspaces: npmText(["config", "get", "workspaces"], root, npm),
  })
}

function packCheckout(root, source, npm, label) {
  const packDirectory = join(temporaryRoot, `pack-${label}`)
  mkdirSync(packDirectory)
  const packed = runNpm(["pack", "--json", "--pack-destination", packDirectory], root, npm)
  requireSuccess(packed, "clean-package-pack")
  return resolvePackResult(packed.stdout, packDirectory, source.identity)
}

function installFreshTarball(tarballPath, identity, npm) {
  const consumer = join(temporaryRoot, "consumer")
  mkdirSync(consumer)
  writeFileSync(join(consumer, "package.json"), `${JSON.stringify({ private: true }, null, 2)}\n`)
  requireSuccess(
    runNpm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath], consumer, npm),
    "clean-package-consumer-install",
  )
  const installed = join(consumer, "node_modules", identity.name)
  assertDirectory(installed, "clean-package-installed-package")
  const installedIdentity = JSON.parse(readFileSync(join(installed, "package.json"), "utf8"))
  if (installedIdentity?.name !== identity.name || installedIdentity?.version !== identity.version) {
    throw new CleanPackageBoundaryError("clean-package-installed-version")
  }
  if (existsSync(join(installed, "src")) || existsSync(join(installed, ".git"))) {
    throw new CleanPackageBoundaryError("clean-package-source-fallback")
  }
  const cliVersion = assertCliVersion(consumer, join(installed, "dist", "cli", "index.js"), identity.version, npm, "clean-package-installed-cli")
  return { cliVersion, version: installedIdentity.version }
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

function createNpmEnvironment(root, label) {
  const home = join(root, `npm-home-${label}`)
  const cache = join(root, `npm-cache-${label}`)
  const userConfig = join(root, `npm-userconfig-${label}`)
  const globalConfig = join(root, `npm-globalconfig-${label}`)
  mkdirSync(home)
  mkdirSync(cache)
  writeFileSync(userConfig, "")
  writeFileSync(globalConfig, "")
  return {
    HOME: home,
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_CACHE: cache,
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_IGNORE_SCRIPTS: "false",
    NPM_CONFIG_INCLUDE_WORKSPACE_ROOT: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_USERCONFIG: userConfig,
    NPM_CONFIG_WORKSPACES: "false",
    PATH: process.env.PATH ?? "",
    TMPDIR: root,
    USER: "persona",
  }
}

function npmPrefix(root, npm) {
  const prefix = npmText(["prefix"], root, npm)
  return realpathSync(prefix)
}

function npmText(args, cwd, npm) {
  const result = runNpm(args, cwd, npm)
  requireSuccess(result, "clean-package-npm-config")
  const text = result.stdout.trim()
  if (text === "") throw new CleanPackageBoundaryError("clean-package-npm-config")
  return text
}

function runNpm(args, cwd, npm) {
  return run("npm", ["--prefix", cwd, ...args], cwd, npm)
}

function assertCliVersion(cwd, cliPath, expectedVersion, npm, code) {
  if (!existsSync(cliPath)) throw new CleanPackageBoundaryError(`${code}-missing`)
  const result = run(process.execPath, [cliPath, "--version"], cwd, npm)
  if (result.status !== 0) throw new CleanPackageBoundaryError(`${code}-status`)
  if (result.stdout.trim() !== expectedVersion) throw new CleanPackageBoundaryError(`${code}-version`)
  if (result.stderr !== "") throw new CleanPackageBoundaryError(`${code}-stderr`)
  return result.stdout.trim()
}

function assertCleanGit(root) {
  if (gitText(root, ["status", "--porcelain", "--untracked-files=all"]) !== "") {
    throw new CleanPackageBoundaryError("clean-package-checkout-dirty")
  }
}

function assertDirectory(path, code) {
  const stat = lstatSync(path)
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new CleanPackageBoundaryError(code)
}

function assertRegularFile(path, code) {
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new CleanPackageBoundaryError(code)
}

function gitBytes(cwd, path) {
  const result = spawnSync("git", ["show", `HEAD:${path}`], { cwd, maxBuffer: 16 * 1024 * 1024 })
  if (result.status !== 0 || result.stdout === undefined) throw new CleanPackageBoundaryError("clean-package-git")
  return Buffer.from(result.stdout)
}

function gitText(cwd, args) {
  const result = run("git", args, cwd)
  requireSuccess(result, "clean-package-git")
  return result.stdout.trim()
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env,
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

function isSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
