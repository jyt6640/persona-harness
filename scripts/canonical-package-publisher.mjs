#!/usr/bin/env node
import { spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import { constants, lstatSync, readFileSync, realpathSync } from "node:fs"
import { basename, isAbsolute, relative, resolve, sep } from "node:path"
import { pathToFileURL } from "node:url"
import { isDeepStrictEqual } from "node:util"

import {
  CANONICAL_PACKAGE_PACKER_PROFILE,
  assertCanonicalPackagePackerProfile,
  canonicalPackageFacts,
} from "./canonical-package-packer.mjs"

export const CANONICAL_PUBLISHER_RUNTIME = Object.freeze({ node: "24.18.0", npm: "11.16.0" })
export const CANONICAL_PACKAGE_PUBLISHER_SCHEMA_VERSION = "canonical-package-publisher.1"
export const CANONICAL_PACKAGE_PUBLISHER_PLAN_SCHEMA_VERSION = "canonical-package-publisher-plan.1"

const DIST_TAGS = new Set(["staging", "next", "latest"])
const MAX_FACTS_BYTES = 64 * 1024
const CANONICAL_PUBLISHER_PLAN = Object.freeze({
  canonicalPackerRuntime: Object.freeze({
    node: CANONICAL_PACKAGE_PACKER_PROFILE.node,
    npm: CANONICAL_PACKAGE_PACKER_PROFILE.npm,
  }),
  canonicalTar: Object.freeze({
    handoff: "exact-canonical-tarball-sha256-and-package-content-identity",
    source: "canonical-package-packer-output-and-package-facts",
  }),
  preflight: Object.freeze({
    argv: ["npm", "publish", "<canonical-tarball>", "--access", "public", "--tag", "<selected-dist-tag>", "--provenance", "--dry-run"],
    credentials: "no-custom-token-exchange-or-auth-state-output",
    mode: "node24-npm11-exact-canonical-tarball-dry-run",
  }),
  publisherEnvironment: Object.freeze({
    canonicalPackerConfigInheritance: "forbidden",
    isolated: ["HOME", "NPM_CONFIG_CACHE", "NPM_CONFIG_GLOBALCONFIG", "NPM_CONFIG_USERCONFIG"],
  }),
  publisherRuntime: CANONICAL_PUBLISHER_RUNTIME,
  npmTrustedPublishingMinimum: Object.freeze({ node: "22.14.0", npm: "11.5.1" }),
  registryPut: Object.freeze({
    evidence: "hosted-only",
    historicalBeta17: "authorization-shaped-registry-response-not-package-absence",
  }),
  schemaVersion: CANONICAL_PACKAGE_PUBLISHER_PLAN_SCHEMA_VERSION,
})

export class CanonicalPackagePublisherError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function assertCanonicalPublisherRuntime(value) {
  if (!isRecord(value) || !hasExactKeys(value, ["node", "npm"])) fail("canonical-package-publisher-runtime")
  if (value.node !== CANONICAL_PUBLISHER_RUNTIME.node || value.npm !== CANONICAL_PUBLISHER_RUNTIME.npm) {
    fail("canonical-package-publisher-runtime")
  }
  return CANONICAL_PUBLISHER_RUNTIME
}

export function canonicalPackagePublisherPlan() {
  return structuredClone(CANONICAL_PUBLISHER_PLAN)
}

export function parseCanonicalPackagePublisherPlan(value) {
  if (!isDeepStrictEqual(value, CANONICAL_PUBLISHER_PLAN)) fail("canonical-package-publisher-plan")
  return value
}

export function createCanonicalPublisherArgs({ dryRun, distTag, tarballPath }) {
  if (typeof tarballPath !== "string" || !isAbsolute(tarballPath)) fail("canonical-package-publisher-tarball")
  if (typeof distTag !== "string" || !DIST_TAGS.has(distTag)) fail("canonical-package-publisher-dist-tag")
  if (typeof dryRun !== "boolean") fail("canonical-package-publisher-mode")
  return [
    "publish",
    tarballPath,
    "--access",
    "public",
    "--tag",
    distTag,
    "--provenance",
    ...(dryRun ? ["--dry-run"] : []),
  ]
}

export function verifyCanonicalPublisherHandoff(input) {
  if (!isRecord(input) || !hasExactKeys(input, [
    "canonicalDirectory",
    "distTag",
    "dryRun",
    "packageFactsPath",
    "publisherEnvironment",
    "publisherRuntime",
    "publisherRuntimeDirectory",
    "tarballPath",
  ])) {
    fail("canonical-package-publisher-input")
  }

  const canonicalDirectory = readDirectory(input.canonicalDirectory, "canonical-package-publisher-canonical-directory")
  const publisherRuntimeDirectory = readDirectory(input.publisherRuntimeDirectory, "canonical-package-publisher-environment")
  if (
    sameOrContained(canonicalDirectory, publisherRuntimeDirectory)
    || sameOrContained(publisherRuntimeDirectory, canonicalDirectory)
  ) {
    fail("canonical-package-publisher-environment")
  }
  const tarballPath = readRegularFile(input.tarballPath, "canonical-package-publisher-tarball")
  if (!isContained(canonicalDirectory, tarballPath)) fail("canonical-package-publisher-tarball")
  const factsPath = readRegularFile(input.packageFactsPath, "canonical-package-publisher-facts")
  const facts = readFacts(factsPath)
  const runtime = assertCanonicalPublisherRuntime(input.publisherRuntime)
  const publisherEnvironment = assertPublisherEnvironment(
    input.publisherEnvironment,
    canonicalDirectory,
    publisherRuntimeDirectory,
  )
  const bytes = readFileSync(tarballPath)
  const packageIdentity = readPackageIdentity(facts)
  const expectedFilename = `${packageIdentity.name}-${packageIdentity.version}.tgz`
  if (basename(tarballPath) !== expectedFilename || sha256(bytes) !== facts.tarball.sha256) {
    fail("canonical-package-publisher-tarball")
  }

  let actualFacts
  try {
    actualFacts = canonicalPackageFacts(bytes, packageIdentity, facts.toolchain)
  } catch {
    fail("canonical-package-publisher-facts")
  }
  if (!isDeepStrictEqual(actualFacts, facts)) fail("canonical-package-publisher-facts")

  return {
    argv: createCanonicalPublisherArgs({ dryRun: input.dryRun, distTag: input.distTag, tarballPath }),
    canonicalPackerRuntime: facts.toolchain,
    package: packageIdentity,
    publisherEnvironment,
    publisherRuntime: runtime,
    schemaVersion: CANONICAL_PACKAGE_PUBLISHER_SCHEMA_VERSION,
    status: "passed",
    tarballSha256: facts.tarball.sha256,
  }
}

function readFacts(path) {
  let bytes
  let facts
  try {
    bytes = readFileSync(path)
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_FACTS_BYTES) fail("canonical-package-publisher-facts")
    facts = JSON.parse(bytes.toString("utf8"))
  } catch (error) {
    if (error instanceof CanonicalPackagePublisherError) throw error
    fail("canonical-package-publisher-facts")
  }
  if (!isRecord(facts) || !hasExactKeys(facts, ["package", "schemaVersion", "tarball", "toolchain"])) {
    fail("canonical-package-publisher-facts")
  }
  if (facts.schemaVersion !== "canonical-package-packer.1" || !isRecord(facts.tarball)) fail("canonical-package-publisher-facts")
  return facts
}

function readPackageIdentity(facts) {
  if (!isRecord(facts.package) || !hasExactKeys(facts.package, ["name", "version"])) fail("canonical-package-publisher-facts")
  if (!isSafePackageName(facts.package.name) || !isSafeVersion(facts.package.version)) fail("canonical-package-publisher-facts")
  if (!isRecord(facts.tarball) || !hasExactKeys(facts.tarball, ["contentIdentity", "sha256", "size"])) {
    fail("canonical-package-publisher-facts")
  }
  if (!isSha256(facts.tarball.sha256) || !Number.isSafeInteger(facts.tarball.size) || facts.tarball.size < 1) {
    fail("canonical-package-publisher-facts")
  }
  try {
    assertCanonicalPackagePackerProfile(facts.toolchain)
  } catch {
    fail("canonical-package-publisher-facts")
  }
  return { name: facts.package.name, version: facts.package.version }
}

function assertPublisherEnvironment(value, canonicalDirectory, publisherRuntimeDirectory) {
  if (!isRecord(value) || !hasExactKeys(value, ["HOME", "NPM_CONFIG_CACHE", "NPM_CONFIG_GLOBALCONFIG", "NPM_CONFIG_USERCONFIG"])) {
    fail("canonical-package-publisher-environment")
  }
  const home = readDirectory(value.HOME, "canonical-package-publisher-environment")
  const cache = readDirectory(value.NPM_CONFIG_CACHE, "canonical-package-publisher-environment")
  const globalConfig = readRegularFile(value.NPM_CONFIG_GLOBALCONFIG, "canonical-package-publisher-environment")
  const userConfig = readRegularFile(value.NPM_CONFIG_USERCONFIG, "canonical-package-publisher-environment")
  const values = [home, cache, globalConfig, userConfig]
  if (new Set(values).size !== values.length || values.some((entry) => !isContained(publisherRuntimeDirectory, entry))) {
    fail("canonical-package-publisher-environment")
  }
  if (values.some((entry) => sameOrContained(canonicalDirectory, entry))) fail("canonical-package-publisher-environment")
  if (readFileSync(globalConfig).byteLength !== 0 || readFileSync(userConfig).byteLength !== 0) {
    fail("canonical-package-publisher-environment")
  }
  return { HOME: home, NPM_CONFIG_CACHE: cache, NPM_CONFIG_GLOBALCONFIG: globalConfig, NPM_CONFIG_USERCONFIG: userConfig }
}

function readDirectory(value, code) {
  if (typeof value !== "string" || !isAbsolute(value)) fail(code)
  try {
    const stat = lstatSync(value)
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail(code)
    return realpathSync(value)
  } catch (error) {
    if (error instanceof CanonicalPackagePublisherError) throw error
    fail(code)
  }
}

function readRegularFile(value, code) {
  if (typeof value !== "string" || !isAbsolute(value)) fail(code)
  try {
    const stat = lstatSync(value)
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & constants.S_IFMT) !== constants.S_IFREG) fail(code)
    return realpathSync(value)
  } catch (error) {
    if (error instanceof CanonicalPackagePublisherError) throw error
    fail(code)
  }
}

function readCliArguments(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (typeof key !== "string" || typeof value !== "string" || values.has(key)) fail("canonical-package-publisher-arguments")
    values.set(key, value)
  }
  if (argv.length !== 12 || !isExactSet(values, [
    "--canonical-directory",
    "--dist-tag",
    "--package-facts",
    "--publisher-runtime-directory",
    "--tarball",
    "--dry-run",
  ])) {
    fail("canonical-package-publisher-arguments")
  }
  if (values.get("--dry-run") !== "true") fail("canonical-package-publisher-arguments")
  return {
    canonicalDirectory: values.get("--canonical-directory"),
    distTag: values.get("--dist-tag"),
    dryRun: true,
    packageFactsPath: values.get("--package-facts"),
    publisherRuntimeDirectory: values.get("--publisher-runtime-directory"),
    tarballPath: values.get("--tarball"),
  }
}

function readRuntime() {
  const result = spawnSync("npm", ["--version"], {
    encoding: "utf8",
    env: {
      HOME: process.env.HOME ?? "",
      NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE ?? "",
      NPM_CONFIG_GLOBALCONFIG: process.env.NPM_CONFIG_GLOBALCONFIG ?? "",
      NPM_CONFIG_USERCONFIG: process.env.NPM_CONFIG_USERCONFIG ?? "",
      PATH: process.env.PATH ?? "",
    },
    stdio: ["ignore", "pipe", "ignore"],
  })
  const npm = typeof result.stdout === "string" && result.status === 0 ? result.stdout.trim() : "unavailable"
  return { node: process.versions.node, npm }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function hasExactKeys(value, expected) {
  const actual = Object.keys(value).sort()
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index])
}

function isSafePackageName(value) {
  return typeof value === "string" && /^persona-harness$/u.test(value)
}

function isSafeVersion(value) {
  return typeof value === "string" && /^0\.8\.0-beta\.(?:1[89]|[2-9]\d+)$/u.test(value)
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/u.test(value)
}

function isContained(root, candidate) {
  const relation = relative(resolve(root), resolve(candidate))
  return relation !== "" && !relation.startsWith(`..${sep}`) && !relation.startsWith("..") && !relation.startsWith(sep)
}

function sameOrContained(root, candidate) {
  return resolve(root) === resolve(candidate) || isContained(root, candidate)
}

function isExactSet(values, expected) {
  return values.size === expected.length && expected.every((key) => values.has(key))
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function fail(code) {
  throw new CanonicalPackagePublisherError(code)
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const argumentsValue = readCliArguments(process.argv.slice(2))
    verifyCanonicalPublisherHandoff({
      ...argumentsValue,
      publisherEnvironment: {
        HOME: process.env.HOME,
        NPM_CONFIG_CACHE: process.env.NPM_CONFIG_CACHE,
        NPM_CONFIG_GLOBALCONFIG: process.env.NPM_CONFIG_GLOBALCONFIG,
        NPM_CONFIG_USERCONFIG: process.env.NPM_CONFIG_USERCONFIG,
      },
      publisherRuntime: readRuntime(),
    })
  } catch (error) {
    process.stderr.write(`${error instanceof CanonicalPackagePublisherError ? error.code : "canonical-package-publisher-failed"}\n`)
    process.exitCode = 1
  }
}
