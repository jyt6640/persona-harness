import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { isDigest, isRecord, isString } from "./workflow-finish-attestation-receipt-fields.js"
import type {
  ProjectFinishAttestationWorkerResult,
} from "./project-finish-attestation-verifier-types.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/verify-project-finish-attestation.mjs", import.meta.url))
const WORKER_TIMEOUT_MS = 120_000
const MAX_WORKER_OUTPUT_BYTES = 2 * 1024 * 1024

export function runProjectFinishAttestationWorker(bundleBytes: Buffer): ProjectFinishAttestationWorkerResult {
  const result = spawnSync(process.execPath, [WORKER_PATH], {
    encoding: "utf8",
    env: fixedWorkerEnvironment(),
    input: bundleBytes,
    maxBuffer: MAX_WORKER_OUTPUT_BYTES,
    shell: false,
    stdio: ["pipe", "pipe", "ignore"],
    timeout: WORKER_TIMEOUT_MS,
  })
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
    if (
      output.state === "crypto-failed"
      || output.state === "malformed"
      || output.state === "network-unavailable"
      || output.state === "runtime-unsupported"
    ) {
      return { ok: false, state: output.state }
    }
    return { ok: false, state: "malformed" }
  } catch {
    return { ok: false, state: "malformed" }
  }
}

function fixedWorkerEnvironment(): NodeJS.ProcessEnv {
  if (process.platform === "win32" && process.env.SystemRoot !== undefined) {
    return { LANG: "C", LC_ALL: "C", SystemRoot: process.env.SystemRoot }
  }
  return { LANG: "C", LC_ALL: "C" }
}
