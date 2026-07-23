import { readdirSync, realpathSync } from "node:fs"
import { join, resolve } from "node:path"

import { assessSigstoreNodeRuntime } from "../../scripts/node-runtime-floor.mjs"
import { personaHarnessVersion } from "./version.js"
import {
  canonicalProjectFinishAttestationBytes,
} from "./project-finish-attestation-canonical.js"
import { parseProjectFinishAttestationStatement } from "./project-finish-attestation-parser.js"
import { runProjectFinishAttestationWorker } from "./project-finish-attestation-worker.js"
import type { ProjectFinishAttestationReceipt } from "./project-finish-attestation-types.js"
import {
  PROJECT_FINISH_ATTESTATION_EVIDENCE_DIRECTORY,
  PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES,
  PROJECT_FINISH_ATTESTATION_MAX_BUNDLE_BYTES,
  PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES,
  type ProjectFinishAttestationEnrolledPolicy,
  type ProjectFinishAttestationVerifierAssessment,
  type ProjectFinishAttestationVerifierDiagnostic,
  type ProjectFinishAttestationVerifierState,
} from "./project-finish-attestation-verifier-types.js"
import {
  canonicalJson,
  sha256Digest,
} from "./workflow-finish-attestation-canonical.js"
import {
  captureFinishAttestationWorkspaceDigest,
  consumeFinishAttestation,
  isSafeFinishAttestationDirectory,
  matchesFinishAttestationTerminalRecord,
  readFinishAttestationTerminalRecord,
} from "./workflow-finish-attestation-consumption.js"
import { isCommit, isPositiveInteger } from "./workflow-finish-attestation-receipt-fields.js"
import { matchesProjectFinishAttestationSource } from "./project-finish-attestation-source.js"
import {
  captureNoFollowDirectory,
  readNoFollowRegularFile,
  sameNoFollowPathIdentity,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"

const CLOCK_SKEW_MS = 5 * 60 * 1000

const BLOCKED_SUMMARIES = {
  "binding-mismatch": "Project finish attestation bindings do not match the verified evidence.",
  "crypto-failed": "Product-owned Sigstore verification rejected the project finish attestation.",
  malformed: "Project finish attestation evidence is malformed.",
  missing: "No safe project finish attestation evidence is present.",
  "network-unavailable": "Online Sigstore trust material is unavailable; project finish authority remains blocked.",
  replayed: "Project finish attestation has already been consumed.",
  "runtime-unsupported": "Node.js does not meet the required Sigstore runtime range; project finish authority remains blocked.",
  "source-drift": "Current project source does not match the signed project finish attestation.",
  stale: "Project finish attestation is expired or outside the accepted clock skew.",
  "wrong-policy": "Project finish attestation does not match the enrolled product policy.",
} as const satisfies Record<Exclude<ProjectFinishAttestationVerifierState, "trusted">, string>

type ProjectFinishAttestationEvidence = {
  readonly bundleBytes: Buffer
  readonly predicateBytes: Buffer
  readonly receiptBytes: Buffer
}

type EnrollmentMismatch = Pick<ProjectFinishAttestationVerifierDiagnostic, "code" | "path">

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

export function inspectProjectFinishAttestation(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  now = new Date(),
): ProjectFinishAttestationVerifierAssessment {
  return verifyProjectFinishAttestationInternal(projectDir, enrollment, now, false, true)
}

export function consumeProjectFinishAttestation(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  now = new Date(),
): ProjectFinishAttestationVerifierAssessment {
  return verifyProjectFinishAttestationInternal(projectDir, enrollment, now, true, false)
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

export function matchProjectFinishAttestationEnrollment(
  receipt: ProjectFinishAttestationReceipt,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
): EnrollmentMismatch | undefined {
  if (!isValidEnrollment(enrollment)) return wrongPolicy("enrollment")
  if (
    receipt.repository.id !== enrollment.repositoryId
    || receipt.repository.slug !== enrollment.repositorySlug
  ) {
    return wrongPolicy("enrollment.repository")
  }
  const callerRef = `${enrollment.repositorySlug}/.github/workflows/${enrollment.callerWorkflowPath}@refs/heads/main`
  if (receipt.workflow.caller.ref !== callerRef) return wrongPolicy("enrollment.caller-workflow")
  if (receipt.workflow.reusable.sha !== enrollment.reusableWorkflowSha) {
    return wrongPolicy("enrollment.reusable-workflow")
  }
  return undefined
}

function verifyProjectFinishAttestationInternal(
  projectDir: string,
  enrollment: ProjectFinishAttestationEnrolledPolicy,
  now: Date,
  consume: boolean,
  allowConsumed: boolean,
): ProjectFinishAttestationVerifierAssessment {
  if (assessSigstoreNodeRuntime(process.versions.node).status !== "supported") {
    return blocked("runtime-unsupported", "runtime")
  }
  const projectRoot = resolveSafeProjectRoot(projectDir)
  if (projectRoot === undefined) return blocked("missing", "evidence")
  const evidence = readProjectFinishAttestationEvidence(projectRoot)
  if (evidence === undefined) return blocked("missing", "evidence")

  const bundleDigest = sha256Digest(evidence.bundleBytes)
  const worker = runProjectFinishAttestationWorker(evidence.bundleBytes)
  if (!worker.ok) return blocked(worker.state, "bundle")
  if (worker.bundleDigest !== bundleDigest) return blocked("binding-mismatch", "bundle")

  const parsed = parseProjectFinishAttestationStatement(worker.statement)
  if (!parsed.ok) return blocked(parsedState(parsed.diagnostics), "payload")
  const predicate = parseJson(evidence.predicateBytes)
  const receipt = parseJson(evidence.receiptBytes)
  if (predicate === undefined || receipt === undefined) return blocked("malformed", "artifact")
  if (
    !hasCanonicalBytes(evidence.predicateBytes, predicate)
    || !hasCanonicalBytes(evidence.receiptBytes, receipt)
    || canonicalJson(predicate) !== canonicalJson(parsed.value.predicate)
    || canonicalJson(receipt) !== canonicalJson(parsed.value.predicate.receipt)
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
  if (!isFresh(signedReceipt, now)) return blocked("stale", "predicate.receipt.lifecycle")

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

function readProjectFinishAttestationEvidence(projectDir: string): ProjectFinishAttestationEvidence | undefined {
  const personaDirectory = join(projectDir, ".persona")
  const evidenceDirectory = join(projectDir, ".persona", "evidence")
  const artifactDirectory = join(projectDir, PROJECT_FINISH_ATTESTATION_EVIDENCE_DIRECTORY)
  const root = captureNoFollowDirectory(projectDir)
  const persona = captureNoFollowDirectory(personaDirectory)
  const evidence = captureNoFollowDirectory(evidenceDirectory)
  const artifact = captureNoFollowDirectory(artifactDirectory)
  if (
    root.kind !== "ready"
    || persona.kind !== "ready"
    || evidence.kind !== "ready"
    || artifact.kind !== "ready"
    || !isCanonicalDirectory(projectDir)
    || !isCanonicalDirectory(personaDirectory)
    || !isCanonicalDirectory(evidenceDirectory)
    || !isCanonicalDirectory(artifactDirectory)
  ) {
    return undefined
  }
  try {
    const names = readdirSync(artifactDirectory).sort()
    if (
      names.length !== PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES.length
      || names.some((name, index) => name !== PROJECT_FINISH_ATTESTATION_EVIDENCE_FILES[index])
    ) {
      return undefined
    }
    const bundle = readNoFollowRegularFile(
      join(artifactDirectory, "bundle.json"),
      PROJECT_FINISH_ATTESTATION_MAX_BUNDLE_BYTES,
      artifactDirectory,
    )
    const predicate = readNoFollowRegularFile(
      join(artifactDirectory, "predicate.json"),
      PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES,
      artifactDirectory,
    )
    const receipt = readNoFollowRegularFile(
      join(artifactDirectory, "receipt.json"),
      PROJECT_FINISH_ATTESTATION_MAX_JSON_BYTES,
      artifactDirectory,
    )
    if (bundle.kind !== "ready" || predicate.kind !== "ready" || receipt.kind !== "ready") return undefined
    if (
      !sameDirectory(projectDir, root.value)
      || !sameDirectory(personaDirectory, persona.value)
      || !sameDirectory(evidenceDirectory, evidence.value)
      || !sameDirectory(artifactDirectory, artifact.value)
    ) {
      return undefined
    }
    return {
      bundleBytes: bundle.value.bytes,
      predicateBytes: predicate.value.bytes,
      receiptBytes: receipt.value.bytes,
    }
  } catch {
    return undefined
  }
}

function resolveSafeProjectRoot(projectDir: string): string | undefined {
  const requestedRoot = resolve(projectDir)
  const requested = captureNoFollowDirectory(requestedRoot)
  if (requested.kind !== "ready") return undefined
  try {
    const projectRoot = realpathSync(requestedRoot)
    const canonical = captureNoFollowDirectory(projectRoot)
    return canonical.kind === "ready"
      && sameNoFollowPathIdentity(requested.value, canonical.value)
      && isCanonicalDirectory(projectRoot)
      ? projectRoot
      : undefined
  } catch {
    return undefined
  }
}

function isCanonicalDirectory(path: string): boolean {
  try {
    return realpathSync(path) === path
  } catch {
    return false
  }
}

function sameDirectory(path: string, expected: NoFollowPathIdentity): boolean {
  const current = captureNoFollowDirectory(path)
  return current.kind === "ready" && sameNoFollowPathIdentity(expected, current.value)
}

function hasSafeOptionalTerminalDirectory(projectDir: string): boolean {
  const terminalDirectory = join(projectDir, ".persona", "evidence", "finish-attestation")
  const terminal = captureNoFollowDirectory(terminalDirectory)
  return terminal.kind === "absent"
    || (terminal.kind === "ready" && isSafeFinishAttestationDirectory(projectDir))
}

function parseJson(bytes: Buffer): unknown | undefined {
  try {
    return JSON.parse(bytes.toString("utf8"))
  } catch {
    return undefined
  }
}

function hasCanonicalBytes(bytes: Buffer, value: unknown): boolean {
  return bytes.equals(canonicalProjectFinishAttestationBytes(value))
}

function isFresh(receipt: ProjectFinishAttestationReceipt, now: Date): boolean {
  const issuedAt = Date.parse(receipt.lifecycle.issuedAt)
  const expiresAt = Date.parse(receipt.lifecycle.expiresAt)
  const nowMs = now.getTime()
  return Number.isFinite(issuedAt)
    && Number.isFinite(expiresAt)
    && expiresAt > nowMs
    && issuedAt <= nowMs + CLOCK_SKEW_MS
}

function isValidEnrollment(enrollment: ProjectFinishAttestationEnrolledPolicy): boolean {
  return isPositiveInteger(enrollment.repositoryId)
    && isPublicRepositorySlug(enrollment.repositorySlug)
    && isCallerWorkflowPath(enrollment.callerWorkflowPath)
    && isCommit(enrollment.reusableWorkflowSha)
}

function isPublicRepositorySlug(value: string): boolean {
  return value.length > 0
    && value.length <= 256
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value)
    && !value.split("/").some((segment) => segment === "." || segment === "..")
}

function isCallerWorkflowPath(value: string): boolean {
  return value.length > 0
    && value.length <= 256
    && value.endsWith(".yml")
    && !value.includes("\\")
    && !value.split("/").some((segment) => segment === "" || segment === "." || segment === "..")
}

function parsedState(
  diagnostics: readonly { readonly code: string }[],
): Exclude<ProjectFinishAttestationVerifierState, "trusted"> {
  if (diagnostics.some((diagnostic) => diagnostic.code === "binding-mismatch")) return "binding-mismatch"
  if (diagnostics.some((diagnostic) => diagnostic.code === "wrong-policy")) return "wrong-policy"
  return "malformed"
}

function wrongPolicy(path: string): EnrollmentMismatch {
  return { code: "wrong-policy", path }
}

function blocked(
  state: Exclude<ProjectFinishAttestationVerifierState, "trusted">,
  path: string,
): ProjectFinishAttestationVerifierAssessment {
  return {
    authorityEligible: false,
    consumptionState: "not-applicable",
    decision: "blocked",
    diagnostics: [{ code: state, path }],
    state,
    summary: BLOCKED_SUMMARIES[state],
  }
}

function trusted(
  receipt: ProjectFinishAttestationReceipt,
  consumptionState: "consumed" | "unconsumed",
): ProjectFinishAttestationVerifierAssessment {
  return {
    authorityEligible: true,
    consumptionState,
    decision: "trusted",
    diagnostics: [],
    receipt,
    state: "trusted",
    summary: "Signed enrolled public project finish attestation passed product-owned Sigstore, policy, source, freshness, and replay checks.",
  }
}
