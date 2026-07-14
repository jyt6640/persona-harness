import type { ClosureBlocker } from "./workflow-closure.js"
import { resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import {
  assessVerificationAuthority,
  type VerificationAuthorityAssessment,
} from "./workflow-verification-receipt.js"
import {
  assessSemanticTddChain,
  type SemanticTddAssessment,
} from "./workflow-semantic-tdd.js"
import { assessExternalFinishAttestation } from "./workflow-external-finish-attestation.js"

export const TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID = "trusted-authority-required"

export type WorkflowFinishAuthority = {
  readonly assessment: VerificationAuthorityAssessment
  readonly blocker: ClosureBlocker
  readonly semanticTdd: SemanticTddAssessment
  readonly status: "blocked" | "trusted"
}

export function readWorkflowFinishAuthority(projectDir: string): WorkflowFinishAuthority {
  const assessment = assessVerificationAuthority(projectDir)
  const semanticTdd = assessSemanticTddChain(projectDir)
  const external = assessExternalFinishAttestation(projectDir)
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir)
  const source = evidenceRoot.ok
    ? `${evidenceRoot.relativePath} (diagnostic only)`
    : ".persona/harness.jsonc (diagnostic only)"
  return {
    assessment,
    blocker: {
      id: TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
      reason: [
        "No trusted Persona Harness or external authority receipt is available.",
        "Unsigned project-local bearshell output, JUnit XML, TDD JSON, generatedBy markers, self-computed digests, arbitrary command/head/exit values, and stale attempt IDs are diagnostic only.",
        `Receipt assessment: ${assessment.summary}.`,
        `Semantic TDD assessment: ${semanticTdd.summary}.`,
        `External attestation assessment: ${external.reason}.`,
        "Only a verified clean-CI external attestation can provide authority; local cooperative evidence remains untrusted.",
      ].join(" "),
      source,
    },
    semanticTdd,
    status: external.status === "trusted" ? "trusted" : "blocked",
  }
}
