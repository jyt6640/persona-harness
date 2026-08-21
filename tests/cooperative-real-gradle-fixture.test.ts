import { describe, expect, it } from "vitest"

import {
  isRetryableMavenCentralRateLimit,
  warmRealCooperativeGradleDependencies,
  type RealGradleWarmupResult,
} from "./helpers/cooperative-real-gradle-fixture.js"

describe("real cooperative Gradle dependency warmup", () => {
  it("retries exactly once when Maven Central returns HTTP 429", () => {
    const outcomes: readonly RealGradleWarmupResult[] = [
      failedWarmup("Could not GET https://repo.maven.apache.org/maven2/example.pom. Received status code 429 from server: Too Many Requests"),
      successfulWarmup(),
    ]
    let calls = 0
    let pauses = 0

    warmRealCooperativeGradleDependencies(
      "/fixture",
      () => readOutcome(outcomes, calls++),
      () => { pauses += 1 },
    )

    expect(calls).toBe(2)
    expect(pauses).toBe(1)
  })

  it("does not retry a non-Maven Gradle failure", () => {
    let calls = 0
    let pauses = 0

    expect(() => warmRealCooperativeGradleDependencies(
      "/fixture",
      () => {
        calls += 1
        return failedWarmup("Task :test FAILED")
      },
      () => { pauses += 1 },
    )).toThrow("real-cooperative-gradle-warmup-failed")

    expect(calls).toBe(1)
    expect(pauses).toBe(0)
  })

  it("stops after the one allowed Maven Central retry", () => {
    const outcome = failedWarmup("Could not GET https://repo.maven.apache.org/maven2/example.pom. Received status code 429 from server: Too Many Requests")
    let calls = 0
    let pauses = 0

    expect(() => warmRealCooperativeGradleDependencies(
      "/fixture",
      () => {
        calls += 1
        return outcome
      },
      () => { pauses += 1 },
    )).toThrow("real-cooperative-gradle-warmup-failed")

    expect(calls).toBe(2)
    expect(pauses).toBe(1)
  })
})

function successfulWarmup(): RealGradleWarmupResult {
  return { output: "BUILD SUCCESSFUL", status: 0 }
}

function failedWarmup(output: string): RealGradleWarmupResult {
  return { output, status: 1 }
}

function readOutcome(outcomes: readonly RealGradleWarmupResult[], index: number): RealGradleWarmupResult {
  const outcome = outcomes[index]
  if (outcome === undefined) throw new Error("missing Gradle warmup test outcome")
  return outcome
}
