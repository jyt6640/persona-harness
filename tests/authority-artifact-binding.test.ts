import { createHash } from "node:crypto"

import { describe, expect, it } from "vitest"

import {
  AUTHORITY_BINDING_REASONS,
  AUTHORITY_SOURCE_REASONS,
  classifyAuthorityBindingReason,
  classifyAuthoritySourceReason,
  matchesAuthorityArtifactBinding,
} from "../src/cli/authority-artifact-binding.js"
import type { AuthorityArtifact } from "../src/cli/authority-artifact-store.js"
import {
  authorityEnrollmentFromReadback,
  type AuthorityEnrollment,
} from "../src/cli/authority-enrollment.js"
import {
  createProjectFinishAttestationProducerArtifacts,
} from "../src/cli/project-finish-attestation-producer.js"
import type { ProjectFinishAttestationReceipt } from "../src/cli/project-finish-attestation-types.js"
import type { ProjectFinishAttestationVerifierAssessment } from "../src/cli/project-finish-attestation-verifier.js"
import { projectFinishAttestationReusableCertificateSan } from "../src/cli/project-finish-attestation-workflow-identity.js"
import { personaHarnessVersion } from "../src/cli/version.js"

const AUTHENTIC_TOPOLOGY = {
  callerWorkflowPath: "research-attestation.yml",
  callerWorkflowSha: "d370eaffefb2fdb12388c4b14c0e52af0e4efb38",
  repositoryId: 1304576182,
  repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
  reusableWorkflowSha: "73e8654ce3307a6be7fb511e0c1f67df93c7d1b3",
  runId: "30430000000",
} as const

type BindingInput = {
  readonly artifact: AuthorityArtifact
  readonly assessment: ProjectFinishAttestationVerifierAssessment
  readonly enrollment: AuthorityEnrollment
  readonly receipt: ProjectFinishAttestationReceipt
}

type BindingMutation = (
  input: BindingInput,
) => AuthorityArtifact | ProjectFinishAttestationVerifierAssessment

describe("consumer authority artifact binding", () => {
  it("accepts the authentic caller enrollment and separately bound reusable signer topology", () => {
    const input = validBinding()

    expect(input.receipt.workflow.caller).toEqual({
      ref: "jyt6640/persona-harness-attestation-claim-fixture/.github/workflows/research-attestation.yml@refs/heads/main",
      sha: AUTHENTIC_TOPOLOGY.callerWorkflowSha,
    })
    expect(input.receipt.workflow.reusable).toMatchObject({
      sha: AUTHENTIC_TOPOLOGY.reusableWorkflowSha,
    })
    expect(input.receipt.workflow.certificateSan).toBe(
      projectFinishAttestationReusableCertificateSan(AUTHENTIC_TOPOLOGY.reusableWorkflowSha),
    )
    expect(matchesAuthorityArtifactBinding(input.artifact, input.enrollment, input.assessment)).toBe(true)
  })

  const rejectedBindings: readonly (readonly [string, BindingMutation])[] = [
    ["caller workflow", (input: BindingInput) => assessmentFor(input, {
      ...input.receipt,
      workflow: {
        ...input.receipt.workflow,
        caller: {
          ...input.receipt.workflow.caller,
          ref: "jyt6640/persona-harness-attestation-claim-fixture/.github/workflows/other.yml@refs/heads/main",
        },
      },
    })],
    ["reusable workflow", (input: BindingInput) => assessmentFor(input, {
      ...input.receipt,
      workflow: {
        ...input.receipt.workflow,
        reusable: {
          ...input.receipt.workflow.reusable,
          sha: "c".repeat(40),
        },
      },
    })],
    ["reusable certificate SAN", (input: BindingInput) => assessmentFor(input, {
      ...input.receipt,
      workflow: {
        ...input.receipt.workflow,
        certificateSan: projectFinishAttestationReusableCertificateSan("c".repeat(40)),
      },
    })],
    ["repository", (input: BindingInput) => assessmentFor(input, {
      ...input.receipt,
      repository: {
        ...input.receipt.repository,
        id: AUTHENTIC_TOPOLOGY.repositoryId + 1,
      },
    })],
    ["source head", (input: BindingInput) => ({
      ...input.artifact,
      sourceHead: "c".repeat(40),
    })],
    ["workflow run", (input: BindingInput) => ({
      ...input.artifact,
      runId: "30430000001",
    })],
    ["untrusted archival assessment", untrustedAssessment],
  ]

  it.each(rejectedBindings)("rejects a mismatched %s without treating the archive as authority", (_label, mutate) => {
    const input = validBinding()
    const candidate = mutate(input)
    const artifact = isArtifact(candidate) ? candidate : input.artifact
    const assessment = isAssessment(candidate) ? candidate : input.assessment

    expect(matchesAuthorityArtifactBinding(artifact, input.enrollment, assessment)).toBe(false)
  })

  it("maps every verifier state and diagnostic path to a finite nonreflective reason", () => {
    const input = validBinding()
    const cases = [
      ["source-drift", "source"] ,
      ["stale", "freshness"],
      ["replayed", "consumption"],
      ["certificate-invalid", "signer"],
      ["crypto-failed", "verification"],
      ["malformed", "artifact"],
      ["binding-mismatch", "package-version", "predicate.receipt.phVersion"],
      ["wrong-policy", "signer", "enrollment.reusable-workflow"],
      ["binding-mismatch", "consumption", "consumption.recordUnreadable"],
      ["binding-mismatch", "unknown", "opaque-internal-diagnostic"],
    ] as const

    expect(AUTHORITY_BINDING_REASONS).toEqual([
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
    ])
    for (const [state, expected, path = state] of cases) {
      const assessment = {
        ...input.assessment,
        authorityEligible: false,
        consumptionState: "not-applicable" as const,
        decision: "blocked" as const,
        diagnostics: [{ code: state, path }],
        state,
      }
      expect(classifyAuthorityBindingReason(input.artifact, input.enrollment, assessment)).toBe(expected)
    }
  })

  it.each([
    ["source head", (input: BindingInput) => ({ ...input.artifact, sourceHead: "c".repeat(40) }), "source"],
    ["run", (input: BindingInput) => ({ ...input.artifact, runId: "30430000001" }), "run"],
    ["reusable signer", (input: BindingInput) => assessmentFor(input, {
      ...input.receipt,
      workflow: {
        ...input.receipt.workflow,
        certificateSan: projectFinishAttestationReusableCertificateSan("c".repeat(40)),
      },
    }), "signer"],
  ] as const)("classifies structured %s mismatch without exposing values", (_label, mutate, expected) => {
    const input = validBinding()
    const candidate = mutate(input)
    const artifact = isArtifact(candidate) ? candidate : input.artifact
    const assessment = isAssessment(candidate) ? candidate : input.assessment

    expect(classifyAuthorityBindingReason(artifact, input.enrollment, assessment)).toBe(expected)
    expect(JSON.stringify(classifyAuthorityBindingReason(artifact, input.enrollment, assessment))).not.toContain("c".repeat(40))
  })

  it("maps receipt source drift to head and unknown source fallbacks", () => {
    const input = validBinding()
    expect(AUTHORITY_SOURCE_REASONS).toEqual([
      "head",
      "inputs",
      "identity",
      "status",
      "index",
      "content",
      "working-tree",
      "workspace",
      "unknown",
    ])

    const mismatchedReceipt = {
      ...input.receipt,
      source: { ...input.receipt.source, head: "c".repeat(40) },
    }
    expect(classifyAuthoritySourceReason(input.artifact, assessmentFor(input, mismatchedReceipt))).toBe("head")
    expect(classifyAuthoritySourceReason(input.artifact, {
      ...input.assessment,
      authorityEligible: false,
      consumptionState: "not-applicable",
      decision: "blocked",
      diagnostics: [{ code: "binding-mismatch", path: "source" }],
      receipt: undefined,
      state: "binding-mismatch",
    })).toBe("unknown")
  })
})

function validBinding(): BindingInput {
  const enrollment = authorityEnrollmentFromReadback({
    callerWorkflowPath: AUTHENTIC_TOPOLOGY.callerWorkflowPath,
    repositoryId: AUTHENTIC_TOPOLOGY.repositoryId,
    repositorySlug: AUTHENTIC_TOPOLOGY.repositorySlug,
    reusableWorkflowSha: AUTHENTIC_TOPOLOGY.reusableWorkflowSha,
  })
  if (enrollment === undefined) throw new Error("fixture enrollment must parse")
  const produced = createProjectFinishAttestationProducerArtifacts({
    buildArtifactDigest: `sha256:${"b".repeat(64)}`,
    callerWorkflowRef: `${AUTHENTIC_TOPOLOGY.repositorySlug}/.github/workflows/${AUTHENTIC_TOPOLOGY.callerWorkflowPath}@refs/heads/main`,
    callerWorkflowSha: AUTHENTIC_TOPOLOGY.callerWorkflowSha,
    issuedAt: "2026-07-30T01:00:00.000Z",
    phVersion: personaHarnessVersion(),
    repository: {
      id: AUTHENTIC_TOPOLOGY.repositoryId,
      slug: AUTHENTIC_TOPOLOGY.repositorySlug,
      visibility: "public",
    },
    reusableWorkflowSha: AUTHENTIC_TOPOLOGY.reusableWorkflowSha,
    runAttempt: 1,
    runId: AUTHENTIC_TOPOLOGY.runId,
    source: {
      head: AUTHENTIC_TOPOLOGY.callerWorkflowSha,
      identity: {
        contentDigest: `sha256:${"c".repeat(64)}`,
        entryCount: 5,
        exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"],
        gitStatusDigest: `sha256:${"d".repeat(64)}`,
        repositoryHead: AUTHENTIC_TOPOLOGY.callerWorkflowSha,
        schemaVersion: "source-identity.1",
        trackedEntryCount: 5,
        trackedIndexDigest: `sha256:${"e".repeat(64)}`,
        untrackedEntryCount: 0,
      },
      root: ".",
    },
    test: {
      count: 4,
      junitDigest: `sha256:${"f".repeat(64)}`,
      passed: 3,
      skipped: 1,
    },
  })
  const archive = Buffer.from("modeled-original-artifact", "utf8")
  const artifact: AuthorityArtifact = {
    archive,
    artifactId: 710000001,
    artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
    fetchedAt: "2026-07-30T01:00:00.000Z",
    repositoryId: AUTHENTIC_TOPOLOGY.repositoryId,
    runId: AUTHENTIC_TOPOLOGY.runId,
    sourceHead: AUTHENTIC_TOPOLOGY.callerWorkflowSha,
  }
  const assessment: ProjectFinishAttestationVerifierAssessment = {
    authorityEligible: true,
    consumptionState: "unconsumed",
    decision: "trusted",
    diagnostics: [],
    receipt: produced.receipt,
    state: "trusted",
    summary: "modeled-binding-contract",
  }
  return { artifact, assessment, enrollment, receipt: produced.receipt }
}

function assessmentFor(
  input: BindingInput,
  receipt: ProjectFinishAttestationReceipt,
): ProjectFinishAttestationVerifierAssessment {
  return { ...input.assessment, receipt }
}

function untrustedAssessment(input: BindingInput): ProjectFinishAttestationVerifierAssessment {
  return {
    ...input.assessment,
    authorityEligible: false,
    consumptionState: "not-applicable",
    decision: "blocked",
    state: "binding-mismatch",
  }
}

function isArtifact(value: AuthorityArtifact | ProjectFinishAttestationVerifierAssessment): value is AuthorityArtifact {
  return "archive" in value
}

function isAssessment(value: AuthorityArtifact | ProjectFinishAttestationVerifierAssessment): value is ProjectFinishAttestationVerifierAssessment {
  return "authorityEligible" in value
}
