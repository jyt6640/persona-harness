import type { AuthorityArtifact } from "./authority-artifact-store.js"
import type { AuthorityEnrollment } from "./authority-enrollment.js"
import { matchProjectFinishAttestationEnrollment } from "./project-finish-attestation-policy.js"
import type {
  ProjectFinishAttestationVerifierAssessment,
  ProjectFinishAttestationVerifierDiagnostic,
} from "./project-finish-attestation-verifier.js"
import type { ProjectFinishAttestationReceipt } from "./project-finish-attestation-types.js"
import { projectFinishAttestationReusableCertificateSan } from "./project-finish-attestation-workflow-identity.js"

export type AuthorityArtifactTuple = {
  readonly artifactId: number
  readonly artifactDigest: string
  readonly runId: string
  readonly sourceHead: string
}

export function matchesAuthorityArtifactTuple(
  artifact: AuthorityArtifact,
  expected: AuthorityArtifactTuple,
): boolean {
  return artifact.artifactId === expected.artifactId
    && artifact.artifactDigest === expected.artifactDigest
    && artifact.runId === expected.runId
    && artifact.sourceHead === expected.sourceHead
}

export function classifyAuthorityArtifactTupleReason(
  artifact: AuthorityArtifact,
  expected: AuthorityArtifactTuple,
): AuthorityBindingReason {
  if (artifact.artifactId !== expected.artifactId || artifact.artifactDigest !== expected.artifactDigest) return "artifact"
  if (artifact.runId !== expected.runId) return "run"
  if (artifact.sourceHead !== expected.sourceHead) return "source"
  return "unknown"
}

export function matchesAuthorityArtifactBinding(
  artifact: AuthorityArtifact,
  enrollment: AuthorityEnrollment,
  assessment: ProjectFinishAttestationVerifierAssessment,
): boolean {
  const receipt = assessment.receipt
  return assessment.authorityEligible
    && receipt !== undefined
    && artifact.repositoryId === receipt.repository.id
    && artifact.sourceHead === receipt.source.head
    && artifact.runId === receipt.lifecycle.runId
    && artifact.runId === receipt.workflow.runId
    && receipt.workflow.certificateSan === projectFinishAttestationReusableCertificateSan(receipt.workflow.reusable.sha)
    && matchProjectFinishAttestationEnrollment(receipt, enrollment) === undefined
}

export const AUTHORITY_BINDING_REASONS = [
  "artifact",
  "package-version",
  "source",
  "enrollment",
  "run",
  "signer",
  "freshness",
  "consumption",
  "verification",
  "unknown",
] as const

export type AuthorityBindingReason = typeof AUTHORITY_BINDING_REASONS[number]

export const AUTHORITY_SOURCE_REASONS = [
  "head",
  "inputs",
  "identity",
  "status",
  "index",
  "content",
  "working-tree",
  "workspace",
  "unknown",
] as const

export type AuthoritySourceReason = typeof AUTHORITY_SOURCE_REASONS[number]

export function classifyAuthorityBindingReason(
  artifact: AuthorityArtifact,
  enrollment: AuthorityEnrollment,
  assessment: ProjectFinishAttestationVerifierAssessment,
): AuthorityBindingReason {
  const stateReason = classifyAssessmentState(assessment.state)
  if (stateReason !== undefined) return stateReason

  const receipt = assessment.receipt
  if (receipt !== undefined) {
    const bindingReason = classifyReceiptBindingReason(artifact, enrollment, receipt)
    if (bindingReason !== undefined) return bindingReason
  }

  return classifyDiagnosticReason(assessment.diagnostics)
}

export function classifyAuthoritySourceReason(
  artifact: AuthorityArtifact,
  assessment: ProjectFinishAttestationVerifierAssessment,
): AuthoritySourceReason {
  if (assessment.state === "source-drift") {
    const diagnostic = assessment.diagnostics.find(({ code }) => code === "source-drift")
    return classifySourceDiagnosticPath(diagnostic?.path)
  }
  const receipt = assessment.receipt
  return receipt !== undefined && artifact.sourceHead !== receipt.source.head
    ? "head"
    : "unknown"
}

function classifyAssessmentState(
  state: ProjectFinishAttestationVerifierAssessment["state"],
): AuthorityBindingReason | undefined {
  switch (state) {
    case "source-drift":
      return "source"
    case "stale":
      return "freshness"
    case "replayed":
      return "consumption"
    case "certificate-invalid":
      return "signer"
    case "crypto-failed":
    case "dns-unavailable":
    case "network-unavailable":
    case "runtime-unsupported":
    case "signature-invalid":
    case "transparency-invalid":
    case "trust-root-unavailable":
    case "verification-timeout":
      return "verification"
    case "binding-mismatch":
    case "wrong-policy":
    case "trusted":
      return undefined
    case "malformed":
    case "malformed-bundle":
    case "missing":
      return "artifact"
    default:
      return assertNever(state)
  }
}

function classifyReceiptBindingReason(
  artifact: AuthorityArtifact,
  enrollment: AuthorityEnrollment,
  receipt: ProjectFinishAttestationReceipt,
): AuthorityBindingReason | undefined {
  if (artifact.repositoryId !== receipt.repository.id) return "enrollment"
  if (artifact.sourceHead !== receipt.source.head) return "source"
  if (artifact.runId !== receipt.lifecycle.runId || artifact.runId !== receipt.workflow.runId) return "run"
  if (receipt.workflow.certificateSan !== projectFinishAttestationReusableCertificateSan(receipt.workflow.reusable.sha)) {
    return "signer"
  }
  const enrollmentMismatch = matchProjectFinishAttestationEnrollment(receipt, enrollment)
  if (enrollmentMismatch === undefined) return undefined
  return enrollmentMismatch.path === "enrollment.reusable-workflow" ? "signer" : "enrollment"
}

function classifyDiagnosticReason(
  diagnostics: readonly ProjectFinishAttestationVerifierDiagnostic[],
): AuthorityBindingReason {
  for (const diagnostic of diagnostics) {
    const reason = classifyDiagnosticPath(diagnostic.path)
    if (reason !== undefined) return reason
  }
  return "unknown"
}

function classifyDiagnosticPath(path: string): AuthorityBindingReason | undefined {
  if (path === "predicate.receipt.phVersion") return "package-version"
  if (path.startsWith("consumption.")) return "consumption"
  if (path === "enrollment.reusable-workflow" || path === "predicate.receipt.workflow") return "signer"
  if (path.startsWith("enrollment.")) return "enrollment"
  if (path === "source" || path === "workspace") return "source"
  if (path === "predicate.receipt.lifecycle") return "freshness"
  if (["archive", "artifact", "bundle", "evidence", "payload", "predicate", "subject"].includes(path)) return "artifact"
  return undefined
}

function classifySourceDiagnosticPath(path: string | undefined): AuthoritySourceReason {
  switch (path) {
    case "source.repositoryHead":
      return "head"
    case "source.inputs":
      return "inputs"
    case "source.identity":
    case "source.git":
      return "identity"
    case "source.gitStatusDigest":
      return "status"
    case "source.trackedIndexDigest":
      return "index"
    case "source.contentDigest":
      return "content"
    case "source.workingTreeBytesDifferFromMatchingGitIndex":
      return "working-tree"
    case "workspace":
      return "workspace"
    default:
      return "unknown"
  }
}

function assertNever(value: never): never {
  throw new Error(`authority-binding-state:${String(value)}`)
}
