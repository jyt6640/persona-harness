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
  type VerificationDecision,
} from "./workflow-verification-decision.js"

export const TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID = "trusted-authority-required"

export type WorkflowFinishAuthority = {
  readonly assessment: VerificationAuthorityAssessment
  readonly blocker: ClosureBlocker
  readonly decision: VerificationDecision
  readonly semanticTdd: SemanticTddAssessment
  readonly status: "blocked"
}

export function readWorkflowFinishAuthority(projectDir: string): WorkflowFinishAuthority {
  const assessment = assessVerificationAuthority(projectDir)
  const semanticTdd = assessSemanticTddChain(projectDir)
  const evidenceRoot = resolveSafeEvidenceRootResult(projectDir)
  const source = evidenceRoot.ok
    ? `${evidenceRoot.relativePath} (diagnostic only)`
    : ".persona/harness.jsonc (diagnostic only)"
  const decision = blockedVerificationDecision(
    TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID,
    [
      "No trusted Persona Harness or external authority receipt is available.",
      "Unsigned project-local bearshell output, JUnit XML, TDD JSON, generatedBy markers, self-computed digests, arbitrary command/head/exit values, and stale attempt IDs are diagnostic only.",
      `Receipt assessment: ${assessment.summary}.`,
      `Semantic TDD assessment: ${semanticTdd.summary}.`,
      "P3-3 defines the receipt and attempt boundary; P3-4 or a future external attestation path must provide trusted authority before finish can pass.",
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
    status: "blocked",
  }
}
