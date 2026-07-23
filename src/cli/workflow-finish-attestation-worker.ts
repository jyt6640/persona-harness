import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { isDigest, isRecord, isString } from "./workflow-finish-attestation-receipt-fields.js"
import type { FinishAttestationWorkerResult } from "./workflow-finish-attestation-types.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/verify-finish-attestation.mjs", import.meta.url))
const WORKER_TIMEOUT_MS = 120_000
const MAX_WORKER_OUTPUT_BYTES = 2 * 1024 * 1024

export function runFinishAttestationWorker(projectDir: string): FinishAttestationWorkerResult {
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
