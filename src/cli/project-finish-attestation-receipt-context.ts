import { parseSourceIdentity } from "./source-identity-types.js"
import {
  PROJECT_FINISH_ATTESTATION_MAX_FRESHNESS_MS,
  PROJECT_FINISH_ATTESTATION_POLICY,
  type ProjectFinishAttestationDiagnostic,
  type ProjectFinishAttestationReceipt,
} from "./project-finish-attestation-types.js"
import {
  exactKeys,
  isCommit,
  isIdentifier,
  isPositiveInteger,
  isRecord,
  isString,
} from "./workflow-finish-attestation-receipt-fields.js"

export function readProjectFinishAttestationRepository(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt["repository"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["id", "slug", "visibility"])
    || !isPositiveInteger(value.id)
    || !isPublicRepositorySlug(value.slug)
    || value.visibility !== "public"
  ) {
    diagnostics.push(wrong("predicate.receipt.repository"))
    return undefined
  }
  return { id: value.id, slug: value.slug, visibility: "public" }
}

export function readProjectFinishAttestationSource(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt["source"] | undefined {
  if (!isRecord(value) || !exactKeys(value, ["head", "identity", "root"]) || value.root !== "." || !isCommit(value.head)) {
    diagnostics.push(wrong("predicate.receipt.source"))
    return undefined
  }
  const identity = parseSourceIdentity(value.identity)
  if (identity === undefined || identity.repositoryHead !== value.head) {
    diagnostics.push(wrong("predicate.receipt.source"))
    return undefined
  }
  return { head: value.head, identity, root: "." }
}

export function readProjectFinishAttestationProject(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt["project"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["root", "scope"])
    || value.root !== "."
    || value.scope !== PROJECT_FINISH_ATTESTATION_POLICY.projectScope
  ) {
    diagnostics.push(wrong("predicate.receipt.project"))
    return undefined
  }
  return { root: ".", scope: PROJECT_FINISH_ATTESTATION_POLICY.projectScope }
}

export function readProjectFinishAttestationLifecycle(
  value: unknown,
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt["lifecycle"] | undefined {
  if (
    !isRecord(value)
    || !exactKeys(value, ["attemptId", "expiresAt", "finishId", "issuedAt", "nonce", "runAttempt", "runId", "sessionId"])
    || !isIdentifier(value.attemptId)
    || !isIdentifier(value.finishId)
    || !isIdentifier(value.nonce)
    || !isPositiveInteger(value.runAttempt)
    || !isIdentifier(value.runId)
    || !isIdentifier(value.sessionId)
    || !isTimestamp(value.issuedAt)
    || !isTimestamp(value.expiresAt)
  ) {
    diagnostics.push(invalid("predicate.receipt.lifecycle"))
    return undefined
  }
  const issuedAt = Date.parse(value.issuedAt)
  const expiresAt = Date.parse(value.expiresAt)
  if (
    expiresAt <= issuedAt
    || expiresAt - issuedAt > PROJECT_FINISH_ATTESTATION_MAX_FRESHNESS_MS
    || value.attemptId !== `project-finish-attempt-${value.runId}-${value.runAttempt}`
    || value.finishId !== `project-finish-finish-${value.runId}-${value.runAttempt}`
    || value.nonce !== `project-finish-${value.runId}-${value.runAttempt}`
    || value.sessionId !== `project-finish-session-${value.runId}-${value.runAttempt}`
  ) {
    diagnostics.push(wrong("predicate.receipt.lifecycle"))
    return undefined
  }
  return {
    attemptId: value.attemptId,
    expiresAt: value.expiresAt,
    finishId: value.finishId,
    issuedAt: value.issuedAt,
    nonce: value.nonce,
    runAttempt: value.runAttempt,
    runId: value.runId,
    sessionId: value.sessionId,
  }
}

export function readProjectFinishAttestationWorkflow(
  value: unknown,
  binding: {
    readonly lifecycle: ProjectFinishAttestationReceipt["lifecycle"]
    readonly repositorySlug: string
    readonly sourceHead: string
  },
  diagnostics: ProjectFinishAttestationDiagnostic[],
): ProjectFinishAttestationReceipt["workflow"] | undefined {
  const expectedRef = `${binding.repositorySlug}/${PROJECT_FINISH_ATTESTATION_POLICY.workflowPath}@refs/heads/main`
  const expectedSan = `https://github.com/${expectedRef}`
  if (
    !isRecord(value)
    || !exactKeys(value, ["certificateSan", "path", "ref", "runAttempt", "runId", "sha"])
    || value.certificateSan !== expectedSan
    || value.path !== PROJECT_FINISH_ATTESTATION_POLICY.workflowPath
    || value.ref !== expectedRef
    || !isCommit(value.sha)
    || value.sha !== binding.sourceHead
    || value.runAttempt !== binding.lifecycle.runAttempt
    || value.runId !== binding.lifecycle.runId
  ) {
    diagnostics.push(wrong("predicate.receipt.workflow"))
    return undefined
  }
  return {
    certificateSan: expectedSan,
    path: PROJECT_FINISH_ATTESTATION_POLICY.workflowPath,
    ref: expectedRef,
    runAttempt: binding.lifecycle.runAttempt,
    runId: binding.lifecycle.runId,
    sha: binding.sourceHead,
  }
}

function isPublicRepositorySlug(value: unknown): value is string {
  if (!isString(value) || value.length > 256 || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value)) {
    return false
  }
  return !value.split("/").some((segment) => segment === "." || segment === "..")
}

function isTimestamp(value: unknown): value is string {
  return isString(value) && Number.isFinite(Date.parse(value))
}

function invalid(path: string): ProjectFinishAttestationDiagnostic {
  return { code: "invalid-field", path }
}

function wrong(path: string): ProjectFinishAttestationDiagnostic {
  return { code: "wrong-policy", path }
}
