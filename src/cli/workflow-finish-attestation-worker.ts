import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { isDigest, isRecord, isString } from "./workflow-finish-attestation-receipt-fields.js"
import type { FinishAttestationWorkerResult } from "./workflow-finish-attestation-types.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/verify-finish-attestation.mjs", import.meta.url))
const WORKER_TIMEOUT_MS = 120_000
const MAX_WORKER_OUTPUT_BYTES = 2 * 1024 * 1024

/**
 * Cryptographic verification is a pure function of the bundle bytes: the worker
 * reads only `.persona/evidence/finish-attestation/bundle.json` and returns the
 * signature, certificate, and transparency verdict for exactly those bytes.
 *
 * A single `workflow finish` reaches this through two independent
 * non-consuming paths — `readWorkflowStatus` and `readWorkflowClosureState` —
 * and each spawn costs roughly 600ms, so the same bytes were verified twice per
 * invocation. Keying on the digest collapses that without weakening anything:
 * different bytes are a different key, so a replaced bundle is always verified
 * afresh.
 *
 * Everything that depends on time or state — expiry, source drift, PH version,
 * consumption — is evaluated by the caller outside this cache, per call.
 */
const workerResultsByBundleDigest = new Map<string, FinishAttestationWorkerResult>()
const MAX_CACHED_WORKER_RESULTS = 8

export function runFinishAttestationWorker(
  projectDir: string,
  bundleDigest?: string,
): FinishAttestationWorkerResult {
  if (bundleDigest !== undefined) {
    const cached = workerResultsByBundleDigest.get(bundleDigest)
    if (cached !== undefined) {
      return cached
    }
  }
  const result = runFinishAttestationWorkerUncached(projectDir)
  if (bundleDigest !== undefined) {
    if (workerResultsByBundleDigest.size >= MAX_CACHED_WORKER_RESULTS) {
      const oldest = workerResultsByBundleDigest.keys().next().value
      if (oldest !== undefined) {
        workerResultsByBundleDigest.delete(oldest)
      }
    }
    workerResultsByBundleDigest.set(bundleDigest, result)
  }
  return result
}

/** Drops cached verdicts. Tests use this to prove the cache is keyed, not sticky. */
export function clearFinishAttestationWorkerCache(): void {
  workerResultsByBundleDigest.clear()
}

function runFinishAttestationWorkerUncached(projectDir: string): FinishAttestationWorkerResult {
  const result = spawnSync(process.execPath, [WORKER_PATH], {
    cwd: projectDir,
    encoding: "utf8",
    env: fixedWorkerEnvironment(),
    maxBuffer: MAX_WORKER_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: WORKER_TIMEOUT_MS,
  })
  if (result.error !== undefined || typeof result.stdout !== "string" || result.stdout.length === 0) {
    return {
      message: "Product-owned Sigstore verification failed or was unavailable; finish authority remains blocked.",
      ok: false,
      state: "crypto-failed",
    }
  }
  try {
    const output: unknown = JSON.parse(result.stdout)
    if (!isRecord(output) || typeof output.ok !== "boolean") {
      return {
        message: "Product-owned verifier returned an invalid result.",
        ok: false,
        state: "malformed",
      }
    }
    if (output.ok === false && output.state === "runtime-unsupported") {
      return {
        message: "Node.js does not meet the required Sigstore runtime range; finish authority remains blocked.",
        ok: false,
        state: "runtime-unsupported",
      }
    }
    if (result.status !== 0 || output.ok !== true || !isString(output.bundleDigest) || !isDigest(output.bundleDigest) || !("statement" in output)) {
      return {
        message: "Product-owned verifier returned an invalid result.",
        ok: false,
        state: "malformed",
      }
    }
    return {
      bundleDigest: output.bundleDigest,
      ok: true,
      statement: output.statement,
    }
  } catch {
    return {
      message: "Product-owned verifier output was not valid JSON.",
      ok: false,
      state: "malformed",
    }
  }
}

function fixedWorkerEnvironment(): NodeJS.ProcessEnv {
  const allowed = new Set(["HOME", "LANG", "LC_ALL", "PATH", "SystemRoot", "TEMP", "TMP", "TMPDIR"])
  return Object.fromEntries(
    Object.entries(process.env).filter(([key, value]) => allowed.has(key) && value !== undefined),
  )
}
