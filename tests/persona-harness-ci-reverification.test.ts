import { describe, expect, it } from "vitest"

import {
  parseCiReverificationArtifact,
  serializeCiReverificationArtifact,
  type CiReverificationArtifact,
} from "../src/cli/ci-reverification-artifact.js"
import { determineCiReverificationFinalStatus } from "../src/cli/ci-reverification-model.js"
import { classifyObservedMutations, parseGitStatusPorcelain } from "../src/cli/ci-reverification-mutation.js"
import { parseWorkflowArgs } from "../src/cli/workflow-args.js"

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
      mutationSnapshot: { schemaVersion: "mutationSnapshot.1" },
      profileSha256: "2".repeat(64),
      schemaVersion: "ph-ci-reverification.1",
    }
    const source = serializeCiReverificationArtifact(artifact)
    expect(source).toBeDefined()
    expect(parseCiReverificationArtifact(source ?? "")).toEqual(artifact)
    expect(parseCiReverificationArtifact(JSON.stringify({ ...artifact, stdout: "secret" }))).toBeUndefined()
    expect(serializeCiReverificationArtifact({
      ...artifact,
      mutationSnapshot: { paths: ["x".repeat(300_000)], schemaVersion: "mutationSnapshot.1" },
    })).toBeUndefined()
  })
})
