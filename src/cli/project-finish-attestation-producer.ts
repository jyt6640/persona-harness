import {
  canonicalProjectFinishAttestationBytes,
  canonicalProjectFinishAttestationReceiptDigest,
} from "./project-finish-attestation-canonical.js"
import { parseProjectFinishAttestationStatement } from "./project-finish-attestation-parser.js"
import {
  PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG,
  PROJECT_FINISH_ATTESTATION_MAX_FRESHNESS_MS,
  PROJECT_FINISH_ATTESTATION_POLICY,
  PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE,
  PROJECT_FINISH_ATTESTATION_SCHEMA,
  type ProjectFinishAttestationReceipt,
  type ProjectFinishAttestationStatement,
} from "./project-finish-attestation-types.js"

export type ProjectFinishAttestationProducerFacts = {
  readonly buildArtifactDigest: string
  readonly callerWorkflowRef: string
  readonly callerWorkflowSha: string
  readonly issuedAt: string
  readonly phVersion: string
  readonly repository: ProjectFinishAttestationReceipt["repository"]
  readonly reusableWorkflowSha: string
  readonly runAttempt: number
  readonly runId: string
  readonly source: ProjectFinishAttestationReceipt["source"]
  readonly test: Pick<ProjectFinishAttestationReceipt["test"], "count" | "junitDigest" | "passed" | "skipped">
}

export type ProjectFinishAttestationProducerArtifacts = {
  readonly predicate: ProjectFinishAttestationStatement["predicate"]
  readonly receipt: ProjectFinishAttestationReceipt
  readonly receiptBytes: Buffer
  readonly receiptDigest: string
  readonly statement: ProjectFinishAttestationStatement
}

export class ProjectFinishAttestationProducerError extends Error {
  readonly code = "project-finish-producer-binding"

  constructor() {
    super("project-finish-producer-binding")
  }
}

export function createProjectFinishAttestationProducerArtifacts(
  facts: ProjectFinishAttestationProducerFacts,
): ProjectFinishAttestationProducerArtifacts {
  const issuedAt = Date.parse(facts.issuedAt)
  if (!Number.isFinite(issuedAt)) throw new ProjectFinishAttestationProducerError()
  const receipt: ProjectFinishAttestationReceipt = {
    build: {
      artifactDigest: facts.buildArtifactDigest,
      commandId: "build",
      outcome: "passed",
    },
    event: PROJECT_FINISH_ATTESTATION_POLICY.event,
    gradle: {
      catalog: PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG,
      catalogDigest: canonicalProjectFinishAttestationReceiptDigest(
        PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG,
      ),
      catalogId: PROJECT_FINISH_ATTESTATION_POLICY.catalogId,
      console: "plain",
      noBuildCache: true,
      noDaemon: true,
      wrapperPath: "./gradlew",
    },
    lifecycle: {
      attemptId: `project-finish-attempt-${facts.runId}-${facts.runAttempt}`,
      expiresAt: new Date(issuedAt + PROJECT_FINISH_ATTESTATION_MAX_FRESHNESS_MS).toISOString(),
      finishId: `project-finish-finish-${facts.runId}-${facts.runAttempt}`,
      issuedAt: facts.issuedAt,
      nonce: `project-finish-${facts.runId}-${facts.runAttempt}`,
      runAttempt: facts.runAttempt,
      runId: facts.runId,
      sessionId: `project-finish-session-${facts.runId}-${facts.runAttempt}`,
    },
    phVersion: facts.phVersion,
    policyMarker: PROJECT_FINISH_ATTESTATION_POLICY.policyMarker,
    project: {
      root: ".",
      scope: PROJECT_FINISH_ATTESTATION_POLICY.projectScope,
    },
    ref: PROJECT_FINISH_ATTESTATION_POLICY.ref,
    repository: facts.repository,
    schemaVersion: PROJECT_FINISH_ATTESTATION_SCHEMA,
    source: facts.source,
    test: {
      commandId: "test",
      count: facts.test.count,
      failed: 0,
      junitDigest: facts.test.junitDigest,
      passed: facts.test.passed,
      skipped: facts.test.skipped,
    },
    workflow: {
      caller: {
        ref: facts.callerWorkflowRef,
        sha: facts.callerWorkflowSha,
      },
      certificateSan: `https://github.com/${facts.callerWorkflowRef}`,
      reusable: {
        path: PROJECT_FINISH_ATTESTATION_POLICY.workflowPath,
        ref: `${PROJECT_FINISH_ATTESTATION_POLICY.producerRepository}/${PROJECT_FINISH_ATTESTATION_POLICY.workflowPath}@${facts.reusableWorkflowSha}`,
        sha: facts.reusableWorkflowSha,
      },
      runAttempt: facts.runAttempt,
      runId: facts.runId,
    },
  }
  const receiptBytes = canonicalProjectFinishAttestationBytes(receipt)
  const receiptDigest = canonicalProjectFinishAttestationReceiptDigest(receipt)
  const predicate: ProjectFinishAttestationStatement["predicate"] = {
    policyMarker: PROJECT_FINISH_ATTESTATION_POLICY.policyMarker,
    receipt,
    receiptDigest,
    schemaVersion: PROJECT_FINISH_ATTESTATION_SCHEMA,
  }
  const statement: ProjectFinishAttestationStatement = {
    _type: "https://in-toto.io/Statement/v1",
    predicate,
    predicateType: PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE,
    subject: [{
      digest: { sha256: receiptDigest.slice("sha256:".length) },
      name: PROJECT_FINISH_ATTESTATION_POLICY.subjectName,
    }],
  }
  if (!parseProjectFinishAttestationStatement(statement).ok) {
    throw new ProjectFinishAttestationProducerError()
  }
  return { predicate, receipt, receiptBytes, receiptDigest, statement }
}
