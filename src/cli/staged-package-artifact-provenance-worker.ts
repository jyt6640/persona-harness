import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import {
  STAGED_PACKAGE_ARTIFACT_CHANNELS,
  STAGED_PACKAGE_ARTIFACT_PROVENANCE_SCHEMA,
  type StagedPackageArtifactProvenanceResult,
  type StagedPackageArtifactSelection,
} from "./staged-package-artifact-provenance-types.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/verify-staged-package-artifact-attestation.mjs", import.meta.url))
const WORKER_TIMEOUT_MS = 120_000
const MAX_WORKER_OUTPUT_BYTES = 2 * 1024 * 1024

export function runStagedPackageArtifactProvenanceWorker(
  selection: StagedPackageArtifactSelection,
): StagedPackageArtifactProvenanceResult {
  const result = spawnSync(process.execPath, [WORKER_PATH, "--channel", selection.channel, "--version", selection.version], {
    encoding: "utf8",
    env: fixedWorkerEnvironment(),
    maxBuffer: MAX_WORKER_OUTPUT_BYTES,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: WORKER_TIMEOUT_MS,
  })
  if (result.error !== undefined || typeof result.stdout !== "string" || result.stdout.length === 0) {
    return blocked(selection, "artifact-provenance-unavailable")
  }
  try {
    const output: unknown = JSON.parse(result.stdout)
    return isResult(output, selection) ? output : blocked(selection, "artifact-provenance-invalid")
  } catch {
    return blocked(selection, "artifact-provenance-invalid")
  }
}

export function blocked(
  selection: StagedPackageArtifactSelection,
  diagnostic: string,
): StagedPackageArtifactProvenanceResult {
  return {
    authorityEligible: false,
    channel: selection.channel,
    diagnostics: [diagnostic],
    mode: "read-only",
    promotionAuthorized: false,
    promotionDecision: "release-approval-required",
    registryMutation: "not-performed",
    schemaVersion: STAGED_PACKAGE_ARTIFACT_PROVENANCE_SCHEMA,
    verificationStatus: "blocked",
    version: selection.version,
  }
}

function isResult(
  value: unknown,
  selection: StagedPackageArtifactSelection,
): value is StagedPackageArtifactProvenanceResult {
  if (!isRecord(value) || !hasResultKeys(value)) {
    return false
  }
  return value.authorityEligible === false
    && value.channel === selection.channel
    && Array.isArray(value.diagnostics)
    && value.diagnostics.every(isBoundedCode)
    && value.mode === "read-only"
    && value.promotionAuthorized === false
    && value.promotionDecision === "release-approval-required"
    && value.registryMutation === "not-performed"
    && value.schemaVersion === STAGED_PACKAGE_ARTIFACT_PROVENANCE_SCHEMA
    && value.version === selection.version
    && (value.verificationStatus === "blocked" || value.verificationStatus === "verified")
    && (value.sourceHead === undefined || isCommit(value.sourceHead))
    && (value.subjectDigest === undefined || isDigest(value.subjectDigest))
    && (value.verificationStatus !== "verified" || (value.diagnostics.length === 0 && isCommit(value.sourceHead) && isDigest(value.subjectDigest)))
}

function hasResultKeys(value: Readonly<Record<string, unknown>>): boolean {
  const common = ["authorityEligible", "channel", "diagnostics", "mode", "promotionAuthorized", "promotionDecision", "registryMutation", "schemaVersion", "verificationStatus", "version"]
  if (value.verificationStatus === "verified") {
    return exactKeys(value, [...common, "sourceHead", "subjectDigest"])
  }
  return exactKeys(value, common)
}

function fixedWorkerEnvironment(): NodeJS.ProcessEnv {
  const allowed = new Set(["HOME", "LANG", "LC_ALL", "PATH", "SystemRoot", "TEMP", "TMP", "TMPDIR"])
  return Object.fromEntries(
    Object.entries(process.env).filter(([key, value]) => allowed.has(key) && value !== undefined),
  )
}

function exactKeys(value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean {
  const expected = new Set(keys)
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => expected.has(key))
}

function isBoundedCode(value: unknown): value is string {
  return typeof value === "string" && /^artifact-provenance-[a-z-]+$/u.test(value)
}

function isCommit(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/u.test(value)
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/u.test(value)
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
