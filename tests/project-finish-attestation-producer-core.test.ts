import { describe, expect, it } from "vitest"

import {
  createProjectFinishAttestationProducerArtifacts,
} from "../src/cli/project-finish-attestation-producer.js"
import {
  canonicalProjectFinishAttestationBytes,
} from "../src/cli/project-finish-attestation-canonical.js"
import {
  parseProjectFinishAttestationStatement,
} from "../src/cli/project-finish-attestation-parser.js"
import type {
  ProjectFinishAttestationProducerFacts,
} from "../src/cli/project-finish-attestation-producer.js"

const SOURCE_HEAD = "a".repeat(40)
const REUSABLE_SHA = "b".repeat(40)

describe("project finish attestation producer artifacts", () => {
  it("creates canonical receipt subject bytes from fixed workflow-derived facts", () => {
    const artifacts = createProjectFinishAttestationProducerArtifacts(facts())
    const parsed = parseProjectFinishAttestationStatement(artifacts.statement)

    expect(artifacts.receiptBytes).toEqual(
      canonicalProjectFinishAttestationBytes(artifacts.receipt),
    )
    expect(artifacts.statement.subject[0].digest.sha256).toBe(
      artifacts.receiptDigest.slice("sha256:".length),
    )
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.predicate.receipt.workflow).toMatchObject({
        caller: {
          ref: `example/public-gradle-app/.github/workflows/project-finish.yml@${SOURCE_HEAD}`,
          sha: SOURCE_HEAD,
        },
        reusable: {
          ref: `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${REUSABLE_SHA}`,
          sha: REUSABLE_SHA,
        },
      })
    }
  })

  it.each([
    ["caller ref", { callerWorkflowRef: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main" }],
    ["source identity", {
      source: {
        ...facts().source,
        identity: {
          ...facts().source.identity,
          repositoryHead: "c".repeat(40),
        },
      },
    }],
    ["zero tests", { test: { ...facts().test, count: 0, passed: 0 } }],
  ])("fails closed for a mismatched %s binding", (_name, override) => {
    expect(() => createProjectFinishAttestationProducerArtifacts({ ...facts(), ...override })).toThrow(
      "project-finish-producer-binding",
    )
  })
})

function facts(): ProjectFinishAttestationProducerFacts {
  return {
    buildArtifactDigest: `sha256:${"d".repeat(64)}`,
    callerWorkflowRef: `example/public-gradle-app/.github/workflows/project-finish.yml@${SOURCE_HEAD}`,
    callerWorkflowSha: SOURCE_HEAD,
    issuedAt: "2026-07-18T01:00:00.000Z",
    phVersion: "0.7.0",
    repository: {
      id: 987654321,
      slug: "example/public-gradle-app",
      visibility: "public",
    },
    reusableWorkflowSha: REUSABLE_SHA,
    runAttempt: 2,
    runId: "1001",
    source: {
      head: SOURCE_HEAD,
      identity: {
        contentDigest: `sha256:${"e".repeat(64)}`,
        entryCount: 5,
        exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"],
        gitStatusDigest: `sha256:${"f".repeat(64)}`,
        repositoryHead: SOURCE_HEAD,
        schemaVersion: "source-identity.1",
        trackedEntryCount: 5,
        trackedIndexDigest: `sha256:${"0".repeat(64)}`,
        untrackedEntryCount: 0,
      },
      root: ".",
    },
    test: {
      count: 4,
      junitDigest: `sha256:${"1".repeat(64)}`,
      passed: 3,
      skipped: 1,
    },
  }
}
