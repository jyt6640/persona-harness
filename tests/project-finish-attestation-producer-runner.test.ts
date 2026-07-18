import { describe, expect, it } from "vitest"

import {
  runProjectFinishAttestationProducer,
} from "../src/cli/project-finish-attestation-producer-runner.js"
import type {
  CooperativeGradleVerification,
} from "../src/cli/cooperative-gradle-verification.js"

const SOURCE_HEAD = "a".repeat(40)
const REUSABLE_SHA = "b".repeat(40)

describe("project finish attestation producer runner", () => {
  it("binds only a fresh fixed Gradle result to derived workflow context", () => {
    const result = runProjectFinishAttestationProducer(
      "/fixture/project",
      context(),
      "0.7.0",
      options(() => verifiedGradle()),
    )

    expect(result).toMatchObject({
      kind: "passed",
      value: {
        receipt: {
          source: { head: SOURCE_HEAD },
          test: { count: 3, failed: 0, passed: 3, skipped: 0 },
        },
      },
    })
  })

  it.each([
    ["source checkout", { sourceHead: "c".repeat(40) }],
    ["caller workflow SHA", { callerWorkflowSha: "c".repeat(40) }],
    ["external repository visibility", {
      repository: {
        ...context().repository,
        visibility: "private" as const,
      },
    }],
  ])("blocks a mismatched %s without producing artifacts", (_name, override) => {
    const result = runProjectFinishAttestationProducer(
      "/fixture/project",
      { ...context(), ...override },
      "0.7.0",
      options(() => verifiedGradle()),
    )

    expect(result).toEqual({
      code: "project-finish-producer-binding",
      kind: "blocked",
    })
  })

  it("preserves a bounded fresh-verification block without attempting artifacts", () => {
    const result = runProjectFinishAttestationProducer(
      "/fixture/project",
      context(),
      "0.7.0",
      options(() => ({ code: "junit-malformed-xml", kind: "blocked" })),
    )

    expect(result).toEqual({ code: "junit-malformed-xml", kind: "blocked" })
  })
})

function context() {
  return {
    callerWorkflowRef: `example/public-gradle-app/.github/workflows/project-finish.yml@${SOURCE_HEAD}`,
    callerWorkflowSha: SOURCE_HEAD,
    issuedAt: "2026-07-18T01:00:00.000Z",
    repository: {
      id: 987654321,
      slug: "example/public-gradle-app",
      visibility: "public" as const,
    },
    reusableWorkflowSha: REUSABLE_SHA,
    runAttempt: 2,
    runId: "1001",
    sourceHead: SOURCE_HEAD,
  }
}

function verifiedGradle(): CooperativeGradleVerification {
  return {
    kind: "passed",
    value: {
      buildOutputDigest: `sha256:${"d".repeat(64)}`,
      commandPlanDigest: `sha256:${"e".repeat(64)}`,
      junitDigest: `sha256:${"f".repeat(64)}`,
      passedTestCount: 3,
      skippedTestCount: 0,
      sourceIdentity: {
        contentDigest: `sha256:${"0".repeat(64)}`,
        entryCount: 5,
        exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"],
        gitStatusDigest: `sha256:${"1".repeat(64)}`,
        repositoryHead: SOURCE_HEAD,
        schemaVersion: "source-identity.1",
        trackedEntryCount: 5,
        trackedIndexDigest: `sha256:${"2".repeat(64)}`,
        untrackedEntryCount: 0,
      },
      sourceSnapshotDigest: `sha256:${"0".repeat(64)}`,
      testCount: 3,
    },
  }
}

function options(verify: () => CooperativeGradleVerification) {
  return {
    prepareContext: () => ({
      kind: "ready" as const,
      value: {
        evidenceRoot: "/fixture/project/.persona/evidence",
        evidenceRootRelativePath: ".persona/evidence",
        workspace: {
          dev: "1",
          ino: "2",
          realpath: "/fixture/project",
        },
      },
    }),
    verify: () => verify(),
  }
}
