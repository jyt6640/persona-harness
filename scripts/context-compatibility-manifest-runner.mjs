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
import { join, relative, resolve } from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"

import { assertPackageContentIdentity, readPackageContentIdentity } from "./package-content-identity.mjs"

export const CONTEXT_COMPATIBILITY_MANIFEST_SCHEMA_VERSION = "persona-context-compatibility-manifest.1"
export const CONTEXT_COMPATIBILITY_RESULT_SCHEMA_VERSION = "persona-context-compatibility-result.1"

const SHA256 = /^[0-9a-f]{64}$/u
const REQUIRED_SCENARIOS = Object.freeze([
  "status-default",
  "preview-safe-target",
  "explain-safe-target",
  "init-preview-no-write",
  "init-enable-no-overwrite",
  "invalid-config",
])

export class ContextCompatibilityManifestError extends Error {
  constructor(code) {
    super(code)
    this.code = code
    this.name = "ContextCompatibilityManifestError"
  }
}

export function parseContextCompatibilityManifest(value) {
  const manifest = record(value, "manifest-invalid")
  assertExactKeys(manifest, ["package", "requiredPackagePaths", "scenarios", "schemaVersion", "sourceFallback"], "manifest-invalid")
  if (manifest.schemaVersion !== CONTEXT_COMPATIBILITY_MANIFEST_SCHEMA_VERSION || manifest.sourceFallback !== false) {
    fail("manifest-invalid")
  }

  const packageRecord = record(manifest.package, "manifest-invalid")
  assertExactKeys(packageRecord, ["contentIdentity", "name", "tarballSha256", "version"], "manifest-invalid")
  if (
    typeof packageRecord.name !== "string"
    || packageRecord.name !== "persona-harness"
    || typeof packageRecord.version !== "string"
    || !isPackageVersion(packageRecord.version)
    || typeof packageRecord.tarballSha256 !== "string"
    || !SHA256.test(packageRecord.tarballSha256)
  ) {
    fail("manifest-invalid")
  }

  let contentIdentity
  try {
    contentIdentity = assertPackageContentIdentity(packageRecord.contentIdentity)
  } catch {
    fail("manifest-invalid")
  }

  if (!Array.isArray(manifest.requiredPackagePaths) || manifest.requiredPackagePaths.length === 0) fail("manifest-invalid")
  const requiredPackagePaths = manifest.requiredPackagePaths.map((path) => {
    if (typeof path !== "string" || !isSafePackagePath(path)) fail("manifest-invalid")
    return path
  })
  if (new Set(requiredPackagePaths).size !== requiredPackagePaths.length) fail("manifest-invalid")

  if (!Array.isArray(manifest.scenarios) || manifest.scenarios.length !== REQUIRED_SCENARIOS.length) fail("manifest-invalid")
  const scenarios = manifest.scenarios.map((scenario) => {
    if (typeof scenario !== "string" || !REQUIRED_SCENARIOS.includes(scenario)) fail("manifest-invalid")
    return scenario
  })
  if (!sameStrings(scenarios, REQUIRED_SCENARIOS)) fail("manifest-invalid")

  return Object.freeze({
    package: Object.freeze({
      contentIdentity: Object.freeze(contentIdentity),
      name: packageRecord.name,
      tarballSha256: packageRecord.tarballSha256,
      version: packageRecord.version,
    }),
    requiredPackagePaths: Object.freeze([...requiredPackagePaths]),
    scenarios: Object.freeze([...scenarios]),
    schemaVersion: CONTEXT_COMPATIBILITY_MANIFEST_SCHEMA_VERSION,
    sourceFallback: false,
  })
}

export function runContextCompatibilityManifest(manifestInput, options) {
  let manifest
  try {
    manifest = parseContextCompatibilityManifest(manifestInput)
  } catch (error) {
    if (error instanceof ContextCompatibilityManifestError) return blocked("context-compatibility-manifest-invalid")
    throw error
  }

  const archive = readRegularFile(options?.archivePath)
  if (archive === undefined) return blocked("context-compatibility-archive-unavailable")
  if (sha256(archive) !== manifest.package.tarballSha256) return blocked("context-compatibility-archive-sha256-mismatch")

  let observedIdentity
  try {
    observedIdentity = readPackageContentIdentity(archive)
  } catch {
    return blocked("context-compatibility-archive-invalid")
  }
  if (!sameContentIdentity(manifest.package.contentIdentity, observedIdentity)) {
    return blocked("context-compatibility-content-identity-mismatch")
  }

  const installedPackageRoot = readyDirectory(options?.installedPackageRoot)
  const sourceRoot = readyDirectory(options?.sourceRoot)
  const temporaryRoot = readyDirectory(options?.temporaryRoot)
  if (installedPackageRoot === undefined || sourceRoot === undefined || temporaryRoot === undefined) {
    return blocked("context-compatibility-subject-unavailable")
  }
  if (isInside(sourceRoot, installedPackageRoot)) return blocked("context-compatibility-source-fallback-detected")

  const installedPackage = readInstalledPackage(join(installedPackageRoot, "package.json"))
  if (
    installedPackage === undefined
    || installedPackage.name !== manifest.package.name
    || installedPackage.version !== manifest.package.version
  ) {
    return blocked("context-compatibility-installed-package-mismatch")
  }

  for (const requiredPath of manifest.requiredPackagePaths) {
    const packagePathState = installedPackagePathState(installedPackageRoot, sourceRoot, requiredPath)
    if (packagePathState === "source-fallback") return blocked("context-compatibility-source-fallback-detected")
    if (packagePathState !== "ready") return blocked("context-compatibility-package-path-unavailable")
  }

  const cliPath = join(installedPackageRoot, "dist", "cli", "index.js")
  const cliPathState = installedPackagePathState(installedPackageRoot, sourceRoot, "dist/cli/index.js")
  if (cliPathState === "source-fallback") return blocked("context-compatibility-source-fallback-detected")
  if (cliPathState !== "ready") return blocked("context-compatibility-package-path-unavailable")

  let runnerRoot
  try {
    // macOS commonly exposes its temporary directory through /var, a symlink.
    // Context's private-state guard intentionally rejects symlinked roots, so
    // run every installed CLI scenario below the canonical temporary path.
    runnerRoot = realpathSync(mkdtempSync(join(temporaryRoot, "context-compatibility-runner-")))
    for (const scenario of manifest.scenarios) {
      const result = runScenario(scenario, cliPath, runnerRoot)
      if (result !== undefined) return blocked(result)
    }
    return passed()
  } catch {
    return blocked("context-compatibility-execution-unavailable")
  } finally {
    if (runnerRoot !== undefined) rmSync(runnerRoot, { force: true, recursive: true })
  }
}

function runScenario(scenario, cliPath, runnerRoot) {
  const projectDir = join(runnerRoot, "projects", scenario)
  const stateRoot = join(runnerRoot, "state", scenario)
  mkdirSync(projectDir, { recursive: true })

  if (scenario === "status-default") {
    return commandIncludes(cliPath, ["context", "status"], projectDir, stateRoot, [
      "Configuration: ready",
      "Context enabled: false",
      "Context Core: available",
    ])
  }
  if (scenario === "preview-safe-target") {
    return previewScenario(cliPath, projectDir, stateRoot)
  }
  if (scenario === "explain-safe-target") {
    return commandIncludes(cliPath, ["context", "explain", targetPath()], projectDir, stateRoot, [
      "Context Explanation (Experimental)",
      "Digest: ",
    ])
  }
  if (scenario === "init-preview-no-write") {
    const result = commandIncludes(cliPath, ["context", "init"], projectDir, stateRoot, ["Initialization: preview-only", "No files were written."])
    return result ?? (existsSync(join(projectDir, ".persona")) ? "context-compatibility-init-preview-wrote-state" : undefined)
  }
  if (scenario === "init-enable-no-overwrite") {
    return enableScenario(cliPath, projectDir, stateRoot)
  }
  if (scenario === "invalid-config") {
    mkdirSync(join(projectDir, ".persona"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "harness.jsonc"), '{"context":{"enabled":"invalid"}}\n', { mode: 0o600 })
    return commandIncludes(cliPath, ["context", "status"], projectDir, stateRoot, [
      "Configuration: context-config-invalid",
      "Context enabled: false",
      "Diagnostics: context-config-invalid",
    ])
  }
  return "context-compatibility-manifest-invalid"
}

function previewScenario(cliPath, projectDir, stateRoot) {
  const result = invokeCli(cliPath, ["context", "preview", targetPath(), "--json"], projectDir, stateRoot)
  if (result.status !== 0) return "context-compatibility-command-failed"
  let output
  try {
    output = record(JSON.parse(result.stdout), "execution-output-invalid")
  } catch {
    return "context-compatibility-execution-output-invalid"
  }
  const envelope = recordOrUndefined(output.envelope)
  if (envelope === undefined || envelope.schemaVersion !== "persona-context-envelope.v1" || envelope.status !== "resolved") {
    return "context-compatibility-execution-output-invalid"
  }
  return undefined
}

function enableScenario(cliPath, projectDir, stateRoot) {
  const first = invokeCli(cliPath, ["context", "init", "--enable"], projectDir, stateRoot)
  if (first.status !== 0 || !["Initialization: enabled", "Context enabled: true"].every((fragment) => first.stdout.includes(fragment))) {
    return "context-compatibility-command-failed"
  }

  const configPath = join(projectDir, ".persona", "harness.jsonc")
  const before = readRegularFile(configPath)
  const config = before === undefined ? undefined : readInstalledPackage(configPath)
  if (config === undefined || !isExpectedEnabledContextConfig(config)) return "context-compatibility-init-enable-invalid"

  const second = invokeCli(cliPath, ["context", "init", "--enable"], projectDir, stateRoot)
  const after = readRegularFile(configPath)
  if (
    second.status !== 1
    || second.stdout !== ""
    || second.stderr !== "context-init-existing-config\n"
    || after === undefined
    || !before.equals(after)
  ) {
    return "context-compatibility-init-overwrite"
  }
  return undefined
}

function commandIncludes(cliPath, args, projectDir, stateRoot, fragments) {
  const result = invokeCli(cliPath, args, projectDir, stateRoot)
  if (result.status !== 0) return "context-compatibility-command-failed"
  return fragments.every((fragment) => result.stdout.includes(fragment))
    ? undefined
    : "context-compatibility-execution-output-invalid"
}

function invokeCli(cliPath, args, projectDir, stateRoot) {
  mkdirSync(stateRoot, { mode: 0o700, recursive: true })
  const canonicalStateRoot = realpathSync(stateRoot)
  const home = join(canonicalStateRoot, "home")
  const appData = join(canonicalStateRoot, "appdata")
  const xdgConfig = join(canonicalStateRoot, "xdg-config")
  mkdirSync(home, { mode: 0o700, recursive: true })
  mkdirSync(appData, { mode: 0o700, recursive: true })
  mkdirSync(xdgConfig, { mode: 0o700, recursive: true })
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: projectDir,
    encoding: "utf8",
    env: {
      APPDATA: appData,
      HOME: home,
      PATH: process.env.PATH ?? "",
      PH_HOME: canonicalStateRoot,
      USERPROFILE: home,
      XDG_CONFIG_HOME: xdgConfig,
    },
    maxBuffer: 1024 * 1024,
    timeout: 15_000,
  })
  if (result.error !== undefined || result.status === null) return { status: 1, stderr: "", stdout: "" }
  return { status: result.status, stderr: result.stderr, stdout: result.stdout }
}

function targetPath() {
  return "src/main/java/example/CustomerService.java"
}

function readInstalledPackage(path) {
  const bytes = readRegularFile(path)
  if (bytes === undefined) return undefined
  try {
    return recordOrUndefined(JSON.parse(bytes.toString("utf8")))
  } catch {
    return undefined
  }
}

function isExpectedEnabledContextConfig(value) {
  const context = recordOrUndefined(value.context)
  return context !== undefined
    && context.enabled === true
    && context.maxCapsules === 8
    && context.maxChars === 1600
    && context.mode === "targeted"
    && Object.keys(context).length === 4
    && Object.keys(value).length === 1
}

function sameContentIdentity(expected, observed) {
  try {
    const left = assertPackageContentIdentity(expected)
    const right = assertPackageContentIdentity(observed)
    return left.schemaVersion === right.schemaVersion
      && left.entryCount === right.entryCount
      && left.contentSha256 === right.contentSha256
      && left.identitySha256 === right.identitySha256
      && sameStringRecord(left.modeCounts, right.modeCounts)
  } catch {
    return false
  }
}

function readyDirectory(path) {
  if (typeof path !== "string" || path.length === 0) return undefined
  try {
    const stat = lstatSync(path)
    if (!stat.isDirectory() || stat.isSymbolicLink()) return undefined
    const canonical = realpathSync(path)
    const canonicalStat = lstatSync(canonical)
    return canonicalStat.isDirectory() && !canonicalStat.isSymbolicLink() ? canonical : undefined
  } catch {
    return undefined
  }
}

function readRegularFile(path) {
  if (typeof path !== "string" || path.length === 0) return undefined
  try {
    const stat = lstatSync(path)
    return stat.isFile() && !stat.isSymbolicLink() ? readFileSync(path) : undefined
  } catch {
    return undefined
  }
}

function installedPackagePathState(installedPackageRoot, sourceRoot, relativePath) {
  const candidate = join(installedPackageRoot, relativePath)
  try {
    const direct = lstatSync(candidate)
    if (!direct.isFile() || direct.isSymbolicLink()) return "unavailable"

    const canonical = realpathSync(candidate)
    const resolved = lstatSync(canonical)
    if (!resolved.isFile() || resolved.isSymbolicLink()) return "unavailable"
    if (isInside(sourceRoot, canonical)) return "source-fallback"
    return isInside(installedPackageRoot, canonical) ? "ready" : "unavailable"
  } catch {
    return "unavailable"
  }
}

function isInside(parent, candidate) {
  const path = relative(parent, candidate)
  return path === "" || (path !== ".." && !path.startsWith(`..${process.platform === "win32" ? "\\\\" : "/"}`) && !path.startsWith(".."))
}

function isSafePackagePath(path) {
  if (path.length === 0 || path.length > 240 || path.includes("\\") || path.startsWith("/")) return false
  const segments = path.split("/")
  return segments.every((segment) => segment.length > 0 && segment !== "." && segment !== ".." && !/[\u0000-\u001f\u007f]/u.test(segment))
}

function isPackageVersion(value) {
  return /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/u.test(value)
}

function sameStrings(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function sameStringRecord(left, right) {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b))
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b))
  return leftEntries.length === rightEntries.length
    && leftEntries.every(([key, value], index) => key === rightEntries[index]?.[0] && value === rightEntries[index]?.[1])
}

function record(value, code) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(code)
  return value
}

function recordOrUndefined(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : undefined
}

function assertExactKeys(value, keys, code) {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (!sameStrings(actual, expected)) fail(code)
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function blocked(code) {
  return Object.freeze({ code, schemaVersion: CONTEXT_COMPATIBILITY_RESULT_SCHEMA_VERSION, state: "BLOCKED" })
}

function passed() {
  return Object.freeze({ code: "context-compatibility-valid", schemaVersion: CONTEXT_COMPATIBILITY_RESULT_SCHEMA_VERSION, state: "PASS" })
}

function fail(code) {
  throw new ContextCompatibilityManifestError(code)
}
