#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import {
  closeSync,
  constants,
  existsSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  writeFileSync,
  writeSync,
} from "node:fs"
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from "node:path"
import process from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

import { assertPackRecordBinding, assertSourcePackageIdentity } from "./clean-package-boundary-core.mjs"
import { PackageContentIdentityError, canonicalizePackageTarball } from "./package-content-identity.mjs"

export const CANONICAL_PACKAGE_PACKER_SCHEMA_VERSION = "canonical-package-packer.1"
export const CANONICAL_PACKAGE_PACKER_PROFILE = Object.freeze({
  locale: "C",
  node: "20.19.0",
  npm: "10.8.2",
  timezone: "UTC",
  umask: "0022",
})

const packageRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), ".."))
const MAX_NPM_OUTPUT_BYTES = 2 * 1024 * 1024
const SHA256 = /^[0-9a-f]{64}$/u

export class CanonicalPackagePackerError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function classifyCanonicalPackagePackerError(error) {
  if (error instanceof CanonicalPackagePackerError) return error.code
  if (error instanceof PackageContentIdentityError) return "canonical-package-packer-content"
  return "canonical-package-packer-internal"
}

export function assertCanonicalPackagePackerProfile(value) {
  if (!isRecord(value)) fail("canonical-package-packer-profile")
  if (
    value.locale !== CANONICAL_PACKAGE_PACKER_PROFILE.locale
    || value.node !== CANONICAL_PACKAGE_PACKER_PROFILE.node
    || value.npm !== CANONICAL_PACKAGE_PACKER_PROFILE.npm
    || value.timezone !== CANONICAL_PACKAGE_PACKER_PROFILE.timezone
    || value.umask !== CANONICAL_PACKAGE_PACKER_PROFILE.umask
  ) {
    fail("canonical-package-packer-profile")
  }
  return CANONICAL_PACKAGE_PACKER_PROFILE
}

export function canonicalPackageFacts(bytes, identity, profile = CANONICAL_PACKAGE_PACKER_PROFILE) {
  assertCanonicalPackagePackerProfile(profile)
  const canonical = canonicalizePackageTarball(bytes)
  if (canonical.manifest.name !== identity.name || canonical.manifest.version !== identity.version) {
    fail("canonical-package-packer-identity")
  }
  return {
    package: canonical.manifest,
    schemaVersion: CANONICAL_PACKAGE_PACKER_SCHEMA_VERSION,
    tarball: {
      contentIdentity: canonical.identity,
      sha256: sha256(canonical.bytes),
      size: canonical.bytes.byteLength,
    },
    toolchain: profile,
  }
}

export function createCanonicalNpmEnvironment(root, workspace, nodeExecutable) {
  if (typeof root !== "string" || realpathSync(root) !== packageRoot) fail("canonical-package-packer-root")
  if (typeof nodeExecutable !== "string") fail("canonical-package-packer-runtime")
  const npmRuntime = resolveCanonicalNpmCli(nodeExecutable)
  const nodeBinDirectory = dirname(npmRuntime.nodeExecutable)
  try {
    const nodeBinStat = lstatSync(nodeBinDirectory)
    if (!nodeBinStat.isDirectory() || nodeBinStat.isSymbolicLink()) fail("canonical-package-packer-runtime")
  } catch (error) {
    if (error instanceof CanonicalPackagePackerError) throw error
    fail("canonical-package-packer-runtime")
  }
  if (typeof workspace !== "string" || !isAbsolute(workspace) || existsSync(workspace)) fail("canonical-package-packer-output")
  const parent = dirname(workspace)
  if (!existsSync(parent) || !lstatSync(parent).isDirectory() || lstatSync(parent).isSymbolicLink()) {
    fail("canonical-package-packer-output")
  }
  mkdirSync(workspace, { mode: 0o700 })
  const home = join(workspace, "npm-home")
  const cache = join(workspace, "npm-cache")
  const userConfig = join(workspace, "npm-userconfig")
  const globalConfig = join(workspace, "npm-globalconfig")
  const gitConfig = join(workspace, "git-globalconfig")
  for (const directory of [home, cache]) mkdirSync(directory, { mode: 0o700 })
  writeFileSync(userConfig, "", { flag: "wx", mode: 0o600 })
  writeFileSync(globalConfig, "", { flag: "wx", mode: 0o600 })
  writeFileSync(gitConfig, "", { flag: "wx", mode: 0o600 })
  return {
    GIT_CONFIG_GLOBAL: gitConfig,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_TERMINAL_PROMPT: "0",
    HOME: home,
    LANG: CANONICAL_PACKAGE_PACKER_PROFILE.locale,
    LC_ALL: CANONICAL_PACKAGE_PACKER_PROFILE.locale,
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_CACHE: cache,
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_GLOBAL: "false",
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_IGNORE_SCRIPTS: "false",
    NPM_CONFIG_INCLUDE_WORKSPACE_ROOT: "false",
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_UMASK: CANONICAL_PACKAGE_PACKER_PROFILE.umask,
    NPM_CONFIG_USERCONFIG: userConfig,
    NPM_CONFIG_WORKSPACES: "false",
    PATH: prependPath(nodeBinDirectory, process.env.PATH ?? ""),
    SOURCE_DATE_EPOCH: "0",
    TMPDIR: workspace,
    TZ: CANONICAL_PACKAGE_PACKER_PROFILE.timezone,
    USER: "persona",
  }
}

export function createCanonicalPackageTarball(root, outputDirectory, runtime = {}) {
  const sourceRoot = realpathSync(root)
  if (sourceRoot !== packageRoot || realpathSync(process.cwd()) !== sourceRoot) fail("canonical-package-packer-root")
  const npmRuntime = resolveCanonicalNpmCli(runtime.nodeExecutable, runtime.npmCliPath)
  const profile = runtime.profile ?? readRuntimeProfile(runtime, npmRuntime)
  assertCanonicalPackagePackerProfile(profile)
  const identity = readPackageIdentity(sourceRoot)
  const output = reserveOutputDirectory(outputDirectory)
  const rawDirectory = join(output, "raw")
  mkdirSync(rawDirectory, { mode: 0o700 })
  const environment = createCanonicalNpmEnvironment(sourceRoot, join(output, "environment"), npmRuntime.nodeExecutable)
  assertNpmRootPolicy(sourceRoot, environment, runtime.run, npmRuntime)
  const result = runNpm(["pack", "--json", "--pack-destination", rawDirectory], sourceRoot, environment, runtime.run, npmRuntime)
  if (result.status !== 0) fail("canonical-package-packer-pack")
  const rawPath = parsePackPath(result.stdout, rawDirectory, identity)
  const canonical = canonicalizePackageTarball(readFileSync(rawPath))
  const facts = canonicalPackageFacts(canonical.bytes, identity, profile)
  const tarballPath = join(output, `${identity.name}-${identity.version}.tgz`)
  writePrivateFile(tarballPath, canonical.bytes)
  const factsPath = join(output, "package-facts.json")
  writePrivateFile(factsPath, Buffer.from(`${JSON.stringify(facts)}\n`, "utf8"))
  return { facts, factsPath, tarballPath }
}

export function resolveCanonicalNpmCli(nodeExecutable = process.execPath, npmCliPath = undefined) {
  if (typeof nodeExecutable !== "string" || !isAbsolute(nodeExecutable)) fail("canonical-package-packer-runtime")
  let canonicalNode
  let canonicalNpmCli
  try {
    const nodeStat = lstatSync(nodeExecutable)
    if (!nodeStat.isFile() || nodeStat.isSymbolicLink()) fail("canonical-package-packer-runtime")
    canonicalNode = realpathSync(nodeExecutable)
    const distributionRoot = resolve(dirname(canonicalNode), "..")
    canonicalNpmCli = join(distributionRoot, "lib", "node_modules", "npm", "bin", "npm-cli.js")
    const expectedNpmCli = resolve(canonicalNpmCli)
    if (npmCliPath !== undefined && (typeof npmCliPath !== "string" || resolve(npmCliPath) !== expectedNpmCli)) {
      fail("canonical-package-packer-runtime")
    }
    const npmStat = lstatSync(expectedNpmCli)
    if (!npmStat.isFile() || npmStat.isSymbolicLink()) fail("canonical-package-packer-runtime")
    const npmPackage = JSON.parse(readFileSync(join(distributionRoot, "lib", "node_modules", "npm", "package.json"), "utf8"))
    if (npmPackage?.version !== CANONICAL_PACKAGE_PACKER_PROFILE.npm) fail("canonical-package-packer-runtime")
    canonicalNpmCli = expectedNpmCli
  } catch (error) {
    if (error instanceof CanonicalPackagePackerError) throw error
    fail("canonical-package-packer-runtime")
  }
  return { nodeExecutable: canonicalNode, npmCliPath: canonicalNpmCli }
}

export function canonicalNpmInvocation(args, nodeExecutable = process.execPath, npmCliPath = undefined) {
  if (!Array.isArray(args) || args.some((argument) => typeof argument !== "string")) fail("canonical-package-packer-runtime")
  const runtime = resolveCanonicalNpmCli(nodeExecutable, npmCliPath)
  return [runtime.nodeExecutable, runtime.npmCliPath, ...args]
}

function readRuntimeProfile(runtime, npmRuntime) {
  const node = process.versions.node
  const npmResult = runNpm(["--version"], packageRoot, {
    LANG: "C",
    LC_ALL: "C",
    PATH: process.env.PATH ?? "",
    TZ: "UTC",
  }, runtime.run, npmRuntime)
  return {
    locale: "C",
    node,
    npm: npmResult.status === 0 ? npmResult.stdout.trim() : "unavailable",
    timezone: "UTC",
    umask: formatUmask(process.umask()),
  }
}

function readPackageIdentity(root) {
  try {
    const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
    const packageLock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"))
    const identity = assertSourcePackageIdentity(packageJson, packageLock)
    if (packageJson.packageManager !== `npm@${CANONICAL_PACKAGE_PACKER_PROFILE.npm}` || packageLock?.packages?.[""]?.packageManager !== packageJson.packageManager) {
      fail("canonical-package-packer-identity")
    }
    return identity
  } catch {
    fail("canonical-package-packer-identity")
  }
}

function reserveOutputDirectory(value) {
  if (typeof value !== "string" || !isAbsolute(value) || existsSync(value)) fail("canonical-package-packer-output")
  const parent = dirname(value)
  if (!existsSync(parent) || !lstatSync(parent).isDirectory() || lstatSync(parent).isSymbolicLink()) {
    fail("canonical-package-packer-output")
  }
  const canonicalParent = realpathSync(parent)
  const candidate = resolve(value)
  if (!isContained(canonicalParent, candidate)) fail("canonical-package-packer-output")
  mkdirSync(candidate, { mode: 0o700 })
  const output = realpathSync(candidate)
  if (output !== candidate || lstatSync(output).isSymbolicLink()) fail("canonical-package-packer-output")
  return output
}

function parsePackPath(output, directory, identity) {
  let record
  try {
    const parsed = JSON.parse(output)
    record = Array.isArray(parsed) && parsed.length === 1 ? parsed[0] : undefined
  } catch {
    fail("canonical-package-packer-pack")
  }
  try {
    assertPackRecordBinding(record, identity)
  } catch {
    fail("canonical-package-packer-pack")
  }
  if (!isRecord(record) || typeof record.filename !== "string") fail("canonical-package-packer-pack")
  const candidate = resolve(directory, record.filename)
  if (!isContained(directory, candidate) || !existsSync(candidate)) fail("canonical-package-packer-pack")
  const stat = lstatSync(candidate)
  if (!stat.isFile() || stat.isSymbolicLink()) fail("canonical-package-packer-pack")
  return candidate
}

function assertNpmRootPolicy(root, environment, runner, npmRuntime) {
  const prefix = runNpm(["prefix"], root, environment, runner, npmRuntime)
  let canonicalPrefix
  try {
    canonicalPrefix = prefix.status === 0 ? realpathSync(prefix.stdout.trim()) : undefined
  } catch {
    canonicalPrefix = undefined
  }
  if (canonicalPrefix !== root) fail("canonical-package-packer-root")
  const expected = new Map([
    ["global", "false"],
    ["ignore-scripts", "false"],
    ["workspaces", "false"],
  ])
  for (const [name, value] of expected) {
    const result = runNpm(["config", "get", name], root, environment, runner, npmRuntime)
    if (result.status !== 0 || result.stdout.trim() !== value) fail("canonical-package-packer-policy")
  }
}

function writePrivateFile(path, bytes) {
  let descriptor
  try {
    descriptor = openSync(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
    let offset = 0
    while (offset < bytes.byteLength) {
      const written = writeSync(descriptor, bytes, offset, bytes.byteLength - offset)
      if (written <= 0) fail("canonical-package-packer-output")
      offset += written
    }
  } catch {
    fail("canonical-package-packer-output")
  } finally {
    if (descriptor !== undefined) closeSync(descriptor)
  }
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes.byteLength) fail("canonical-package-packer-output")
}

function runNpm(args, cwd, env, runner = undefined, npmRuntime = undefined) {
  const invocation = npmRuntime === undefined
    ? canonicalNpmInvocation(args)
    : [npmRuntime.nodeExecutable, npmRuntime.npmCliPath, ...args]
  const result = runner === undefined
    ? spawnSync(invocation[0], invocation.slice(1), { cwd, encoding: "utf8", env, maxBuffer: MAX_NPM_OUTPUT_BYTES })
    : runner(args, cwd, env)
  if (!isRecord(result)) fail("canonical-package-packer-runtime")
  return {
    status: typeof result.status === "number" ? result.status : 1,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
  }
}

function formatUmask(value) {
  return value.toString(8).padStart(4, "0")
}

function prependPath(directory, rest) {
  return rest === "" ? directory : `${directory}${delimiter}${rest}`
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function isContained(root, candidate) {
  const relation = relative(resolve(root), candidate)
  return relation !== "" && !relation.startsWith(`..${sep}`) && !relation.startsWith("..") && !relation.startsWith(sep)
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function fail(code) {
  throw new CanonicalPackagePackerError(code)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--output-directory") fail("canonical-package-packer-arguments")
    process.umask(0o022)
    const result = createCanonicalPackageTarball(packageRoot, process.argv[3])
    process.stdout.write(`${JSON.stringify(result.facts)}\n`)
  } catch (error) {
    process.stderr.write(`${classifyCanonicalPackagePackerError(error)}\n`)
    process.exitCode = 1
  }
}
