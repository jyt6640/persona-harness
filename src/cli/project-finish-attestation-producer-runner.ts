import {
  prepareCooperativeFinishContext,
  type CooperativeFinishContextResult,
} from "./cooperative-finish-context.js"
import { reserveProjectReadBoundary } from "../io/bootstrap-write-boundary.js"
import {
  runProjectFinishAttestationGradleVerification,
  runProjectFinishAttestationGradleVerificationWithinBoundary,
  type CooperativeGradleVerification,
} from "./cooperative-gradle-verification.js"
import {
  createProjectFinishAttestationProducerArtifacts,
  ProjectFinishAttestationProducerError,
  type ProjectFinishAttestationProducerArtifacts,
} from "./project-finish-attestation-producer.js"
import type { ProjectFinishAttestationReceipt } from "./project-finish-attestation-types.js"

export type ProjectFinishAttestationProducerContext = {
  readonly callerWorkflowRef: string
  readonly callerWorkflowSha: string
  readonly issuedAt: string
  readonly repository: {
    readonly id: number
    readonly slug: string
    readonly visibility: "private" | "public"
  }
  readonly reusableWorkflowSha: string
  readonly runAttempt: number
  readonly runId: string
  readonly sourceHead: string
}

export type ProjectFinishAttestationProducerResult =
  | { readonly code: string; readonly kind: "blocked" }
  | { readonly kind: "passed"; readonly value: ProjectFinishAttestationProducerArtifacts }

type ProjectFinishAttestationProducerOptions = {
  readonly prepareContext?: (projectDir: string) => CooperativeFinishContextResult
  readonly verify?: (
    projectDir: string,
    context: Extract<CooperativeFinishContextResult, { readonly kind: "ready" }>["value"],
  ) => CooperativeGradleVerification
}

export function runProjectFinishAttestationProducer(
  projectDir: string,
  context: ProjectFinishAttestationProducerContext,
  phVersion: string,
  options: ProjectFinishAttestationProducerOptions = {},
): ProjectFinishAttestationProducerResult {
  if (
    context.repository.visibility !== "public"
    || context.callerWorkflowSha !== context.sourceHead
  ) {
    return blocked("project-finish-producer-binding")
  }
  try {
    const projectReadBoundary = reserveProjectReadBoundary(projectDir)
    try {
      const prepared = options.prepareContext === undefined
        ? prepareCooperativeFinishContext(projectDir, projectReadBoundary)
        : options.prepareContext(projectDir)
      if (prepared.kind === "blocked") return blocked(prepared.code)

      const verification = options.verify === undefined
        ? runProjectFinishAttestationGradleVerificationWithinBoundary(projectDir, prepared.value, projectReadBoundary)
        : options.verify(projectDir, prepared.value)
      if (verification.kind === "blocked") return blocked(verification.code)
      if (verification.value.sourceIdentity.repositoryHead !== context.sourceHead) {
        return blocked("project-finish-producer-binding")
      }
      return {
        kind: "passed",
        value: createProjectFinishAttestationProducerArtifacts({
          buildArtifactDigest: verification.value.buildOutputDigest,
          callerWorkflowRef: context.callerWorkflowRef,
          callerWorkflowSha: context.callerWorkflowSha,
          issuedAt: context.issuedAt,
          phVersion,
          repository: {
            id: context.repository.id,
            slug: context.repository.slug,
            visibility: "public",
          },
          reusableWorkflowSha: context.reusableWorkflowSha,
          runAttempt: context.runAttempt,
          runId: context.runId,
          source: {
            head: context.sourceHead,
            identity: verification.value.sourceIdentity,
            root: ".",
          },
          test: {
            count: verification.value.testCount,
            junitDigest: verification.value.junitDigest,
            passed: verification.value.passedTestCount,
            skipped: verification.value.skippedTestCount,
          },
        }),
      }
    } finally {
      projectReadBoundary.close()
    }
  } catch (error) {
    if (error instanceof ProjectFinishAttestationProducerError) {
      return blocked(error.code)
    }
    return blocked("project-finish-producer-profile")
  }
}

function blocked(code: string): ProjectFinishAttestationProducerResult {
  return { code, kind: "blocked" }
}
