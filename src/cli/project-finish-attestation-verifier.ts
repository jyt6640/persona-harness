import { join } from "node:path"

import { assessSigstoreNodeRuntime } from "../../scripts/node-runtime-floor.mjs"
import { captureNoFollowDirectory } from "../io/no-follow-file.js"
import { personaHarnessVersion } from "./version.js"
import {
  blockedProjectFinishAttestation as blocked,
  hasFreshProjectFinishAttestation,
  matchesCanonicalProjectFinishAttestationJson,
  parseProjectFinishAttestationJson,
  parsedProjectFinishAttestationState,
  trustedProjectFinishAttestation as trusted,
} from "./project-finish-attestation-assessment.js"
import {
  evidenceFromOriginalArtifact,
  readProjectFinishAttestationEvidence,
  resolveSafeProjectRoot,
  type ProjectFinishAttestationEvidence,
} from "./project-finish-attestation-evidence.js"
import { parseProjectFinishAttestationStatement } from "./project-finish-attestation-parser.js"
import { matchProjectFinishAttestationEnrollment } from "./project-finish-attestation-policy.js"
import { runProjectFinishAttestationWorker } from "./project-finish-attestation-worker.js"
import {
  PROJECT_FINISH_ATTESTATION_EVIDENCE_DIRECTORY,
  PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES,
  type ProjectFinishAttestationEnrolledPolicy,
  type ProjectFinishAttestationVerifierAssessment,
  type ProjectFinishAttestationVerifierDiagnostic,
  type ProjectFinishAttestationVerifierState,
} from "./project-finish-attestation-verifier-types.js"
import {
  sha256Digest,
} from "./workflow-finish-attestation-canonical.js"
import {
  captureFinishAttestationWorkspaceDigest,
  consumeFinishAttestation,
  isSafeFinishAttestationDirectory,
  matchesFinishAttestationTerminalRecord,
  readFinishAttestationTerminalRecord,
} from "./workflow-finish-attestation-consumption.js"
import { matchesProjectFinishAttestationSource } from "./project-finish-attestation-source.js"

export {
  PROJECT_FINISH_ATTESTATION_EVIDENCE_DIRECTORY,
  PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES,
} from "./project-finish-attestation-verifier-types.js"
export type {
  ProjectFinishAttestationEnrolledPolicy,
  ProjectFinishAttestationVerifierAssessment,
  ProjectFinishAttestationVerifierDiagnostic,
  ProjectFinishAttestationVerifierState,
} from "./project-finish-attestation-verifier-types.js"
export { matchProjectFinishAttestationEnrollment } from "./project-finish-attestation-policy.js"

export function inspectProjectFinishAttestation(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  now = new Date(),
): ProjectFinishAttestationVerifierAssessment {
  return verifyProjectFinishAttestationInternal(projectDir, enrollment, now, false, true)
}

export function inspectProjectFinishAttestationArtifact(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  archive: Buffer,
  now = new Date(),
): ProjectFinishAttestationVerifierAssessment {
  const evidence = evidenceFromOriginalArtifact(archive)
  return evidence === undefined
    ? blocked("missing", "archive")
    : verifyProjectFinishAttestationInternal(projectDir, enrollment, now, false, true, evidence)
}

export function consumeProjectFinishAttestation(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  now = new Date(),
): ProjectFinishAttestationVerifierAssessment {
  return verifyProjectFinishAttestationInternal(projectDir, enrollment, now, true, false)
}

export function consumeProjectFinishAttestationArtifact(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  archive: Buffer,
  now = new Date(),
): ProjectFinishAttestationVerifierAssessment {
  const evidence = evidenceFromOriginalArtifact(archive)
  return evidence === undefined
    ? blocked("missing", "archive")
    : verifyProjectFinishAttestationInternal(projectDir, enrollment, now, true, false, evidence)
}

export function verifyProjectFinishAttestation(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  now = new Date(),
  options: { readonly consume?: boolean } = {},
): ProjectFinishAttestationVerifierAssessment {
  const consume = options.consume === true
  return verifyProjectFinishAttestationInternal(projectDir, enrollment, now, consume, !consume)
}

function verifyProjectFinishAttestationInternal(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  now: Date,
  consume: boolean,
  allowConsumed: boolean,
  suppliedEvidence?: ProjectFinishAttestationEvidence,
): ProjectFinishAttestationVerifierAssessment {
  if (assessSigstoreNodeRuntime(process.versions.node).status !== "supported") {
    return blocked("runtime-unsupported", "runtime")
  }
  const projectRoot = resolveSafeProjectRoot(projectDir)
  if (projectRoot === undefined) return blocked("missing", "evidence")
  const evidence = suppliedEvidence ?? readProjectFinishAttestationEvidence(projectRoot)
  if (evidence === undefined) return blocked("missing", "evidence")

  const bundleDigest = sha256Digest(evidence.bundleBytes)
  const worker = runProjectFinishAttestationWorker(evidence.bundleBytes)
  if (!worker.ok) return blocked(worker.state, "bundle")
  if (worker.bundleDigest !== bundleDigest) return blocked("binding-mismatch", "bundle")

  const parsed = parseProjectFinishAttestationStatement(worker.statement)
  if (!parsed.ok) return blocked(parsedProjectFinishAttestationState(parsed.diagnostics), "payload")
  const predicate = parseProjectFinishAttestationJson(evidence.predicateBytes)
  const receipt = parseProjectFinishAttestationJson(evidence.receiptBytes)
  if (predicate === undefined || receipt === undefined) return blocked("malformed", "artifact")
  if (
    !matchesCanonicalProjectFinishAttestationJson(
      evidence.predicateBytes,
      predicate,
      parsed.value.predicate,
    )
    || !matchesCanonicalProjectFinishAttestationJson(
      evidence.receiptBytes,
      receipt,
      parsed.value.predicate.receipt,
    )
  ) {
    return blocked("binding-mismatch", "artifact")
  }

  const signedReceipt = parsed.value.predicate.receipt
  const enrollmentMismatch = matchProjectFinishAttestationEnrollment(signedReceipt, enrollment)
  if (enrollmentMismatch !== undefined) return blocked(enrollmentMismatch.code, enrollmentMismatch.path)
  if (!matchesProjectFinishAttestationSource(projectRoot, signedReceipt.source.identity)) {
    return blocked("source-drift", "source")
  }
  if (signedReceipt.phVersion !== personaHarnessVersion()) {
    return blocked("binding-mismatch", "predicate.receipt.phVersion")
  }
  if (!hasFreshProjectFinishAttestation(signedReceipt, now)) {
    return blocked("stale", "predicate.receipt.lifecycle")
  }

  const workspaceIdentityDigest = captureFinishAttestationWorkspaceDigest(projectRoot)
  if (workspaceIdentityDigest === undefined) return blocked("source-drift", "workspace")
  const terminalBinding = {
    attestationId: signedReceipt.lifecycle.finishId,
    bundleDigest,
    expiresAt: signedReceipt.lifecycle.expiresAt,
    finishId: signedReceipt.lifecycle.finishId,
    issuedAt: signedReceipt.lifecycle.issuedAt,
    nonce: signedReceipt.lifecycle.nonce,
    phVersion: signedReceipt.phVersion,
    receiptDigest: parsed.value.predicate.receiptDigest,
    requestId: `${signedReceipt.lifecycle.runId}:${signedReceipt.lifecycle.runAttempt}`,
    runAttempt: signedReceipt.lifecycle.runAttempt,
    runId: signedReceipt.lifecycle.runId,
    sessionId: signedReceipt.lifecycle.sessionId,
    sourceHead: signedReceipt.source.head,
    sourceIdentityDigest: signedReceipt.source.identity.contentDigest,
    workspaceIdentityDigest,
  } as const
  if (!hasSafeOptionalTerminalDirectory(projectRoot)) {
    return blocked("binding-mismatch", "consumption")
  }
  const terminal = readFinishAttestationTerminalRecord(projectRoot)
  if (terminal.state === "invalid") return blocked("binding-mismatch", "consumption")
  if (terminal.state === "present") {
    if (!allowConsumed) return blocked("replayed", "consumption")
    if (Date.parse(terminal.value.consumedAt) > now.getTime()) {
      return blocked("binding-mismatch", "consumption")
    }
    if (!matchesFinishAttestationTerminalRecord(terminal.value, terminalBinding).ok) {
      return blocked("binding-mismatch", "consumption")
    }
    return trusted(signedReceipt, "consumed")
  }
  if (!consume) return trusted(signedReceipt, "unconsumed")

  if (!matchesProjectFinishAttestationSource(projectRoot, signedReceipt.source.identity)) {
    return blocked("source-drift", "source")
  }
  const consumed = consumeFinishAttestation(projectRoot, terminalBinding)
  if (!consumed.ok) {
    return blocked(consumed.code === "replayed-attestation" ? "replayed" : "binding-mismatch", "consumption")
  }
  return trusted(signedReceipt, "consumed")
}

function hasSafeOptionalTerminalDirectory(projectDir: string): boolean {
  const terminalDirectory = join(projectDir, ".persona", "evidence", "finish-attestation")
  const terminal = captureNoFollowDirectory(terminalDirectory)
  return terminal.kind === "absent"
    || (terminal.kind === "ready" && isSafeFinishAttestationDirectory(projectDir))
}
