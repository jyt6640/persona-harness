import { spawnSync } from "node:child_process"
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { basename, isAbsolute, join, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { isDeepStrictEqual } from "node:util"

import { assertPackageContentIdentity } from "./package-content-identity.mjs"
import { assertCanonicalPackagePackerProfile } from "./canonical-package-packer.mjs"
import { readStagedTarballFacts } from "./staged-package-artifact-tarball.mjs"

const PACKAGE_NAME = "persona-harness"
const REGISTRY = "https://registry.npmjs.org"
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024
const MAX_PACKAGE_FACTS_BYTES = 64 * 1024
const REGISTRY_COMMAND_TIMEOUT_MS = 10_000
const COMMIT = /^[a-f0-9]{40}$/u
const INTEGRITY = /^sha512-[A-Za-z0-9+/=]+$/u
const SHA1 = /^[a-f0-9]{40}$/u
const SHA256 = /^sha256:[a-f0-9]{64}$/u
const SEMVER = /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+(?<build>[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u
const TAGS = new Set(["staging", "next", "latest"])

export function assessReleaseRegistryReadback(input) {
  const value = record(input)
  const expectedVersion = safeVersion(value.expectedVersion)
  const expectedHead = safeCommit(value.expectedHead)
  const expectedContentIdentity = safeContentIdentity(value.expectedContentIdentity)
  const expectedTarballSha256 = safeExpectedTarballSha256(value.expectedTarballSha256)
  const distTag = safeTag(value.distTag)
  const metadata = safeMetadata(value.metadata)
  const tarball = safeTarball(value.tarball)
  const diagnostics = new Set()

  if (expectedVersion === undefined) diagnostics.add("release-registry-version")
  if (expectedHead === undefined) diagnostics.add("release-registry-source-head")
  if (expectedContentIdentity === undefined) diagnostics.add("release-registry-content-identity")
  if (expectedTarballSha256 === undefined) diagnostics.add("release-registry-tarball-sha256")
  if (distTag === undefined) diagnostics.add("release-registry-dist-tag")
  if (distTag !== undefined && expectedVersion !== undefined && !isCompatibleChannel(distTag, expectedVersion)) diagnostics.add("release-registry-channel")
  if (metadata === undefined) diagnostics.add("release-registry-metadata")
  if (tarball === undefined) diagnostics.add("release-registry-tarball")
  if (expectedVersion !== undefined && !hasExactTag(value.distTagsText, distTag, expectedVersion)) diagnostics.add("release-registry-dist-tag")
  if (metadata !== undefined && expectedVersion !== undefined && metadata.version !== expectedVersion) diagnostics.add("release-registry-version")
  if (metadata !== undefined && expectedHead !== undefined && metadata.gitHead !== expectedHead) diagnostics.add("release-registry-git-head")
  if (metadata !== undefined && tarball !== undefined && metadata.shasum !== tarball.sha1) diagnostics.add("release-registry-shasum")
  if (metadata !== undefined && tarball !== undefined && metadata.integrity !== tarball.integrity) diagnostics.add("release-registry-integrity")
  if (tarball !== undefined && expectedContentIdentity !== undefined && !isDeepStrictEqual(tarball.contentIdentity, expectedContentIdentity)) {
    diagnostics.add("release-registry-content-identity")
  }
  if (tarball !== undefined && expectedTarballSha256 !== undefined && tarball.sha256 !== `sha256:${expectedTarballSha256}`) {
    diagnostics.add("release-registry-tarball-sha256")
  }

  return {
    diagnostics: [...diagnostics].sort(),
    distTag: distTag ?? "unavailable",
    package: PACKAGE_NAME,
    provenance: "requires-staged-artifact-attestation",
    registry: metadata === undefined || tarball === undefined
      ? unavailableRegistry()
      : {
          gitHead: metadata.gitHead,
          integrity: metadata.integrity,
          shasum: metadata.shasum,
          tarballSha256: tarball.sha256,
          contentIdentity: tarball.contentIdentity,
          version: metadata.version,
        },
    registryMutation: "not-performed",
    schemaVersion: "release-registry-readback.3",
    secretRemovalConfirmed: true,
    sourceHead: expectedHead ?? "unavailable",
    status: diagnostics.size === 0 ? "passed" : "blocked",
    version: expectedVersion ?? "unavailable",
  }
}

export function readReleaseRegistryReadback(root, expected) {
  const normalized = normalizeExpected(expected)
  if (normalized === undefined) return assessReleaseRegistryReadback({})
  const temporaryRoot = mkdtempSync(join(tmpdir(), "persona-release-registry-readback-"))
  try {
    const environment = createRegistryNpmEnvironment(temporaryRoot)
    const metadata = readMetadata(root, normalized.version, environment)
    const distTagsText = run("npm", ["dist-tag", "ls", PACKAGE_NAME, "--registry", REGISTRY], root, environment).stdout
    const tarball = readRegistryTarball(root, temporaryRoot, normalized.version, environment)
    return assessReleaseRegistryReadback({
      distTag: normalized.distTag,
      distTagsText,
      expectedContentIdentity: normalized.contentIdentity,
      expectedTarballSha256: normalized.tarballSha256,
      expectedHead: normalized.sourceHead,
      expectedVersion: normalized.version,
      metadata,
      tarball,
    })
  } finally {
    rmSync(temporaryRoot, { force: true, recursive: true })
  }
}

function normalizeExpected(value) {
  const input = record(value)
  const contentIdentity = safeContentIdentity(input.expectedContentIdentity)
  const tarballSha256 = safeExpectedTarballSha256(input.expectedTarballSha256)
  const distTag = safeTag(input.distTag)
  const sourceHead = safeCommit(input.sourceHead)
  const version = safeVersion(input.version)
  return contentIdentity === undefined || tarballSha256 === undefined || distTag === undefined || sourceHead === undefined || version === undefined
    ? undefined
    : { contentIdentity, distTag, sourceHead, tarballSha256, version }
}

function readMetadata(root, version, environment) {
  const result = run("npm", [
    "view",
    `${PACKAGE_NAME}@${version}`,
    "version",
    "gitHead",
    "dist.shasum",
    "dist.integrity",
    "--json",
    "--registry",
    REGISTRY,
  ], root, environment)
  if (result.status !== 0) return undefined
  try {
    return JSON.parse(result.stdout)
  } catch {
    return undefined
  }
}

function readRegistryTarball(root, temporaryRoot, version, environment) {
  const outputDirectory = join(temporaryRoot, "package")
  mkdirSync(outputDirectory, { mode: 0o700 })
  const result = run("npm", [
    "pack",
    `${PACKAGE_NAME}@${version}`,
    "--json",
    "--pack-destination",
    outputDirectory,
    "--registry",
    REGISTRY,
  ], root, environment)
  if (result.status !== 0) return undefined
  try {
    const parsed = JSON.parse(result.stdout)
    if (!Array.isArray(parsed) || parsed.length !== 1 || typeof parsed[0]?.filename !== "string") return undefined
    const tarballPath = resolve(outputDirectory, basename(parsed[0].filename))
    if (!isContained(outputDirectory, tarballPath) || !existsSync(tarballPath) || lstatSync(tarballPath).isSymbolicLink()) return undefined
    return readStagedTarballFacts(readFileSync(tarballPath), PACKAGE_NAME, version)
  } catch {
    return undefined
  }
}

function createRegistryNpmEnvironment(root) {
  const home = join(root, "npm-home")
  const cache = join(root, "npm-cache")
  const userConfig = join(root, "npm-userconfig")
  const globalConfig = join(root, "npm-globalconfig")
  mkdirSync(home, { mode: 0o700 })
  mkdirSync(cache, { mode: 0o700 })
  writeFileSync(userConfig, "", { flag: "wx", mode: 0o600 })
  writeFileSync(globalConfig, "", { flag: "wx", mode: 0o600 })
  return {
    HOME: home,
    LANG: "C",
    LC_ALL: "C",
    NPM_CONFIG_AUDIT: "false",
    NPM_CONFIG_CACHE: cache,
    NPM_CONFIG_FUND: "false",
    NPM_CONFIG_GLOBALCONFIG: globalConfig,
    NPM_CONFIG_UPDATE_NOTIFIER: "false",
    NPM_CONFIG_USERCONFIG: userConfig,
    NPM_CONFIG_WORKSPACES: "false",
    PATH: process.env.PATH ?? "",
    TMPDIR: root,
    TZ: "UTC",
    USER: "persona",
  }
}

function run(command, args, cwd, environment) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: environment ?? { LANG: "C", LC_ALL: "C", npm_config_registry: REGISTRY, PATH: process.env.PATH ?? "" },
    killSignal: "SIGTERM",
    maxBuffer: MAX_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: REGISTRY_COMMAND_TIMEOUT_MS,
  })
  return { status: typeof result.status === "number" ? result.status : 1, stdout: result.stdout ?? "" }
}

function hasExactTag(value, tag, version) {
  return typeof value === "string" && tag !== undefined && value.split(/\r?\n/u).some((line) => line.trim() === `${tag}: ${version}`)
}

function safeMetadata(value) {
  const metadata = record(value)
  const gitHead = safeCommit(metadata.gitHead)
  const integrity = typeof metadata["dist.integrity"] === "string" && INTEGRITY.test(metadata["dist.integrity"])
    ? metadata["dist.integrity"]
    : undefined
  const shasum = typeof metadata["dist.shasum"] === "string" && SHA1.test(metadata["dist.shasum"])
    ? metadata["dist.shasum"].toLowerCase()
    : undefined
  const version = safeVersion(metadata.version)
  return gitHead === undefined || integrity === undefined || shasum === undefined || version === undefined
    ? undefined
    : { gitHead, integrity, shasum, version }
}

function safeTarball(value) {
  const tarball = record(value)
  const contentIdentity = safeContentIdentity(tarball.contentIdentity)
  const integrity = typeof tarball.integrity === "string" && INTEGRITY.test(tarball.integrity) ? tarball.integrity : undefined
  const sha1 = typeof tarball.sha1 === "string" && SHA1.test(tarball.sha1) ? tarball.sha1.toLowerCase() : undefined
  const sha256 = typeof tarball.sha256 === "string" && SHA256.test(tarball.sha256) ? tarball.sha256.toLowerCase() : undefined
  return contentIdentity === undefined || integrity === undefined || sha1 === undefined || sha256 === undefined
    ? undefined
    : { contentIdentity, integrity, sha1, sha256 }
}

function safeContentIdentity(value) {
  try {
    return assertPackageContentIdentity(value)
  } catch {
    return undefined
  }
}

function safeExpectedTarballSha256(value) {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value) ? value : undefined
}

function safeCommit(value) {
  return typeof value === "string" && COMMIT.test(value) ? value.toLowerCase() : undefined
}

function safeTag(value) {
  return typeof value === "string" && TAGS.has(value) ? value : undefined
}

function safeVersion(value) {
  return typeof value === "string" && value.length <= 256 && SEMVER.test(value) ? value : undefined
}

function isCompatibleChannel(tag, version) {
  const prerelease = version.includes("-")
  return (tag === "staging" || tag === "next") ? prerelease : !prerelease
}

function unavailableRegistry() {
  return {
    gitHead: "unavailable",
    integrity: "unavailable",
    shasum: "unavailable",
    tarballSha256: "unavailable",
    contentIdentity: "unavailable",
    version: "unavailable",
  }
}

function record(value) {
  return isRecord(value) ? value : {}
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isContained(root, candidate) {
  const relation = relative(resolve(root), candidate)
  return relation !== "" && !relation.startsWith(`..${sep}`) && !relation.startsWith("..") && !relation.startsWith(sep)
}

export function parseReleaseRegistryReadbackArguments(args) {
  const values = {}
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index]
    const value = args[index + 1]
    if ((key !== "--dist-tag" && key !== "--source-head" && key !== "--version" && key !== "--package-facts") || value === undefined || values[key] !== undefined) return undefined
    values[key] = value
  }
  if (args.length !== 8) return undefined
  const facts = readCanonicalPackageFacts(values["--package-facts"])
  if (facts === undefined || facts.package.version !== values["--version"]) return undefined
  return {
    distTag: values["--dist-tag"],
    expectedContentIdentity: facts.tarball.contentIdentity,
    expectedTarballSha256: facts.tarball.sha256,
    sourceHead: values["--source-head"],
    version: values["--version"],
  }
}

export function readCanonicalPackageFacts(path) {
  const assessment = assessCanonicalPackageFacts(path)
  return assessment.status === "ready" ? assessment.value : undefined
}

export function assessCanonicalPackageFacts(path) {
  try {
    if (typeof path !== "string" || !isAbsolute(path)) return { code: "release-registry-package-facts-path", status: "blocked" }
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > MAX_PACKAGE_FACTS_BYTES) return { code: "release-registry-package-facts-path", status: "blocked" }
    let value
    try {
      value = JSON.parse(readFileSync(path, "utf8"))
    } catch {
      return { code: "release-registry-package-facts-shape", status: "blocked" }
    }
    if (!isRecord(value) || !hasExactKeys(value, ["package", "schemaVersion", "tarball", "toolchain"]) || value.schemaVersion !== "canonical-package-packer.1") {
      return { code: "release-registry-package-facts-shape", status: "blocked" }
    }
    const packageValue = record(value.package)
    if (packageValue.name !== PACKAGE_NAME || safeVersion(packageValue.version) === undefined || !hasExactKeys(packageValue, ["name", "version"])) {
      return { code: "release-registry-package-facts-package", status: "blocked" }
    }
    const tarball = record(value.tarball)
    if (
      !hasExactKeys(tarball, ["contentIdentity", "sha256", "size"])
      || safeContentIdentity(tarball.contentIdentity) === undefined
      || safeExpectedTarballSha256(tarball.sha256) === undefined
      || !Number.isSafeInteger(tarball.size)
      || tarball.size < 1
    ) {
      return { code: "release-registry-package-facts-tarball", status: "blocked" }
    }
    try {
      assertCanonicalPackagePackerProfile(value.toolchain)
    } catch {
      return { code: "release-registry-package-facts-toolchain", status: "blocked" }
    }
    return { status: "ready", value }
  } catch {
    return { code: "release-registry-package-facts-shape", status: "blocked" }
  }
}

function hasExactKeys(value, keys) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const expected = parseReleaseRegistryReadbackArguments(process.argv.slice(2))
  const result = expected === undefined ? assessReleaseRegistryReadback({}) : readReleaseRegistryReadback(process.cwd(), expected)
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (result.status !== "passed") process.exitCode = 1
}
