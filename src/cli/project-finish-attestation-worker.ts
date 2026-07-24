import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

import { isDigest, isRecord, isString } from "./workflow-finish-attestation-receipt-fields.js"
import type {
  ProjectFinishAttestationWorkerResult,
  ProjectFinishTrustReadinessWorkerResult,
} from "./project-finish-attestation-verifier-types.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/verify-project-finish-attestation.mjs", import.meta.url))
const WORKER_TIMEOUT_MS = 30_000
const MAX_WORKER_OUTPUT_BYTES = 2 * 1024 * 1024

export function runProjectFinishAttestationWorker(bundleBytes: Buffer): ProjectFinishAttestationWorkerResult {
  const result = safelyRunWorker([], bundleBytes)
  if (result === undefined) return { ok: false, state: "trust-root-unavailable" }
  if (hasErrorCode(result.error, "ETIMEDOUT")) {
    return { ok: false, state: "verification-timeout" }
  }
  if (typeof result.stdout !== "string" || result.stdout.length === 0) {
    return { ok: false, state: "crypto-failed" }
  }
  try {
    const output: unknown = JSON.parse(result.stdout)
    if (!isRecord(output) || typeof output.ok !== "boolean") return { ok: false, state: "malformed" }
    if (output.ok === true) {
      if (!isString(output.bundleDigest) || !isDigest(output.bundleDigest) || !("statement" in output)) {
        return { ok: false, state: "malformed" }
      }
      return { bundleDigest: output.bundleDigest, ok: true, statement: output.statement }
    }
    return isWorkerFailureState(output.state)
      ? { ok: false, state: output.state }
      : { ok: false, state: "malformed" }
  } catch {
    return { ok: false, state: "malformed" }
  }
}

export function runProjectFinishTrustReadinessWorker(): ProjectFinishTrustReadinessWorkerResult {
  const result = safelyRunWorker(["--trust-readiness"])
  if (result === undefined) return { ok: false, state: "trust-root-unavailable" }
  if (hasErrorCode(result.error, "ETIMEDOUT")) {
    return { ok: false, state: "verification-timeout" }
  }
  if (typeof result.stdout !== "string" || result.stdout.length === 0) {
    return { ok: false, state: "trust-root-unavailable" }
  }
  try {
    const output: unknown = JSON.parse(result.stdout)
    if (!isRecord(output) || typeof output.ok !== "boolean") {
      return { ok: false, state: "trust-root-unavailable" }
    }
    if (output.ok === true) return output.state === "ready"
      ? { ok: true }
      : { ok: false, state: "trust-root-unavailable" }
    return isTrustReadinessFailureState(output.state)
      ? { ok: false, state: output.state }
      : { ok: false, state: "trust-root-unavailable" }
  } catch {
    return { ok: false, state: "trust-root-unavailable" }
  }
}

function safelyRunWorker(
  args: readonly string[],
  input?: Buffer,
): ReturnType<typeof runWorker> | undefined {
  try {
    return runWorker(args, input)
  } catch {
    return undefined
  }
}

function runWorker(args: readonly string[], input?: Buffer) {
  const cachePath = mkdtempSync(join(tmpdir(), "persona-harness-project-finish-sigstore-"))
  try {
    return spawnSync(process.execPath, [WORKER_PATH, ...args], {
      encoding: "utf8",
      env: fixedWorkerEnvironment(cachePath),
      input,
      maxBuffer: MAX_WORKER_OUTPUT_BYTES,
      shell: false,
      stdio: ["pipe", "pipe", "ignore"],
      timeout: WORKER_TIMEOUT_MS,
    })
  } finally {
    rmSync(cachePath, { force: true, recursive: true })
  }
}

function isWorkerFailureState(
  value: unknown,
): value is Extract<ProjectFinishAttestationWorkerResult, { readonly ok: false }>["state"] {
  return value === "certificate-invalid"
    || value === "crypto-failed"
    || value === "dns-unavailable"
    || value === "malformed"
    || value === "malformed-bundle"
    || value === "network-unavailable"
    || value === "runtime-unsupported"
    || value === "signature-invalid"
    || value === "transparency-invalid"
    || value === "trust-root-unavailable"
    || value === "verification-timeout"
}

function hasErrorCode(error: unknown, code: string): boolean {
  return isRecord(error) && error.code === code
}

function isTrustReadinessFailureState(
  value: unknown,
): value is Extract<ProjectFinishTrustReadinessWorkerResult, { readonly ok: false }>["state"] {
  return value === "dns-unavailable"
    || value === "network-unavailable"
    || value === "runtime-unsupported"
    || value === "trust-root-unavailable"
    || value === "verification-timeout"
}

function fixedWorkerEnvironment(cachePath: string): NodeJS.ProcessEnv {
  const fixed = {
    LANG: "C",
    LC_ALL: "C",
    PH_PROJECT_FINISH_SIGSTORE_CACHE_PATH: cachePath,
  }
  if (process.platform === "win32" && process.env.SystemRoot !== undefined) {
    return { ...fixed, SystemRoot: process.env.SystemRoot }
  }
  return fixed
}
