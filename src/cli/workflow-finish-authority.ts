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
import {
  blockedVerificationDecision,
  externalAttestedVerificationDecision,
  type VerificationDecision,
} from "./workflow-verification-decision.js"
import {
  verifyExternalFinishAttestation,
  type FinishAttestationAssessment,
} from "./workflow-finish-attestation.js"

export const TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID = "trusted-authority-required"

export type WorkflowFinishAuthority = {
  readonly assessment: VerificationAuthorityAssessment
  readonly blocker: ClosureBlocker
  readonly decision: VerificationDecision
  readonly externalAttestation: FinishAttestationAssessment
  readonly semanticTdd: SemanticTddAssessment
  readonly status: "blocked" | "trusted"
}

export function readWorkflowFinishAuthority(
  projectDir: string,
  options: { readonly consumeExternalAttestation?: boolean; readonly now?: Date } = {},
): WorkflowFinishAuthority {
  const assessment = assessVerificationAuthority(projectDir)
  const semanticTdd = assessSemanticTddChain(projectDir)
  const externalAttestation = verifyExternalFinishAttestation(projectDir, options.now ?? new Date(), {
    consume: options.consumeExternalAttestation,
  })
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir)
  const source = evidenceRoot.ok
    ? `${evidenceRoot.relativePath} (diagnostic only)`
    : ".persona/harness.jsonc (diagnostic only)"
  if (externalAttestation.authorityEligible && externalAttestation.receipt !== undefined) {
    const decision = externalAttestedVerificationDecision({
      attestationId: externalAttestation.receipt.finishId,
      decisionId: `external-finish-${externalAttestation.receipt.finishId}`,
      sourceSnapshotDigest: externalAttestation.receipt.source.identity.contentDigest,
      verifiedAt: (options.now ?? new Date()).toISOString(),
    })
    return {
      assessment,
      blocker: {
        id: TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
        reason: externalAttestation.summary,
        source,
      },
      decision,
      externalAttestation,
      semanticTdd,
      status: "trusted",
    }
  }
  const decision = blockedVerificationDecision(
    TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
    [
      "No trusted Persona Harness or external authority receipt is available.",
      "Unsigned project-local bearshell output, JUnit XML, TDD JSON, generatedBy markers, self-computed digests, arbitrary command/head/exit values, and stale attempt IDs are diagnostic only.",
      `Receipt assessment: ${assessment.summary}.`,
      `Semantic TDD assessment: ${semanticTdd.summary}.`,
      `External attestation assessment: ${externalAttestation.summary}.`,
      "Only a verified protected-main finish-attestation.1 bundle can provide trusted authority before finish can pass.",
    ].join(" "),
  )
  return {
    assessment,
    decision,
    blocker: {
      id: TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
      reason: decision.summary,
      source,
    },
    semanticTdd,
    externalAttestation,
    status: "blocked",
  }
}
