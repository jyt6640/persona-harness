#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
  writeSync,
  closeSync,
  constants,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import {
  BUNDLE_REFERENCE_POLICY,
  CleanPackageBoundaryError,
  assertBundleHeadBinding,
  assertCanonicalPartialCloneRemote,
  assertCheckoutPackageBinding,
  assertNpmExecutionPolicy,
  assertPackageExecutionBinding,
  assertPackRecordBinding,
  assertSourcePackageIdentity,
  parseBundleHeads,
} from "./clean-package-boundary-core.mjs"
import { canonicalizePackageTarball } from "./package-content-identity.mjs"

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-clean-package-boundary-"))
const sourceCandidateRef = BUNDLE_REFERENCE_POLICY.sourceCandidateRef

process.umask(0o022)

try {
  const input = parseInput(process.argv.slice(2))
  const git = createGitEnvironment(temporaryRoot)
  const bundle = input.mode === "source"
    ? createSourceBundle(sourceRoot, git)
    : verifySuppliedBundle(input, git)
  if (input.gitBoundaryOnly) {
    process.stdout.write(`${JSON.stringify({
      base: bundle.base,
      candidateRef: bundle.candidateRef,
      head: bundle.head,
      source: "detached-source",
    })}\n`)
  } else {
    const checkout = materializeCheckout(bundle, bundle.head, "target", git)
    const source = readSourceIdentity(checkout, git)
    const npm = createNpmEnvironment(temporaryRoot, "target")

    const targetRoot = assertCheckoutIntegrity(checkout, source, npm, git)
    assertStaleLauncherIsRejected(checkout, targetRoot)
    requireSuccess(runNpm(["ci", "--ignore-scripts", "--no-audit", "--no-fund"], checkout, npm), "clean-package-install")
    if (existsSync(join(checkout, "dist"))) throw new CleanPackageBoundaryError("clean-package-prepack-dist")

    assertCheckoutIntegrity(checkout, source, npm, git)
    const packed = packCheckout(checkout, source, npm, "target")
    assertRepeatPackIdentity(packCheckout(checkout, source, npm, "target-repeat"), packed, "clean-package-target-content-identity")
    assertCheckoutIntegrity(checkout, source, npm, git)
    assertCliVersion(checkout, join(checkout, "dist", "cli", "index.js"), source.identity.version, npm, "clean-package-built-cli")
    const contract = input.exerciseContract
      ? exerciseExactTarContract(checkout, packed, npm, resolveObserverGhPath(input.observerGh))
      : undefined

    const consumer = installFreshTarball(packed.tarballPath, source.identity, npm)
    const baseCheckout = materializeCheckout(bundle, bundle.base, "base", git)
    const baseSource = readSourceIdentity(baseCheckout, git)
    const baseNpm = createNpmEnvironment(temporaryRoot, "base")
    const baseRoot = assertCheckoutIntegrity(baseCheckout, baseSource, baseNpm, git)
    requireSuccess(runNpm(["ci", "--ignore-scripts", "--no-audit", "--no-fund"], baseCheckout, baseNpm), "clean-package-base-install")
    if (existsSync(join(baseCheckout, "dist"))) throw new CleanPackageBoundaryError("clean-package-base-prepack-dist")
    assertCheckoutIntegrity(baseCheckout, baseSource, baseNpm, git)
    const basePacked = packCheckout(baseCheckout, baseSource, baseNpm, "base")
    assertRepeatPackIdentity(packCheckout(baseCheckout, baseSource, baseNpm, "base-repeat"), basePacked, "clean-package-base-content-identity")
    assertCheckoutIntegrity(baseCheckout, baseSource, baseNpm, git)
    process.stdout.write(`${JSON.stringify({
      base: bundle.base,
      candidateRef: bundle.candidateRef,
      basePackage: {
        fileCount: basePacked.facts.fileCount,
        name: baseSource.identity.name,
        pathSetSha256: basePacked.facts.pathSetSha256,
        packageContentIdentity: basePacked.facts.packageContentIdentity,
        exactTarballSha256: basePacked.facts.tarballSha256,
        version: baseSource.identity.version,
      },
      head: bundle.head,
      package: {
        fileCount: packed.facts.fileCount,
        name: source.identity.name,
        pathSetSha256: packed.facts.pathSetSha256,
        packageContentIdentity: packed.facts.packageContentIdentity,
        exactTarballSha256: packed.facts.tarballSha256,
        version: source.identity.version,
      },
      packageRoots: {
        base: baseRoot,
        target: targetRoot,
      },
      schemaVersion: "clean-package-boundary.4",
      source: input.mode,
      installedPackage: {
        cliVersion: consumer.cliVersion,
        sourceFallback: false,
        version: consumer.version,
      },
      ...(contract === undefined ? {} : { contract }),
    })}\n`)
  }
} catch (error) {
  process.stderr.write(`${error instanceof CleanPackageBoundaryError ? error.code : "clean-package-boundary-failed"}\n`)
  process.exitCode = 1
} finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}

function parseInput(args) {
  const remaining = [...args]
  let exerciseContract = false
  let gitBoundaryOnly = false
  let observerGh
  if (remaining[0] === "--exercise-contract") {
    exerciseContract = true
    remaining.shift()
  }
  if (remaining[0] === "--git-boundary-only") {
    gitBoundaryOnly = true
    remaining.shift()
  }
  if (remaining[0] === "--observer-gh") {
    if (typeof remaining[1] !== "string" || !remaining[1].startsWith("/") || remaining[1].includes("\0")) {
      throw new CleanPackageBoundaryError("clean-package-arguments")
    }
    observerGh = remaining[1]
    remaining.splice(0, 2)
  }
  if (remaining.length === 0) return { exerciseContract, gitBoundaryOnly, mode: "source", observerGh }
  if (gitBoundaryOnly) throw new CleanPackageBoundaryError("clean-package-arguments")
  if (
    remaining.length !== 8
    || remaining[0] !== "--bundle"
    || remaining[2] !== "--candidate-ref"
    || remaining[4] !== "--head"
    || remaining[6] !== "--base"
  ) {
    throw new CleanPackageBoundaryError("clean-package-arguments")
  }
  if (!isSha(remaining[5]) || !isSha(remaining[7])) throw new CleanPackageBoundaryError("clean-package-arguments")
  return {
    base: remaining[7],
    bundlePath: remaining[1],
    candidateRef: remaining[3],
    exerciseContract,
    gitBoundaryOnly,
    head: remaining[5],
    mode: "bundle",
    observerGh,
  }
}

function createSourceBundle(root, git) {
  assertDirectory(root, "clean-package-source-root")
  const sourceRoot = realpathSync(root)
  if (gitText(sourceRoot, ["rev-parse", "--show-toplevel"], git) !== sourceRoot) {
    throw new CleanPackageBoundaryError("clean-package-source-root")
  }
  assertCleanGit(sourceRoot, git)
  const base = gitText(sourceRoot, ["rev-parse", BUNDLE_REFERENCE_POLICY.mainRef], git)
  const head = gitText(sourceRoot, ["rev-parse", "HEAD"], git)
  requireSuccess(run("git", ["merge-base", "--is-ancestor", base, head], sourceRoot, git), "clean-package-ancestry")
  hydratePartialSource(sourceRoot, base, git)
  const sourceRepository = materializeSourceRepository(sourceRoot, head, base, git)
  const bundlePath = join(temporaryRoot, "candidate.bundle")
  requireSuccess(
    run("git", ["bundle", "create", bundlePath, sourceCandidateRef, BUNDLE_REFERENCE_POLICY.mainRef], sourceRepository, git),
    "clean-package-bundle-create",
  )
  return verifyBundle(bundlePath, { base, candidateRef: sourceCandidateRef, head }, git)
}

function hydratePartialSource(root, base, git) {
  const promisor = optionalGitConfig(root, "remote.origin.promisor", git)
  if (promisor === undefined) return
  if (promisor !== "true") throw new CleanPackageBoundaryError("clean-package-source-hydrate")
  const filter = gitText(root, ["config", "--get", "remote.origin.partialclonefilter"], git)
  if (filter !== "blob:none") throw new CleanPackageBoundaryError("clean-package-source-hydrate")
  assertCanonicalPartialCloneRemote(gitText(root, ["config", "--get", "remote.origin.url"], git))
  if (gitText(root, ["rev-parse", BUNDLE_REFERENCE_POLICY.mainRef], git) !== base) {
    throw new CleanPackageBoundaryError("clean-package-source-hydrate")
  }
  requireSuccess(
    run(
      "git",
      ["fetch", "--refetch", "--no-filter", "--no-tags", "--no-write-fetch-head", "origin", base],
      root,
      git,
    ),
    "clean-package-source-hydrate",
  )
  if (gitText(root, ["rev-parse", BUNDLE_REFERENCE_POLICY.mainRef], git) !== base) {
    throw new CleanPackageBoundaryError("clean-package-source-hydrate")
  }
}

function materializeSourceRepository(root, head, base, git) {
  const repository = join(temporaryRoot, "source-bundle.git")
  requireSuccess(run("git", ["init", "--bare", repository], temporaryRoot, git), "clean-package-source-materialize")
  requireSuccess(
    run(
      "git",
      [
        "-c",
        "protocol.file.allow=always",
        "fetch",
        "--no-tags",
        "--no-write-fetch-head",
        root,
        `${head}:${sourceCandidateRef}`,
        `${base}:${BUNDLE_REFERENCE_POLICY.mainRef}`,
      ],
      repository,
      git,
    ),
    "clean-package-source-materialize",
  )
  if (gitText(repository, ["rev-parse", sourceCandidateRef], git) !== head) {
    throw new CleanPackageBoundaryError("clean-package-source-materialize")
  }
  if (gitText(repository, ["rev-parse", BUNDLE_REFERENCE_POLICY.mainRef], git) !== base) {
    throw new CleanPackageBoundaryError("clean-package-source-materialize")
  }
  return repository
}

function verifySuppliedBundle(input, git) {
  if (
    typeof input.bundlePath !== "string"
    || typeof input.base !== "string"
    || typeof input.candidateRef !== "string"
    || typeof input.head !== "string"
  ) {
    throw new CleanPackageBoundaryError("clean-package-arguments")
  }
  const bundlePath = realpathSync(input.bundlePath)
  assertRegularFile(bundlePath, "clean-package-bundle-file")
  return verifyBundle(bundlePath, { base: input.base, candidateRef: input.candidateRef, head: input.head }, git)
}

function verifyBundle(bundlePath, expected, git) {
  const bare = join(temporaryRoot, "bundle-verify.git")
  requireSuccess(run("git", ["init", "--bare", bare], temporaryRoot, git), "clean-package-bundle-verify")
  requireSuccess(run("git", ["bundle", "verify", bundlePath], bare, git), "clean-package-bundle-verify")
  const heads = parseBundleHeads(gitText(bare, ["bundle", "list-heads", bundlePath], git))
  const binding = assertBundleHeadBinding(heads, expected)
  return { ...binding, bundlePath }
}

function materializeCheckout(bundle, revision, label, git) {
  const checkout = join(temporaryRoot, `checkout-${label}`)
  requireSuccess(run("git", ["clone", "--no-local", "--no-checkout", bundle.bundlePath, checkout], temporaryRoot, git), "clean-package-bundle-clone")
  requireSuccess(run("git", ["checkout", "--detach", revision], checkout, git), "clean-package-checkout-head")
  assertDirectory(checkout, "clean-package-checkout-root")
  if (gitText(checkout, ["rev-parse", "HEAD"], git) !== revision) throw new CleanPackageBoundaryError("clean-package-checkout-head")
  assertCleanGit(checkout, git)
  return realpathSync(checkout)
}

function readSourceIdentity(root, git) {
  const packageBytes = readFileSync(join(root, "package.json"))
  const lockBytes = readFileSync(join(root, "package-lock.json"))
  const headPackageBytes = gitBytes(root, "package.json", git)
  const headLockBytes = gitBytes(root, "package-lock.json", git)
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

function assertCheckoutIntegrity(root, source, npm, git) {
  assertCleanGit(root, git)
  const commandCwd = realpathSync(root)
  const gitRoot = realpathSync(gitText(root, ["rev-parse", "--show-toplevel"], git))
  const prefix = npmPrefix(root, npm)
  const packagePath = realpathSync(join(root, "package.json"))
  const lockPath = realpathSync(join(root, "package-lock.json"))
  assertPackageExecutionBinding({
    commandCwd,
    expectedLockPath: join(root, "package-lock.json"),
    expectedPackagePath: join(root, "package.json"),
    gitRoot,
    lockPath,
    npmPrefix: prefix,
    packagePath,
    root,
  })
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
  return {
    commandCwd,
    gitRoot,
    lockPath,
    npmPrefix: prefix,
    packagePath,
  }
}

function packCheckout(root, source, npm, label) {
  const packDirectory = join(temporaryRoot, `pack-${label}`)
  mkdirSync(packDirectory)
  const packed = runNpm(["pack", "--json", "--pack-destination", packDirectory], root, npm)
  requireSuccess(packed, "clean-package-pack")
  return resolvePackResult(packed.stdout, packDirectory, source.identity)
}

function exerciseExactTarContract(root, packed, npm, observerGh) {
  const sourceResult = run(
    process.execPath,
    [
      join(root, "scripts", "test-installed-package-contract.mjs"),
      "--package-exercise",
      "--observer-gh",
      observerGh,
      "--source-cli",
      join(root, "dist", "cli", "index.js"),
    ],
    root,
    npm,
  )
  requireSuccess(sourceResult, "clean-package-source-contract")
  if (!sourceResult.stdout.includes("source-cli-package-exercise-contract: PASS")) {
    throw new CleanPackageBoundaryError("clean-package-source-contract")
  }

  const installedResult = run(
    process.execPath,
    [
      join(root, "scripts", "test-installed-package-contract.mjs"),
      "--package-exercise",
      "--observer-gh",
      observerGh,
      "--tarball",
      packed.tarballPath,
      "--tarball-sha256",
      packed.facts.tarballSha256,
      "--tarball-content-identity",
      packed.facts.packageContentIdentity.identitySha256,
    ],
    root,
    npm,
  )
  requireSuccess(installedResult, "clean-package-installed-contract")
  if (!installedResult.stdout.includes("installed-package-exercise-contract: PASS")) {
    throw new CleanPackageBoundaryError("clean-package-installed-contract")
  }
  return {
    installed: "fresh-tarball-contract-pass",
    source: "built-cli-contract-pass",
    exactTarballSha256: packed.facts.tarballSha256,
    packageContentIdentity: packed.facts.packageContentIdentity.identitySha256,
  }
}

function resolveObserverGhPath(value) {
  if (typeof value === "string") return value
  if (process.platform === "linux") return "/usr/bin/gh"
  throw new CleanPackageBoundaryError("clean-package-observer-gh")
}

function assertStaleLauncherIsRejected(root, binding) {
  const launcher = join(temporaryRoot, "stale-launcher")
  mkdirSync(launcher)
  writeFileSync(join(launcher, "package.json"), `${JSON.stringify({ name: "stale-launcher", version: "0.8.0-beta.1" })}\n`)
  writeFileSync(join(launcher, "package-lock.json"), `${JSON.stringify({ lockfileVersion: 3, name: "stale-launcher", packages: { "": { name: "stale-launcher", version: "0.8.0-beta.1" } } })}\n`)
  try {
    assertPackageExecutionBinding({
      ...binding,
      commandCwd: realpathSync(launcher),
      expectedLockPath: join(root, "package-lock.json"),
      expectedPackagePath: join(root, "package.json"),
      root,
    })
  } catch (error) {
    if (error instanceof CleanPackageBoundaryError && error.code === "clean-package-command-cwd") return
    throw error
  }
  throw new CleanPackageBoundaryError("clean-package-stale-launcher")
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
  let canonical
  try {
    canonical = canonicalizePackageTarball(readFileSync(tarballPath))
  } catch {
    throw new CleanPackageBoundaryError("clean-package-content-identity")
  }
  const canonicalDirectory = join(packDirectory, "canonical")
  mkdirSync(canonicalDirectory, { mode: 0o700 })
  const canonicalPath = join(canonicalDirectory, `${identity.name}-${identity.version}.tgz`)
  writeCanonicalTarball(canonicalPath, canonical.bytes)
  return {
    facts: {
      fileCount: paths.length,
      packageContentIdentity: canonical.identity,
      pathSetSha256: sha256(Buffer.from(`${paths.join("\n")}\n`, "utf8")),
      tarballSha256: sha256(canonical.bytes),
    },
    tarballPath: canonicalPath,
  }
}

function writeCanonicalTarball(path, bytes) {
  let descriptor
  try {
    descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    let offset = 0
    while (offset < bytes.byteLength) {
      const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset)
      if (written <= 0) throw new Error("write")
      offset += written
    }
  } catch {
    throw new CleanPackageBoundaryError("clean-package-content-identity")
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes.byteLength) {
    throw new CleanPackageBoundaryError("clean-package-content-identity")
  }
}

function createNpmEnvironment(root, label) {
  const home = join(root, `npm-home-${label}`)
  const cache = join(root, `npm-cache-${label}`)
  const userConfig = join(root, `npm-userconfig-${label}`)
  const globalConfig = join(root, `npm-globalconfig-${label}`)
  const gitConfig = join(root, `git-globalconfig-${label}`)
  mkdirSync(home)
  mkdirSync(cache)
  writeFileSync(userConfig, "", { flag: "wx", mode: 0o600 })
  writeFileSync(globalConfig, "", { flag: "wx", mode: 0o600 })
  writeFileSync(gitConfig, "", { flag: "wx", mode: 0o600 })
  return {
    GIT_CONFIG_GLOBAL: gitConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    HOME: home,
    LANG: "C",
    LC_ALL: "C",
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_CACHE: cache,
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_IGNORE_SCRIPTS: "false",
    NPM_CONFIG_INCLUDE_WORKSPACE_ROOT: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_UMASK: "0022",
    NPM_CONFIG_USERCONFIG: userConfig,
    NPM_CONFIG_WORKSPACES: "false",
    PATH: process.env.PATH ?? "",
    TMPDIR: root,
    TZ: "UTC",
    USER: "persona",
  }
}

function createGitEnvironment(root) {
  const home = join(root, "git-home")
  const globalConfig = join(root, "git-globalconfig")
  mkdirSync(home)
  writeFileSync(globalConfig, "")
  return {
    GIT_CONFIG_GLOBAL: globalConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    HOME: home,
    LANG: "C",
    LC_ALL: "C",
    PATH: process.env.PATH ?? "",
    TZ: "UTC",
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
  return run("npm", args, cwd, npm)
}

function assertCliVersion(cwd, cliPath, expectedVersion, npm, code) {
  if (!existsSync(cliPath)) throw new CleanPackageBoundaryError(`${code}-missing`)
  const result = run(process.execPath, [cliPath, "--version"], cwd, npm)
  if (result.status !== 0) throw new CleanPackageBoundaryError(`${code}-status`)
  if (result.stdout.trim() !== expectedVersion) throw new CleanPackageBoundaryError(`${code}-version`)
  if (result.stderr !== "") throw new CleanPackageBoundaryError(`${code}-stderr`)
  return result.stdout.trim()
}

function assertCleanGit(root, git) {
  if (gitText(root, ["status", "--porcelain", "--untracked-files=all"], git) !== "") {
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

function gitBytes(cwd, path, git) {
  const result = spawnSync("git", ["show", `HEAD:${path}`], { cwd, env: git, maxBuffer: 16 * 1024 * 1024 })
  if (result.status !== 0 || result.stdout === undefined) throw new CleanPackageBoundaryError("clean-package-git")
  return Buffer.from(result.stdout)
}

function gitText(cwd, args, git) {
  const result = run("git", args, cwd, git)
  requireSuccess(result, "clean-package-git")
  return result.stdout.trim()
}

function optionalGitConfig(cwd, key, git) {
  const result = run("git", ["config", "--get", key], cwd, git)
  if (result.status === 1 && result.stdout === "" && result.stderr === "") return undefined
  requireSuccess(result, "clean-package-source-hydrate")
  const value = result.stdout.trim()
  if (value === "") throw new CleanPackageBoundaryError("clean-package-source-hydrate")
  return value
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

function assertRepeatPackIdentity(repeated, initial, code) {
  const left = initial.facts.packageContentIdentity
  const right = repeated.facts.packageContentIdentity
  if (
    left.identitySha256 !== right.identitySha256
    || left.contentSha256 !== right.contentSha256
    || left.entryCount !== right.entryCount
    || JSON.stringify(left.modeCounts) !== JSON.stringify(right.modeCounts)
    || initial.facts.tarballSha256 !== repeated.facts.tarballSha256
  ) {
    throw new CleanPackageBoundaryError(code)
  }
}

function isSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
