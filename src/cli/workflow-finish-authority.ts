import type { ClosureBlocker } from "./workflow-closure.js"
import {
  assessVerificationAuthority,
  type VerificationAuthorityAssessment,
} from "./workflow-verification-receipt.js"

export const TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID = "trusted-authority-required"

export type WorkflowFinishAuthority = {
  readonly assessment: VerificationAuthorityAssessment
  readonly blocker: ClosureBlocker
  readonly status: "blocked"
}

export function readWorkflowFinishAuthority(projectDir: string): WorkflowFinishAuthority {
  const assessment = assessVerificationAuthority(projectDir)
  return {
    assessment,
    blocker: {
      id: TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
      reason: [
        "No trusted Persona Harness or external authority receipt is available.",
        "Unsigned project-local bearshell output, JUnit XML, TDD JSON, generatedBy markers, self-computed digests, arbitrary command/head/exit values, and stale attempt IDs are diagnostic only.",
        `Receipt assessment: ${assessment.summary}.`,
        "P3-3 defines the receipt and attempt boundary; P3-4 or a future external attestation path must provide trusted authority before finish can pass.",
      ].join(" "),
      source: ".persona/evidence (diagnostic only)",
    },
    status: "blocked",
  }
}
