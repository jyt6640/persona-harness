import {
  canonicalProjectFinishAttestationReceiptDigest,
} from "../../src/cli/project-finish-attestation-canonical.js"
import {
  PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG,
  PROJECT_FINISH_ATTESTATION_POLICY,
  PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE,
  PROJECT_FINISH_ATTESTATION_SCHEMA,
} from "../../src/cli/project-finish-attestation-types.js"

export function createValidProjectFinishAttestationStatement(): Record<string, unknown> {
  const receipt = createValidProjectFinishAttestationReceipt()
  const receiptDigest = canonicalProjectFinishAttestationReceiptDigest(receipt)
  return {
    _type: "https://in-toto.io/Statement/v1",
    predicate: {
      policyMarker: PROJECT_FINISH_ATTESTATION_POLICY.policyMarker,
      receipt,
      receiptDigest,
      schemaVersion: PROJECT_FINISH_ATTESTATION_SCHEMA,
    },
    predicateType: PROJECT_FINISH_ATTESTATION_PREDICATE_TYPE,
    subject: [{
      digest: { sha256: receiptDigest.slice("sha256:".length) },
      name: PROJECT_FINISH_ATTESTATION_POLICY.subjectName,
    }],
  }
}

export function createValidProjectFinishAttestationReceipt(): Record<string, unknown> {
  const sourceHead = "a".repeat(40)
  const callerWorkflowRef = "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main"
  const reusableWorkflowSha = "b".repeat(40)
  const reusableWorkflowRef = `${PROJECT_FINISH_ATTESTATION_POLICY.producerRepository}/${PROJECT_FINISH_ATTESTATION_POLICY.workflowPath}@${reusableWorkflowSha}`
  return {
    build: {
      artifactDigest: `sha256:${"b".repeat(64)}`,
      commandId: "build",
      outcome: "passed",
    },
    event: "push",
    gradle: {
      catalog: PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG,
      catalogDigest: canonicalProjectFinishAttestationReceiptDigest(PROJECT_FINISH_ATTESTATION_COMMAND_CATALOG),
      catalogId: PROJECT_FINISH_ATTESTATION_POLICY.catalogId,
      console: "plain",
      noBuildCache: true,
      noDaemon: true,
      wrapperPath: "./gradlew",
    },
    lifecycle: {
      attemptId: "project-finish-attempt-1001-2",
      expiresAt: "2026-07-18T02:00:00.000Z",
      finishId: "project-finish-finish-1001-2",
      issuedAt: "2026-07-18T01:00:00.000Z",
      nonce: "project-finish-1001-2",
      runAttempt: 2,
      runId: "1001",
      sessionId: "project-finish-session-1001-2",
    },
    phVersion: "0.7.0",
    policyMarker: PROJECT_FINISH_ATTESTATION_POLICY.policyMarker,
    project: {
      root: ".",
      scope: PROJECT_FINISH_ATTESTATION_POLICY.projectScope,
    },
    ref: PROJECT_FINISH_ATTESTATION_POLICY.ref,
    repository: {
      id: 987654321,
      slug: "example/public-gradle-app",
      visibility: "public",
    },
    schemaVersion: PROJECT_FINISH_ATTESTATION_SCHEMA,
    source: {
      head: sourceHead,
      identity: {
        contentDigest: `sha256:${"c".repeat(64)}`,
        entryCount: 5,
        exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"],
        gitStatusDigest: `sha256:${"d".repeat(64)}`,
        repositoryHead: sourceHead,
        schemaVersion: "source-identity.1",
        trackedEntryCount: 5,
        trackedIndexDigest: `sha256:${"e".repeat(64)}`,
        untrackedEntryCount: 0,
      },
      root: ".",
    },
    test: {
      commandId: "test",
      count: 4,
      failed: 0,
      junitDigest: `sha256:${"f".repeat(64)}`,
      passed: 3,
      skipped: 1,
    },
    workflow: {
      caller: {
        ref: callerWorkflowRef,
        sha: sourceHead,
      },
      certificateSan: `https://github.com/${callerWorkflowRef}`,
      reusable: {
        path: PROJECT_FINISH_ATTESTATION_POLICY.workflowPath,
        ref: reusableWorkflowRef,
        sha: reusableWorkflowSha,
      },
      runAttempt: 2,
      runId: "1001",
    },
  }
}
