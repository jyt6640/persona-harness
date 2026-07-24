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
  completionEligibleForAssurance,
  externalAttestedVerificationDecision,
  type VerificationDecision,
} from "./workflow-verification-decision.js"
import {
  verifyExternalFinishAttestation,
  verifyExternalFinishAttestationForClosure,
  type FinishAttestationAssessment,
} from "./workflow-finish-attestation.js"
import {
  consumeProjectFinishAttestationArtifact,
  type ProjectFinishAttestationVerifierAssessment,
} from "./project-finish-attestation-verifier.js"
import { readEnrolledProjectFinishAttestations } from "./authority-project-attestation.js"

export const TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID = "trusted-authority-required"

export type WorkflowFinishAuthority = {
  readonly assessment: VerificationAuthorityAssessment
  readonly blocker: ClosureBlocker
  readonly decision: VerificationDecision
  readonly externalAttestation: FinishAttestationAssessment
  readonly projectAttestation?: ProjectFinishAttestationVerifierAssessment
  readonly semanticTdd: SemanticTddAssessment
  readonly status: "blocked" | "trusted"
}

export function readWorkflowFinishAuthority(
  projectDir: string,
  options: {
    readonly authorityStoreRoot?: string
    readonly consumeExternalAttestation?: boolean
    readonly now?: Date
  } = {},
): WorkflowFinishAuthority {
  const now = options.now ?? new Date()
  const consume = options.consumeExternalAttestation !== false
  const assessment = assessVerificationAuthority(projectDir)
  const semanticTdd = assessSemanticTddChain(projectDir)
  const externalInspection = verifyExternalFinishAttestationForClosure(projectDir, now)
  const projectRead = readEnrolledProjectFinishAttestations(projectDir, { storeRoot: options.authorityStoreRoot }, now)
  const trustedProjects = projectRead.values.filter((candidate) => candidate.assessment.authorityEligible)
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir)
  const source = evidenceRoot.ok
    ? `${evidenceRoot.relativePath} (diagnostic only)`
    : ".persona/harness.jsonc (diagnostic only)"
  if (externalInspection.authorityEligible && trustedProjects.length === 0) {
    const externalAttestation = consume
      ? verifyExternalFinishAttestation(projectDir, now, { consume: true })
      : externalInspection
    if (externalAttestation.authorityEligible && externalAttestation.receipt !== undefined) {
      const decision = externalAttestedVerificationDecision({
        attestationId: externalAttestation.receipt.finishId,
        consumptionState: externalAttestation.consumptionState === "consumed" ? "consumed" : "unconsumed",
        decisionId: `external-finish-${externalAttestation.receipt.finishId}`,
        sourceSnapshotDigest: externalAttestation.receipt.source.identity.contentDigest,
        verifiedAt: now.toISOString(),
      })
      if (completionEligibleForAssurance(decision)) {
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
    }
  }
  if (!externalInspection.authorityEligible && trustedProjects.length === 1) {
    const candidate = trustedProjects[0]
    if (candidate !== undefined) {
      const projectAttestation = consume
        ? consumeProjectFinishAttestationArtifact(projectDir, candidate.enrollment, candidate.artifact.archive, now)
        : candidate.assessment
      if (projectAttestation.authorityEligible && projectAttestation.receipt !== undefined) {
        const decision = externalAttestedVerificationDecision({
          attestationId: projectAttestation.receipt.lifecycle.finishId,
          consumptionState: projectAttestation.consumptionState === "consumed" ? "consumed" : "unconsumed",
          decisionId: `external-project-finish-${projectAttestation.receipt.lifecycle.finishId}`,
          sourceSnapshotDigest: projectAttestation.receipt.source.identity.contentDigest,
          verifiedAt: now.toISOString(),
        })
        if (completionEligibleForAssurance(decision)) {
          return {
            assessment,
            blocker: {
              id: TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
              reason: projectAttestation.summary,
              source,
            },
            decision,
            externalAttestation: externalInspection,
            projectAttestation,
            semanticTdd,
            status: "trusted",
          }
        }
      }
    }
  }
  const projectSummary = trustedProjects.length > 1
    ? "Multiple enrolled project finish attestations are trusted; finish remains blocked until the ambiguity is resolved."
    : projectRead.values[0]?.assessment.summary ?? "No enrolled original project finish attestation is available."
  const externalAttestation = externalInspection
  const decision = blockedVerificationDecision(
    TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
    [
      "No trusted external authority receipt is available.",
      "Unsigned project-local bearshell output, JUnit XML, TDD JSON, generatedBy markers, self-computed digests, arbitrary command/head/exit values, and stale attempt IDs are diagnostic only.",
      `Receipt assessment: ${assessment.summary}.`,
      `Semantic TDD assessment: ${semanticTdd.summary}.`,
      `External finish attestation assessment: ${externalAttestation.summary}.`,
      `Enrolled project attestation assessment: ${projectSummary}.`,
      "Only a product-verified original external attestation matching its enrolled policy can provide trusted authority before finish can pass.",
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
    projectAttestation: projectRead.values[0]?.assessment,
    semanticTdd,
    externalAttestation,
    status: "blocked",
  }
}
