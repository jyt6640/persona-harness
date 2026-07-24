import { parseProjectFinishAttestationStatement } from "./project-finish-attestation-parser.js"
import type {
  ProjectFinishAttestationAssessment,
  ProjectFinishAttestationDiagnostic,
  ProjectFinishAttestationParseResult,
  ProjectFinishAttestationReceipt,
} from "./project-finish-attestation-types.js"
import type {
  ProjectFinishAttestationEnrolledPolicy,
  ProjectFinishAttestationVerifierDiagnostic,
} from "./project-finish-attestation-verifier-types.js"
import { isCommit, isPositiveInteger } from "./workflow-finish-attestation-receipt-fields.js"

type EnrollmentMismatch = Pick<ProjectFinishAttestationVerifierDiagnostic, "code" | "path">

export { parseProjectFinishAttestationStatement } from "./project-finish-attestation-parser.js"

export function assessProjectFinishAttestationStatement(
  value: unknown,
): ProjectFinishAttestationAssessment {
  const parsed = parseProjectFinishAttestationStatement(value)
  if (parsed.ok) {
    return {
      authorityEligible: false,
      decision: "blocked",
      diagnostics: [{ code: "signature-unverified", path: "signature" }],
      receipt: parsed.value.predicate.receipt,
      state: "signature-unverified",
    }
  }
  return {
    authorityEligible: false,
    decision: "blocked",
    diagnostics: parsed.diagnostics,
    state: failedState(parsed),
  }
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

function failedState(
  result: Extract<ProjectFinishAttestationParseResult, { readonly ok: false }>,
): Exclude<ProjectFinishAttestationAssessment["state"], "signature-unverified"> {
  if (result.diagnostics.some((diagnostic: ProjectFinishAttestationDiagnostic) =>
    diagnostic.code === "binding-mismatch")) {
    return "binding-mismatch"
  }
  if (result.diagnostics.some((diagnostic: ProjectFinishAttestationDiagnostic) =>
    diagnostic.code === "wrong-policy")) {
    return "wrong-policy"
  }
  return "malformed"
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

function wrongPolicy(path: string): EnrollmentMismatch {
  return { code: "wrong-policy", path }
}
