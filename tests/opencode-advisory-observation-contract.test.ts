import { describe, expect, it } from "vitest"

import {
  evaluateOpenCodeAdvisoryObservation,
  OPENCODE_ADVISORY_MODEL,
  OPENCODE_ADVISORY_OBSERVATION_SCHEMA_VERSION,
} from "../scripts/opencode-interview-observation-contract.mjs"

type AdvisoryCase = {
  caseId: string
  classification: string
  correctionVerified: boolean
  terminal: string
  metrics: {
    architectureGuessCount: number
    capsuleSize: number
    conflictOverwrites: number
    relevantRulePrecision: number
    repeatedCorrectionCount: number
    rollbackOutcome: string
  }
}

type AdvisoryObservation = {
  [key: string]: unknown
  schemaVersion: string
  binding: {
    base: string
    candidate: string
    configuredModel: string
    package: {
      contentIdentity: string
      name: string
      tarSha256: string
      version: string
    }
  }
  execution: {
    budgetDigest: string
    count: number
    sourceDigest: string
    taskDigest: string
    terminal: string
  }
  cases: AdvisoryCase[]
}

const binding = () => ({
  base: "a".repeat(40),
  candidate: "b".repeat(40),
  configuredModel: OPENCODE_ADVISORY_MODEL,
  package: {
    contentIdentity: "c".repeat(64),
    name: "persona-harness",
    tarSha256: "d".repeat(64),
    version: "0.8.10",
  },
})

function completeObservation(): AdvisoryObservation {
  return {
    schemaVersion: OPENCODE_ADVISORY_OBSERVATION_SCHEMA_VERSION,
    binding: binding(),
    execution: {
      budgetDigest: "e".repeat(64),
      count: 1,
      sourceDigest: "f".repeat(64),
      taskDigest: "0".repeat(64),
      terminal: "complete",
    },
    cases: [
      {
        caseId: "baseline",
        classification: "static-policy-overlay",
        correctionVerified: false,
        terminal: "complete",
        metrics: {
          architectureGuessCount: 2,
          capsuleSize: 100,
          conflictOverwrites: 0,
          relevantRulePrecision: 0.5,
          repeatedCorrectionCount: 3,
          rollbackOutcome: "not-applicable",
        },
      },
      {
        caseId: "profile",
        classification: "profile-captured-correction",
        correctionVerified: true,
        terminal: "complete",
        metrics: {
          architectureGuessCount: 1,
          capsuleSize: 150,
          conflictOverwrites: 0,
          relevantRulePrecision: 0.75,
          repeatedCorrectionCount: 1,
          rollbackOutcome: "passed",
        },
      },
    ],
  }
}

function expectedBinding() {
  return binding()
}

describe("OpenCode advisory observation contract", () => {
  it("normalizes a complete one-run A/B result with exact binding and case classifications", () => {
    const result = evaluateOpenCodeAdvisoryObservation(completeObservation(), expectedBinding())

    expect(result).toMatchObject({
      advisoryOnly: true,
      binding: expectedBinding(),
      code: "threshold-accepted",
      failedMetrics: [],
      schemaVersion: OPENCODE_ADVISORY_OBSERVATION_SCHEMA_VERSION,
      status: "PASS",
    })
    if (result.status === "UNKNOWN") throw new Error("expected a complete advisory result")
    expect(result.cases.map((item) => item.classification)).toEqual([
      "static-policy-overlay",
      "profile-captured-correction",
    ])
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(result.binding)).toBe(true)
  })

  it("returns an advisory FAIL when the fixed rejection threshold is not met", () => {
    const observation = completeObservation()
    observation.cases[1].metrics.repeatedCorrectionCount = 3
    observation.cases[1].metrics.rollbackOutcome = "failed"

    const result = evaluateOpenCodeAdvisoryObservation(observation, expectedBinding())

    expect(result).toMatchObject({ status: "FAIL", code: "threshold-rejected", advisoryOnly: true })
    if (result.status === "UNKNOWN") throw new Error("expected a scored advisory result")
    expect(result.failedMetrics).toEqual(["repeatedCorrectionCount", "rollbackOutcome"])
  })

  it("classifies an unsupported model as UNKNOWN without echoing the alias", () => {
    const observation = completeObservation()
    observation.binding.configuredModel = "other/provider-model"

    const result = evaluateOpenCodeAdvisoryObservation(observation, expectedBinding())

    expect(result).toEqual({
      advisoryOnly: true,
      code: "model-not-exact-spark",
      schemaVersion: OPENCODE_ADVISORY_OBSERVATION_SCHEMA_VERSION,
      status: "UNKNOWN",
    })
    expect(JSON.stringify(result)).not.toContain("other/provider-model")
  })

  it("classifies candidate or package drift as UNKNOWN before metric scoring", () => {
    const observation = completeObservation()
    observation.binding.package.tarSha256 = "1".repeat(64)

    const result = evaluateOpenCodeAdvisoryObservation(observation, expectedBinding())

    expect(result).toEqual({
      advisoryOnly: true,
      code: "binding-mismatch",
      schemaVersion: OPENCODE_ADVISORY_OBSERVATION_SCHEMA_VERSION,
      status: "UNKNOWN",
    })
  })

  it.each([
    ["missing", undefined, "result-missing"],
    ["multiple cases", { ...completeObservation(), cases: [...completeObservation().cases, completeObservation().cases[1]] }, "result-cardinality-invalid"],
    ["multiple executions", { ...completeObservation(), execution: { ...completeObservation().execution, count: 2 } }, "result-cardinality-invalid"],
    ["abnormal terminal", { ...completeObservation(), execution: { ...completeObservation().execution, terminal: "aborted" } }, "execution-abnormal"],
  ])("classifies %s as UNKNOWN", (_label, value, code) => {
    const result = evaluateOpenCodeAdvisoryObservation(value, expectedBinding())

    expect(result).toMatchObject({ status: "UNKNOWN", code, advisoryOnly: true })
  })

  it("requires one independently verified profile correction", () => {
    const observation = completeObservation()
    observation.cases[1].correctionVerified = false

    const result = evaluateOpenCodeAdvisoryObservation(observation, expectedBinding())

    expect(result).toMatchObject({ status: "UNKNOWN", code: "profile-correction-unverified" })
  })

  it("rejects raw fields and never reflects their values", () => {
    const observation = completeObservation()
    observation.prompt = "private prompt"
    observation.output = "private model output"
    observation.path = "/private/project/src/App.java"
    observation.token = "secret-token"

    const result = evaluateOpenCodeAdvisoryObservation(observation, expectedBinding())

    expect(result).toEqual({
      advisoryOnly: true,
      code: "secret-exposure",
      schemaVersion: OPENCODE_ADVISORY_OBSERVATION_SCHEMA_VERSION,
      status: "UNKNOWN",
    })
    expect(JSON.stringify(result)).not.toContain("private prompt")
    expect(JSON.stringify(result)).not.toContain("private model output")
    expect(JSON.stringify(result)).not.toContain("/private/project")
    expect(JSON.stringify(result)).not.toContain("secret-token")
  })
})
