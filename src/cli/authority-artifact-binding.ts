import type { AuthorityArtifact } from "./authority-artifact-store.js"
import type { AuthorityEnrollment } from "./authority-enrollment.js"
import { matchProjectFinishAttestationEnrollment } from "./project-finish-attestation-policy.js"
import type { ProjectFinishAttestationVerifierAssessment } from "./project-finish-attestation-verifier.js"
import { projectFinishAttestationReusableCertificateSan } from "./project-finish-attestation-workflow-identity.js"

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
