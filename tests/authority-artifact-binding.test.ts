import { describe, expect, it } from "vitest"

import { matchesAuthorityArtifactBinding } from "../src/cli/authority-artifact-binding.js"
import type { AuthorityArtifact } from "../src/cli/authority-artifact-store.js"
import {
  authorityEnrollmentFromReadback,
  type AuthorityEnrollment,
} from "../src/cli/authority-enrollment.js"
import { parseProjectFinishAttestationStatement } from "../src/cli/project-finish-attestation-parser.js"
import type { ProjectFinishAttestationVerifierAssessment } from "../src/cli/project-finish-attestation-verifier.js"
import { createValidProjectFinishAttestationStatement } from "./helpers/project-finish-attestation-fixture.js"

describe("consumer authority artifact binding", () => {
  it("retains only a discovery record that matches the verified caller, reusable, source, repository, and run identities", () => {
    const input = validBinding()

    expect(matchesAuthorityArtifactBinding(input.artifact, input.enrollment, input.assessment)).toBe(true)
    expect(matchesAuthorityArtifactBinding({ ...input.artifact, runId: "10" }, input.enrollment, input.assessment)).toBe(false)
    expect(matchesAuthorityArtifactBinding({ ...input.artifact, sourceHead: "b".repeat(40) }, input.enrollment, input.assessment)).toBe(false)
    expect(matchesAuthorityArtifactBinding({ ...input.artifact, repositoryId: 987654322 }, input.enrollment, input.assessment)).toBe(false)

    const callerMismatch: ProjectFinishAttestationVerifierAssessment = {
      ...input.assessment,
      receipt: {
        ...input.assessment.receipt!,
        workflow: {
          ...input.assessment.receipt!.workflow,
          caller: {
            ...input.assessment.receipt!.workflow.caller,
            ref: "example/public-gradle-app/.github/workflows/other.yml@refs/heads/main",
          },
        },
      },
    }
    const reusableMismatch: ProjectFinishAttestationVerifierAssessment = {
      ...input.assessment,
      receipt: {
        ...input.assessment.receipt!,
        workflow: {
          ...input.assessment.receipt!.workflow,
          reusable: {
            ...input.assessment.receipt!.workflow.reusable,
            sha: "c".repeat(40),
          },
        },
      },
    }

    expect(matchesAuthorityArtifactBinding(input.artifact, input.enrollment, callerMismatch)).toBe(false)
    expect(matchesAuthorityArtifactBinding(input.artifact, input.enrollment, reusableMismatch)).toBe(false)
  })
})

function validBinding(): {
  readonly artifact: AuthorityArtifact
  readonly assessment: ProjectFinishAttestationVerifierAssessment
  readonly enrollment: AuthorityEnrollment
} {
  const parsed = parseProjectFinishAttestationStatement(createValidProjectFinishAttestationStatement())
  if (!parsed.ok) throw new Error("fixture receipt must parse")
  const enrollment = authorityEnrollmentFromReadback({
    callerWorkflowPath: "project-finish.yml",
    repositoryId: 987654321,
    repositorySlug: "example/public-gradle-app",
    reusableWorkflowSha: "b".repeat(40),
  })
  if (enrollment === undefined) throw new Error("fixture enrollment must parse")
  return {
    artifact: {
      archive: Buffer.alloc(1),
      artifactId: 11,
      artifactDigest: `sha256:${"0".repeat(64)}`,
      fetchedAt: "2026-07-29T00:00:00.000Z",
      repositoryId: 987654321,
      runId: "1001",
      sourceHead: "a".repeat(40),
    },
    assessment: {
      authorityEligible: true,
      consumptionState: "unconsumed",
      decision: "trusted",
      diagnostics: [],
      receipt: parsed.value.predicate.receipt,
      state: "trusted",
      summary: "trusted",
    },
    enrollment,
  }
}
