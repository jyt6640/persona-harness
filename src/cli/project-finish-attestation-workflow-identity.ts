import {
  PROJECT_FINISH_ATTESTATION_POLICY,
} from "./project-finish-attestation-types.js"

export function projectFinishAttestationReusableCertificateSan(reusableWorkflowSha: string): string {
  return `https://github.com/${PROJECT_FINISH_ATTESTATION_POLICY.producerRepository}/${PROJECT_FINISH_ATTESTATION_POLICY.workflowPath}@${reusableWorkflowSha}`
}
