import { existsSync, lstatSync, mkdirSync, openSync, closeSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { spawnSync } from "node:child_process"

import { captureGitIdentity, captureWorkspaceIdentity } from "./ci-reverification-identity.js"
import { captureSourceIdentity, sameSourceIdentity } from "./source-identity.js"
import { personaHarnessVersion } from "./version.js"
import { canonicalJson, sha256Digest } from "./workflow-finish-attestation-canonical.js"
import { parseFinishAttestationStatement } from "./workflow-finish-attestation-parser.js"
import {
  FINISH_ATTESTATION_BUNDLE_PATH,
  FINISH_ATTESTATION_CONSUMPTION_PATH,
  type FinishAttestationAssessment,
  type FinishAttestationDiagnostic,
} from "./workflow-finish-attestation-types.js"

export {
  FINISH_ATTESTATION_COMMAND_CATALOG,
  FINISH_ATTESTATION_BUNDLE_PATH,
  FINISH_ATTESTATION_CONSUMPTION_PATH,
  FINISH_ATTESTATION_POLICY,
  FINISH_ATTESTATION_PREDICATE_TYPE,
} from "./workflow-finish-attestation-types.js"
export { parseFinishAttestationStatement } from "./workflow-finish-attestation-parser.js"
export type {
  FinishAttestationAssessment,
  FinishAttestationDiagnostic,
  FinishAttestationPolicy,
  FinishAttestationReceipt,
  FinishAttestationStatement,
} from "./workflow-finish-attestation-types.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/verify-finish-attestation.mjs", import.meta.url))
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024
const WORKER_TIMEOUT_MS = 120_000
const MAX_WORKER_OUTPUT_BYTES = 2 * 1024 * 1024
const CLOCK_SKEW_MS = 5 * 60 * 1000
const trustedAttestationCache = new Map<string, { readonly mtimeMs: number; readonly result: FinishAttestationAssessment; readonly size: number }>()

export function verifyExternalFinishAttestation(
  projectDir: string,
  now = new Date(),
  options: { readonly consume?: boolean } = {},
): FinishAttestationAssessment {
  const bundlePath = join(projectDir, FINISH_ATTESTATION_BUNDLE_PATH)
  if (!existsSync(bundlePath)) return blocked("missing", "No external finish attestation bundle is present.", "bundle")
  const bundleStat = safeBundleStat(bundlePath)
  if (bundleStat === undefined || bundleStat.size > MAX_BUNDLE_BYTES) {
    return blocked("malformed", "External finish attestation bundle is missing, unsafe, or exceeds the bounded size.", "bundle")
  }
  const cached = trustedAttestationCache.get(projectDir)
  if (cached !== undefined && cached.mtimeMs === bundleStat.mtimeMs && cached.size === bundleStat.size) {
    return cached.result
  }
  const worker = runVerifierWorker(projectDir)
  if (!worker.ok) return blocked(worker.state, worker.message, "bundle")
  const parsed = parseFinishAttestationStatement(worker.statement)
  if (!parsed.ok) return blocked("malformed", parsed.diagnostics[0]?.message ?? "External attestation payload is malformed.", "payload")
  const receipt = parsed.value.predicate.receipt
  const receiptBytes = Buffer.from(`${canonicalJson(receipt)}\n`)
  const receiptDigest = sha256Digest(receiptBytes)
  if (receiptDigest !== parsed.value.predicate.receiptDigest || receiptDigest !== `sha256:${parsed.value.subject[0].digest.sha256}`) {
    return blocked("wrong-policy", "Attestation subject digest does not bind the canonical receipt bytes.", "subject")
  }
  const sourceDiagnostic = compareCurrentSource(projectDir, receipt.source.identity)
  if (sourceDiagnostic !== undefined) return blocked("source-drift", sourceDiagnostic.message, sourceDiagnostic.path)
  if (receipt.phVersion !== personaHarnessVersion()) {
    return blocked("binding-mismatch", "Attestation PH version does not match the current product.", "predicate.receipt.phVersion")
  }
  const issuedAt = Date.parse(receipt.issuedAt)
  const expiresAt = Date.parse(receipt.expiresAt)
  const nowMs = now.getTime()
  if (expiresAt <= nowMs || issuedAt > nowMs + CLOCK_SKEW_MS) {
    return blocked("stale", "External finish attestation is expired or issued outside the accepted clock skew.", "predicate.receipt.lifecycle")
  }
  if (options.consume !== false) {
    const consumed = consumeFinishAttestation(projectDir, receipt.finishId, receipt.nonce, `${receipt.runId}:${receipt.runAttempt}`)
    if (!consumed.ok) return blocked("replayed", consumed.message, FINISH_ATTESTATION_CONSUMPTION_PATH)
  }
  const trusted: FinishAttestationAssessment = {
    authorityEligible: true,
    decision: "trusted",
    diagnostics: [],
    receipt,
    state: "trusted",
    summary: "Signed canonical-main finish attestation passed product-owned Sigstore, policy, source, freshness, and replay checks.",
  }
  if (options.consume !== false) {
    trustedAttestationCache.set(projectDir, { mtimeMs: bundleStat.mtimeMs, result: trusted, size: bundleStat.size })
  }
  return trusted
}

export function consumeFinishAttestation(
  projectDir: string,
  attestationId: string,
  nonce: string,
  requestId: string,
): { readonly ok: true } | { readonly code: "replayed-attestation"; readonly message: string; readonly ok: false } {
  const path = join(projectDir, FINISH_ATTESTATION_CONSUMPTION_PATH)
  mkdirSync(join(projectDir, ".persona", "evidence", "finish-attestation"), { recursive: true })
  let descriptor: number
  try {
    descriptor = openSync(path, "wx", 0o600)
  } catch (error) {
    if (isAlreadyExists(error)) {
      return { code: "replayed-attestation", message: "External finish attestation has already been consumed.", ok: false }
    }
    throw error
  }
  try {
    writeFileSync(descriptor, `${JSON.stringify({ attestationId, consumedAt: new Date().toISOString(), nonce, requestId })}\n`)
  } finally {
    closeSync(descriptor)
  }
  return { ok: true }
}

function compareCurrentSource(
  projectDir: string,
  expected: Parameters<typeof sameSourceIdentity>[0],
): FinishAttestationDiagnostic | undefined {
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") return { code: "source-drift", message: "Current workspace identity is unavailable.", path: "workspace" }
  const git = captureGitIdentity(projectDir, workspace.value)
  const source = captureSourceIdentity(projectDir, git, ".persona/evidence")
  if (source.status !== "available" || !sameSourceIdentity(source.value, expected)) {
    return { code: "source-drift", message: "Current source identity does not match the signed canonical-main source snapshot.", path: "source" }
  }
  return undefined
}

function runVerifierWorker(projectDir: string): { readonly ok: true; readonly statement: unknown } | { readonly ok: false; readonly message: string; readonly state: "crypto-failed" | "malformed" | "stale" } {
  const result = spawnSync(process.execPath, [WORKER_PATH], {
    cwd: projectDir,
    encoding: "utf8",
    env: workerEnvironment(),
    maxBuffer: MAX_WORKER_OUTPUT_BYTES,
    shell: false,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: WORKER_TIMEOUT_MS,
  })
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== "string" || result.stdout.length === 0) {
    return { message: "Product-owned Sigstore verification failed or was unavailable; finish authority remains blocked.", ok: false, state: "crypto-failed" }
  }
  try {
    const output: unknown = JSON.parse(result.stdout)
    if (!isRecord(output) || output.ok !== true || !("statement" in output)) {
      return { message: "Product-owned verifier returned an invalid result.", ok: false, state: "malformed" }
    }
    return { ok: true, statement: output.statement }
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { message: "Product-owned verifier output was not valid JSON.", ok: false, state: "malformed" }
    }
    throw error
  }
}

function safeBundleStat(path: string): { readonly mtimeMs: number; readonly size: number } | undefined {
  try {
    const stat = lstatSync(path)
    return stat.isFile() && !stat.isSymbolicLink() ? { mtimeMs: stat.mtimeMs, size: stat.size } : undefined
  } catch {
    return undefined
  }
}

function workerEnvironment(): NodeJS.ProcessEnv {
  const allowed = new Set(["HOME", "LANG", "LC_ALL", "PATH", "TMPDIR", "SystemRoot", "TEMP", "TMP"])
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key)))
}

function isAlreadyExists(error: unknown): boolean {
  return isRecord(error) && error.code === "EEXIST"
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function blocked(
  state: Exclude<FinishAttestationAssessment["state"], "trusted">,
  message: string,
  path: string,
): FinishAttestationAssessment {
  return {
    authorityEligible: false,
    decision: "blocked",
    diagnostics: [{ code: state === "replayed" ? "replayed-attestation" : state, message, path }],
    state,
    summary: message,
  }
}
