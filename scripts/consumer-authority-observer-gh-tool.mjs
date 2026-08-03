import { spawnSync } from "node:child_process"
import { lstatSync } from "node:fs"
import { isAbsolute } from "node:path"
import { isDeepStrictEqual } from "node:util"

const TOOL_SCHEMA_VERSION = "consumer-authority-observer-gh-tool.2"
const VERSION_TIMEOUT_MS = 5_000
const VERSION_MAX_OUTPUT_BYTES = 4 * 1024
const VERSION = /^gh version (\d+)\.(\d+)\.(\d+)(?:\s|$)/mu

const EXPECTED_TOOL_CONTRACT = Object.freeze({
  executable: "workflow-selected-absolute-regular-non-symlink",
  invocation: "direct-exec-no-shell-no-path-lookup",
  output: "bounded-version-classification-only",
  provisioning: "workflow-owned-runner-package-record-to-private-regular-copy",
  schemaVersion: TOOL_SCHEMA_VERSION,
  version: ">=2.96.0 <3.0.0",
})

export const OBSERVER_GH_TOOL_SCHEMA_VERSION = TOOL_SCHEMA_VERSION

export class ObserverGhToolError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}

export function canonicalObserverGhToolContract() {
  return structuredClone(EXPECTED_TOOL_CONTRACT)
}

export function parseObserverGhToolContract(value) {
  if (!isDeepStrictEqual(value, EXPECTED_TOOL_CONTRACT)) fail()
  return value
}

export function assessObserverGhTool(ghPath, options = {}) {
  parseObserverGhToolContract(options.contract ?? EXPECTED_TOOL_CONTRACT)
  if (typeof ghPath !== "string" || ghPath.length === 0) return blocked("gh-command-tool-required")
  if (!isAbsolute(ghPath) || ghPath.includes("\0") || ghPath.length > 4096) return blocked("gh-command-tool-invalid")

  try {
    const stat = lstatSync(ghPath)
    if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o111) === 0) {
      return blocked("gh-command-tool-invalid")
    }
  } catch (error) {
    return blocked(isMissingPathError(error) ? "gh-command-unavailable" : "gh-command-tool-invalid")
  }

  const execute = typeof options.execute === "function" ? options.execute : spawnSync
  let result
  try {
    result = execute(ghPath, ["--version"], {
      encoding: "utf8",
      env: noTokenEnvironment(),
      maxBuffer: VERSION_MAX_OUTPUT_BYTES,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      timeout: VERSION_TIMEOUT_MS,
    })
  } catch {
    return blocked("gh-command-unavailable")
  }
  if (result?.error !== undefined || result?.status !== 0) return blocked("gh-command-unavailable")
  if (!isCompatibleVersion(result?.stdout)) return blocked("gh-command-version-unsupported")
  return { code: "gh-command-tool-ready", state: "ready" }
}

function noTokenEnvironment() {
  return {
    GH_PROMPT_DISABLED: "1",
    LANG: "C",
    LC_ALL: "C",
    NO_COLOR: "1",
  }
}

function isCompatibleVersion(value) {
  if (typeof value !== "string" || value.length > VERSION_MAX_OUTPUT_BYTES) return false
  const match = VERSION.exec(value)
  if (match === null) return false
  const [, major, minor, patch] = match
  const numericMajor = Number(major)
  const numericMinor = Number(minor)
  const numericPatch = Number(patch)
  if (!Number.isSafeInteger(numericMajor) || !Number.isSafeInteger(numericMinor) || !Number.isSafeInteger(numericPatch)) return false
  return numericMajor === 2 && numericMinor >= 96
}

function isMissingPathError(error) {
  return error !== null
    && typeof error === "object"
    && "code" in error
    && error.code === "ENOENT"
}

function blocked(code) {
  return { code, state: "blocked" }
}

function fail() {
  throw new ObserverGhToolError("observer-gh-tool-contract")
}
