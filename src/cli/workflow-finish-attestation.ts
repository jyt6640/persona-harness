import { lstatSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { assessSigstoreNodeRuntime } from "../../scripts/node-runtime-floor.mjs"
import { personaHarnessVersion } from "./version.js"
import { canonicalJson, sha256Digest } from "./workflow-finish-attestation-canonical.js"
import {
  captureFinishAttestationWorkspaceDigest,
  consumeFinishAttestation,
  isSafeFinishAttestationDirectory,
  matchesFinishAttestationTerminalRecord,
  readFinishAttestationTerminalRecord,
} from "./workflow-finish-attestation-consumption.js"
import { parseFinishAttestationStatement } from "./workflow-finish-attestation-parser.js"
import { compareCurrentSource } from "./workflow-finish-attestation-source.js"
import { runFinishAttestationWorker } from "./workflow-finish-attestation-worker.js"
import {
  FINISH_ATTESTATION_BUNDLE_PATH,
  FINISH_ATTESTATION_COMMAND_CATALOG,
  FINISH_ATTESTATION_CONSUMPTION_PATH,
  FINISH_ATTESTATION_POLICY,
  FINISH_ATTESTATION_PREDICATE_TYPE,
  type FinishAttestationAssessment,
  type FinishAttestationDiagnostic,
  type FinishAttestationReceipt,
  type FinishAttestationStatement,
} from "./workflow-finish-attestation-types.js"

const MAX_BUNDLE_BYTES = 16 * 1024 * 1024
const CLOCK_SKEW_MS = 5 * 60 * 1000

export {
  FINISH_ATTESTATION_BUNDLE_PATH,
  FINISH_ATTESTATION_COMMAND_CATALOG,
  FINISH_ATTESTATION_CONSUMPTION_PATH,
  FINISH_ATTESTATION_POLICY,
  FINISH_ATTESTATION_PREDICATE_TYPE,
} from "./workflow-finish-attestation-types.js"
export { consumeFinishAttestation } from "./workflow-finish-attestation-consumption.js"
export { parseFinishAttestationStatement } from "./workflow-finish-attestation-parser.js"
export type {
  FinishAttestationAssessment,
  FinishAttestationDiagnostic,
  FinishAttestationReceipt,
  FinishAttestationStatement,
} from "./workflow-finish-attestation-types.js"

export function verifyExternalFinishAttestation(
  projectDir: string,
  now = new Date(),
  options: { readonly consume?: boolean } = {},
): FinishAttestationAssessment {
  return verifyExternalFinishAttestationInternal(projectDir, now, options, false)
}

export function verifyExternalFinishAttestationForClosure(
  projectDir: string,
  now = new Date(),
): FinishAttestationAssessment {
  return verifyExternalFinishAttestationInternal(projectDir, now, { consume: false }, true)
}

function verifyExternalFinishAttestationInternal(
  projectDir: string,
  now: Date,
  options: { readonly consume?: boolean },
  allowConsumed: boolean,
): FinishAttestationAssessment {
  if (assessSigstoreNodeRuntime(process.versions.node).status !== "supported") {
    return blocked(
      "runtime-unsupported",
      "Node.js does not meet the required Sigstore runtime range; finish authority remains blocked.",
      "runtime",
    )
  }
  const bundlePath = join(projectDir, FINISH_ATTESTATION_BUNDLE_PATH)
  const bundleBytes = readBundleBytes(projectDir, bundlePath)
  if (bundleBytes === undefined) {
    return blocked("missing", "No safe external finish attestation bundle is present.", "bundle")
  }
  const bundleDigest = sha256Digest(bundleBytes)
  const worker = runFinishAttestationWorker(projectDir)
  if (!worker.ok) return blocked(worker.state, worker.message, "bundle")
  if (worker.bundleDigest !== bundleDigest) {
    return blocked("binding-mismatch", "Bundle bytes changed during product-owned verification.", "bundle")
  }
  const parsed = parseFinishAttestationStatement(worker.statement)
  if (!parsed.ok) {
    const state = parsed.diagnostics.some((diagnostic) => diagnostic.code === "wrong-policy")
      ? "wrong-policy"
      : "malformed"
    return blocked(state, parsed.diagnostics[0]?.message ?? "External attestation payload is malformed.", "payload")
  }
  const receipt = parsed.value.predicate.receipt
  const receiptDigest = sha256Digest(Buffer.from(`${canonicalJson(receipt)}\n`))
  if (receiptDigest !== parsed.value.predicate.receiptDigest || receiptDigest !== `sha256:${parsed.value.subject[0].digest.sha256}`) {
    return blocked("binding-mismatch", "Attestation subject digest does not bind canonical receipt bytes.", "subject")
  }
  const sourceDiagnostic = compareCurrentSource(projectDir, receipt.source.identity)
  if (sourceDiagnostic !== undefined) return blocked("source-drift", sourceDiagnostic.message, sourceDiagnostic.path)
  if (receipt.phVersion !== personaHarnessVersion()) {
    return blocked("binding-mismatch", "Attestation PH version does not match the current product.", "predicate.receipt.phVersion")
  }
  const issuedAt = Date.parse(receipt.issuedAt)
  const expiresAt = Date.parse(receipt.expiresAt)
  const nowMs = now.getTime()
  if (!Number.isFinite(issuedAt) || !Number.isFinite(expiresAt) || expiresAt <= nowMs || issuedAt > nowMs + CLOCK_SKEW_MS) {
    return blocked("stale", "External finish attestation is expired or issued outside the accepted clock skew.", "predicate.receipt.lifecycle")
  }
  const workspaceIdentityDigest = captureFinishAttestationWorkspaceDigest(projectDir)
  if (workspaceIdentityDigest === undefined) {
    return blocked("source-drift", "Current workspace identity is unavailable.", "workspace")
  }
  const terminalBinding = {
    attestationId: receipt.finishId,
    bundleDigest,
    expiresAt: receipt.expiresAt,
    finishId: receipt.finishId,
    issuedAt: receipt.issuedAt,
    nonce: receipt.nonce,
    phVersion: receipt.phVersion,
    receiptDigest,
    requestId: `${receipt.runId}:${receipt.runAttempt}`,
    runAttempt: receipt.runAttempt,
    runId: receipt.runId,
    sessionId: receipt.sessionId,
    sourceHead: receipt.source.head,
    sourceIdentityDigest: receipt.source.identity.contentDigest,
    workspaceIdentityDigest,
  } as const
  const terminal = readFinishAttestationTerminalRecord(projectDir)
  let consumptionState: "unconsumed" | "consumed" = "unconsumed"
  if (terminal.state === "invalid") {
    return blocked("binding-mismatch", terminal.message, FINISH_ATTESTATION_CONSUMPTION_PATH)
  }
  if (terminal.state === "present") {
    if (!allowConsumed) {
      return blocked("replayed", "External finish attestation has already been consumed.", FINISH_ATTESTATION_CONSUMPTION_PATH)
    }
    if (Date.parse(terminal.value.consumedAt) > nowMs) {
      return blocked("binding-mismatch", "Finish attestation terminal record was consumed in the future.", FINISH_ATTESTATION_CONSUMPTION_PATH)
    }
    const match = matchesFinishAttestationTerminalRecord(terminal.value, terminalBinding)
    if (!match.ok) {
      return blocked("binding-mismatch", match.message, FINISH_ATTESTATION_CONSUMPTION_PATH)
    }
    consumptionState = "consumed"
  }
  if (options.consume !== false && terminal.state === "missing") {
    const consumed = consumeFinishAttestation(projectDir, terminalBinding)
    if (!consumed.ok) {
      return blocked(
        consumed.code === "replayed-attestation" ? "replayed" : "binding-mismatch",
        consumed.message,
        FINISH_ATTESTATION_CONSUMPTION_PATH,
      )
    }
    consumptionState = "consumed"
  }
  return {
    authorityEligible: true,
    consumptionState,
    decision: "trusted",
    diagnostics: [],
    receipt,
    state: "trusted",
    summary: "Signed protected-main finish attestation passed product-owned Sigstore, policy, source, freshness, and replay checks.",
  }
}

function readBundleBytes(projectDir: string, path: string): Buffer | undefined {
  try {
    if (!isSafeFinishAttestationDirectory(projectDir)) return undefined
    const stat = lstatSync(path)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_BUNDLE_BYTES) return undefined
    const bytes = readFileSync(path)
    return bytes.byteLength <= MAX_BUNDLE_BYTES ? bytes : undefined
  } catch {
    return undefined
  }
}

function blocked(
  state: Exclude<FinishAttestationAssessment["state"], "trusted">,
  message: string,
  path: string,
): FinishAttestationAssessment {
  return {
    authorityEligible: false,
    consumptionState: "not-applicable",
    decision: "blocked",
    diagnostics: [{ code: state === "replayed" ? "replayed-attestation" : state, message, path }],
    state,
    summary: message,
  }
}
