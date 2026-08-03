import { describe, expect, it } from "vitest"

import {
  AUTHORITY_DISCOVERY_EXERCISE_MARKER,
  assessAuthorityDiscoveryExerciseResult,
  createAuthorityDiscoveryExerciseResult,
  formatAuthorityDiscoveryExerciseResult,
} from "../scripts/consumer-authority-authority-discovery-exercise.mjs"

describe("consumer authority discovery exercise result", () => {
  it("accepts only the fixed trusted and persisted result for its own surface", () => {
    const output = `${formatAuthorityDiscoveryExerciseResult(createAuthorityDiscoveryExerciseResult("source-built"))}\n`

    expect(assessAuthorityDiscoveryExerciseResult(output, "source-built")).toEqual({ state: "ready" })
  })

  it("rejects malformed, foreign, duplicate, and blocked-then-success results without reflecting input", () => {
    const hostile = "/private/consumer/ghp_discovery_result_marker"
    const valid = formatAuthorityDiscoveryExerciseResult(createAuthorityDiscoveryExerciseResult("source-built"))
    const foreign = `${AUTHORITY_DISCOVERY_EXERCISE_MARKER}: ${JSON.stringify({
      result: "trusted-unconsumed-persisted",
      schemaVersion: "consumer-authority-discovery-exercise.1",
      surface: "fresh-tar",
    })}`
    const malformed = `${AUTHORITY_DISCOVERY_EXERCISE_MARKER}: ${JSON.stringify({
      result: "trusted-unconsumed-persisted",
      schemaVersion: "consumer-authority-discovery-exercise.1",
      surface: "source-built",
      unsafe: hostile,
    })}`

    for (const output of [
      "",
      foreign,
      malformed,
      `${valid}\n${valid}`,
      `${AUTHORITY_DISCOVERY_EXERCISE_MARKER}: ${JSON.stringify({
        result: "blocked",
        schemaVersion: "consumer-authority-discovery-exercise.1",
        surface: "source-built",
      })}\n${valid}`,
    ]) {
      const outcome = assessAuthorityDiscoveryExerciseResult(output, "source-built")
      expect(outcome).toEqual({ state: "invalid" })
      expect(JSON.stringify(outcome)).not.toContain(hostile)
    }
  })
})
