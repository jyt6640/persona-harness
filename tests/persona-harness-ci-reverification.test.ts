import { describe, expect, it } from "vitest"

import {
  parseCiReverificationArtifact,
  serializeCiReverificationArtifact,
  type CiReverificationArtifact,
} from "../src/cli/ci-reverification-artifact.js"
import { determineCiReverificationFinalStatus } from "../src/cli/ci-reverification-model.js"
import { classifyObservedMutations, parseGitStatusPorcelain } from "../src/cli/ci-reverification-mutation.js"
import type { MutationSnapshot } from "../src/cli/ci-reverification-mutation-snapshot.js"
import { parseWorkflowArgs } from "../src/cli/workflow-args.js"

const SHA256 = `sha256:${"a".repeat(64)}`
const STATUS_SHA256 = "b".repeat(64)

describe("CI evidence reverification", () => {
  it("parses local and explicit CI finish reverification flags", () => {
    expect(parseWorkflowArgs(["finish", "implement", "--reverify"])).toEqual({
      ci: false,
      kind: "finish",
      reverify: true,
      runnerKind: "implement",
    })
    expect(parseWorkflowArgs(["finish", "implement", "--reverify", "--ci"])).toEqual({
      ci: true,
      kind: "finish",
      reverify: true,
      runnerKind: "implement",
    })
    expect(parseWorkflowArgs(["finish", "implement", "--ci", "--reverify"])).toEqual({
      ci: true,
      kind: "finish",
      reverify: true,
      runnerKind: "implement",
    })
  })

  it("rejects bare CI and unsupported finish flags", () => {
    expect(parseWorkflowArgs(["finish", "implement", "--ci"])).toEqual({
      kind: "invalid",
      message: "workflow finish --ci requires --reverify.",
    })
    expect(parseWorkflowArgs(["finish", "implement", "--reverify", "--json"])).toEqual({
      kind: "invalid",
      message: "workflow finish implement accepts only --reverify and --ci.",
    })
    expect(parseWorkflowArgs(["finish", "implement", "--reverify", "--reverify"])).toEqual({
      kind: "invalid",
      message: "workflow finish implement does not accept duplicate flags.",
    })
  })

  it.each([
    {
      expected: "unavailable",
      input: { artifactValid: true, ciDisallowedTrackedMutation: false, commands: [], identityPartial: false, preflightAvailable: false },
    },
    {
      expected: "timeout",
      input: {
        artifactValid: false,
        ciDisallowedTrackedMutation: true,
        commands: [{ outcome: "timeout", started: true }],
        identityPartial: true,
        preflightAvailable: true,
      },
    },
    {
      expected: "artifact-invalid",
      input: {
        artifactValid: false,
        ciDisallowedTrackedMutation: true,
        commands: [{ outcome: "failed", started: true }],
        identityPartial: true,
        preflightAvailable: true,
      },
    },
    {
      expected: "partial",
      input: {
        artifactValid: true,
        ciDisallowedTrackedMutation: true,
        commands: [{ outcome: "passed", started: true }],
        identityPartial: false,
        preflightAvailable: true,
      },
    },
    {
      expected: "failed",
      input: {
        artifactValid: true,
        ciDisallowedTrackedMutation: false,
        commands: [{ outcome: "failed", started: true }],
        identityPartial: false,
        preflightAvailable: true,
      },
    },
    {
      expected: "partial",
      input: {
        artifactValid: true,
        ciDisallowedTrackedMutation: false,
        commands: [{ outcome: "passed", started: true }, { outcome: "failed", started: true }],
        identityPartial: false,
        preflightAvailable: true,
      },
    },
    {
      expected: "passed",
      input: {
        artifactValid: true,
        ciDisallowedTrackedMutation: false,
        commands: [{ outcome: "passed", started: true }, { outcome: "passed", started: true }],
        identityPartial: false,
        preflightAvailable: true,
      },
    },
  ] as const)("applies final-status precedence for $expected", ({ expected, input }) => {
    expect(determineCiReverificationFinalStatus(input)).toBe(expected)
  })

  it("normalizes every tracked mutation category and rename identity", () => {
    const snapshot = parseGitStatusPorcelain([
      " M src/Main.java",
      "A  src/New.java",
      " D src/Old.java",
      "R  src/Renamed.java",
      "src/Before.java",
      "T  config/app.yml",
      "?? notes.txt",
      "",
    ].join("\0"))

    expect(snapshot.entryCount).toBe(6)
    expect(snapshot.entries).toEqual(expect.arrayContaining([
      { kind: "trackedModified", path: "src/Main.java" },
      { kind: "added", path: "src/New.java" },
      { kind: "deleted", path: "src/Old.java" },
      { kind: "renamed", newPath: "src/Renamed.java", oldPath: "src/Before.java" },
      { kind: "typeChanged", path: "config/app.yml" },
      { kind: "untracked", path: "notes.txt" },
    ]))
    expect(snapshot.digest).toMatch(/^[a-f0-9]{64}$/u)
  })

  it("allows only Gradle roots in CI and keeps local mutations report-only", () => {
    const pre = parseGitStatusPorcelain("")
    const post = parseGitStatusPorcelain([
      " M build/generated.txt",
      " M .gradle/cache.bin",
      " M src/main/java/App.java",
      "?? local.log",
      "",
    ].join("\0"))

    expect(classifyObservedMutations(pre, post, "ci")).toMatchObject({
      allowedTracked: [".gradle/cache.bin", "build/generated.txt"],
      decision: "partial",
      disallowedTracked: ["src/main/java/App.java"],
      untracked: ["local.log"],
    })
    expect(classifyObservedMutations(pre, post, "local")).toMatchObject({
      decision: "report-only",
      disallowedTracked: [],
      untracked: ["local.log"],
    })
  })

  it("strictly rejects raw output keys and artifacts above 256 KiB", () => {
    const artifact: CiReverificationArtifact = {
      attemptId: "attempt-1",
      commandCatalogId: "java-spring-gradle-wrapper.1",
      commandPlanSha256: "1".repeat(64),
      commands: [],
      diagnosticCodes: [],
      finalStatus: "passed",
      mode: "ci",
      mutationSnapshot: validMutationSnapshot(),
      profileSha256: "2".repeat(64),
      schemaVersion: "ph-ci-reverification.1",
    }
    const source = serializeCiReverificationArtifact(artifact)
    expect(source).toBeDefined()
    expect(parseCiReverificationArtifact(source ?? "")).toEqual(artifact)
    expect(parseCiReverificationArtifact(JSON.stringify({ ...artifact, stdout: "secret" }))).toBeUndefined()
    expect(serializeCiReverificationArtifact({
      ...artifact,
      commands: Array.from({ length: 5_000 }, (_, index) => ({
        durationMs: 0,
        exitCode: 0,
        fixedArgvId: "gradle-wrapper-test.1" as const,
        junitRefs: [`build/test-results/test/${String(index).padStart(5, "0")}.xml`],
        ordinal: index + 1,
        outcome: "passed" as const,
        stderrBytes: 0,
        stderrSha256: "3".repeat(64),
        stdoutBytes: 0,
        stdoutSha256: "4".repeat(64),
      })),
    })).toBeUndefined()
  })

  it("rejects legacy or raw mutation snapshot shapes without migration", () => {
    const legacyArtifact: unknown = {
      attemptId: "attempt-legacy",
      commandCatalogId: "java-spring-gradle-wrapper.1",
      commandPlanSha256: "1".repeat(64),
      commands: [],
      diagnosticCodes: [],
      finalStatus: "passed",
      mode: "ci",
      mutationSnapshot: {
        schemaVersion: "mutationSnapshot.1",
        workspaceRoot: {
          pre: {
            dev: "1",
            ino: "2",
            realpath: "/private/tmp/raw-project-root",
          },
        },
      },
      profileSha256: "2".repeat(64),
      schemaVersion: "ph-ci-reverification.1",
    }

    expect(parseCiReverificationArtifact(JSON.stringify(legacyArtifact))).toBeUndefined()
  })

  it.each([
    ["a raw realpath", (snapshot: Record<string, unknown>) => {
      const workspace = snapshot["workspaceRoot"] as Record<string, unknown>
      const pre = workspace["pre"] as Record<string, unknown>
      pre["realpath"] = "/private/tmp/raw-project-root"
    }],
    ["a parent path escape", (snapshot: Record<string, unknown>) => {
      const parent = snapshot["artifactParent"] as Record<string, unknown>
      parent["relativePath"] = "../outside"
      const pre = parent["pre"] as Record<string, unknown>
      pre["relativePath"] = "../outside"
    }],
    ["a Windows path", (snapshot: Record<string, unknown>) => {
      const parent = snapshot["artifactParent"] as Record<string, unknown>
      parent["relativePath"] = "C:\\Users\\private"
      const pre = parent["pre"] as Record<string, unknown>
      pre["relativePath"] = "C:\\Users\\private"
    }],
    ["a UNC path", (snapshot: Record<string, unknown>) => {
      const parent = snapshot["artifactParent"] as Record<string, unknown>
      parent["relativePath"] = "\\\\server\\share"
      const pre = parent["pre"] as Record<string, unknown>
      pre["relativePath"] = "\\\\server\\share"
    }],
    ["a token-shaped relative path", (snapshot: Record<string, unknown>) => {
      const parent = snapshot["artifactParent"] as Record<string, unknown>
      parent["relativePath"] = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
      const pre = parent["pre"] as Record<string, unknown>
      pre["relativePath"] = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    }],
    ["an unknown snapshot schema", (snapshot: Record<string, unknown>) => {
      snapshot["schemaVersion"] = "mutationSnapshot.3"
    }],
  ])("rejects %s without accepting a raw artifact projection", (_label, mutate) => {
    const artifact = validArtifact()
    const snapshot = JSON.parse(JSON.stringify(artifact.mutationSnapshot)) as Record<string, unknown>
    mutate(snapshot)

    expect(parseCiReverificationArtifact(JSON.stringify({
      ...artifact,
      mutationSnapshot: snapshot,
    }))).toBeUndefined()
  })

  it("rejects unsafe JUnit references before a local artifact can reach consumers", () => {
    const artifact = validArtifact()
    expect(parseCiReverificationArtifact(JSON.stringify({
      ...artifact,
      commands: [{
        durationMs: 0,
        exitCode: 0,
        fixedArgvId: "gradle-wrapper-test.1",
        junitRefs: ["/private/tmp/external.xml"],
        ordinal: 1,
        outcome: "passed",
        stderrBytes: 0,
        stderrSha256: "3".repeat(64),
        stdoutBytes: 0,
        stdoutSha256: "4".repeat(64),
      }],
    }))).toBeUndefined()
  })
})

function validArtifact(): CiReverificationArtifact {
  return {
    attemptId: "attempt-1",
    commandCatalogId: "java-spring-gradle-wrapper.1",
    commandPlanSha256: "1".repeat(64),
    commands: [],
    diagnosticCodes: [],
    finalStatus: "passed",
    mode: "ci",
    mutationSnapshot: validMutationSnapshot(),
    profileSha256: "2".repeat(64),
    schemaVersion: "ph-ci-reverification.1",
  }
}

function validMutationSnapshot(): MutationSnapshot {
  const root = {
    deviceIdentity: "1:2",
    identityDigest: SHA256,
    relativePath: ".",
  } as const
  const evidence = {
    deviceIdentity: "1:3",
    identityDigest: SHA256,
    relativePath: ".persona/evidence",
  } as const
  const sourceIdentity = {
    contentDigest: SHA256,
    entryCount: 0,
    exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"] as const,
    gitStatusDigest: SHA256,
    repositoryHead: "a".repeat(40),
    schemaVersion: "source-identity.1" as const,
    trackedEntryCount: 0,
    trackedIndexDigest: SHA256,
    untrackedEntryCount: 0,
  }
  const emptyDigest = { count: 0, digest: SHA256 } as const
  return {
    allowlist: {
      allowedTracked: emptyDigest,
      id: "java-spring-gradle-wrapper.1",
      roots: ["build/**", ".gradle/**"],
    },
    artifactParent: {
      equal: true,
      post: evidence,
      pre: evidence,
      relativePath: ".persona/evidence",
    },
    decision: "allowed",
    disallowedTracked: emptyDigest,
    git: {
      available: true,
      diagnosticCode: "git-identity-available",
      headEqual: true,
      postHead: "a".repeat(40),
      preHead: "a".repeat(40),
    },
    kind: "complete",
    observed: emptyDigest,
    post: {
      entryCount: 0,
      normalizedPorcelainNameStatusNulSha256: STATUS_SHA256,
    },
    pre: {
      entryCount: 0,
      normalizedPorcelainNameStatusNulSha256: STATUS_SHA256,
    },
    schemaVersion: "mutationSnapshot.2",
    sourceIdentity: {
      equal: true,
      post: sourceIdentity,
      pre: sourceIdentity,
    },
    untracked: emptyDigest,
    workspaceRoot: {
      equal: true,
      post: root,
      pre: root,
    },
  }
}
