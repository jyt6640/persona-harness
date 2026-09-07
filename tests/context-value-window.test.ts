import { describe, expect, it } from "vitest"
import { evaluateContextValueWindow } from "../scripts/eval/context-value-window.mjs"

function fixture() {
  return {
    protocol: "context-value-window.1",
    registrationDigest: "a".repeat(64),
    host: "codex",
    scenarios: ["clear-change", "material-decision", "multi-file-resume"],
    pairs: Array.from({ length: 6 }, (_, index) => ({
      scenario: ["clear-change", "material-decision", "multi-file-resume"][Math.floor(index / 2)],
      repetition: index % 2 + 1,
      order: index % 2 === 0 ? "AB" : "BA",
      a: run(1_000, 10_000, "baseline"),
      b: run(900, 10_000, "candidate"),
    })),
  }
}

function run(harnessTokens: number, taskTokens: number, artifact: string) {
  return {
    artifactDigest: artifact === "baseline" ? "b".repeat(64) : "c".repeat(64),
    valueContractDigest: "d".repeat(64),
    startRepositoryDigest: "e".repeat(64),
    requirementsDigest: "f".repeat(64),
    profileDigest: "1".repeat(64),
    decisionsDigest: "2".repeat(64),
    settingsDigest: "3".repeat(64),
    hostVersion: "recorded-fixture-version",
    cacheCondition: "cold",
    outcome: "completed",
    profileActive: true,
    contextActive: true,
    requiredMeaningPreserved: true,
    majorQualityRegression: false,
    accountingComplete: true,
    usageBasis: "provider-task-total",
    harnessBasis: "observed-delivered-tokens",
    harnessTokens,
    taskTokens,
  }
}

describe("equal-value six-pair numeric window", () => {
  it("accepts exact numeric boundaries without claiming product or host proof", () => {
    expect(evaluateContextValueWindow(fixture())).toMatchObject({
      status: "ready", numericalVerdict: "MEETS_CRITERIA", productVerdict: "UNVERIFIED",
      pairs: 6, nonIncreasingPairs: 6, harnessReductionPercent: 10,
      medians: { harnessA: 1_000, harnessB: 900, taskA: 10_000, taskB: 10_000 },
    })
  })

  it("does not round 9.9 percent into the ten percent threshold", () => {
    const input = fixture()
    for (const pair of input.pairs) pair.b.harnessTokens = 901
    expect(evaluateContextValueWindow(input)).toMatchObject({ numericalVerdict: "NOT_IMPROVED" })
  })

  it("requires four non-increasing pairs even when both medians pass", () => {
    const input = fixture()
    input.pairs.forEach((pair, index) => { pair.b.taskTokens = index < 3 ? 9_000 : 11_000 })
    expect(evaluateContextValueWindow(input)).toMatchObject({ numericalVerdict: "NOT_IMPROVED", nonIncreasingPairs: 3 })
  })

  it.each(["profileActive", "contextActive", "requiredMeaningPreserved", "accountingComplete"])("rejects value loss or incomplete accounting: %s", (field) => {
    const input = fixture()
    Object.assign(input.pairs[0]?.b ?? {}, { [field]: false })
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive" })
  })

  it.each(["failed", "cancelled", "blocked"])("retains %s runs as inconclusive instead of filtering them", (outcome) => {
    const input = fixture()
    Object.assign(input.pairs[0]?.b ?? {}, { outcome, harnessTokens: 0, taskTokens: 0 })
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive", pairs: 6 })
  })

  it.each(["settingsDigest", "profileDigest", "decisionsDigest", "requirementsDigest", "startRepositoryDigest", "valueContractDigest", "cacheCondition", "hostVersion"])("rejects an unmatched %s", (field) => {
    const input = fixture()
    Object.assign(input.pairs[0]?.b ?? {}, { [field]: field.endsWith("Digest") ? "9".repeat(64) : "different" })
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive" })
  })

  it.each([null, -1, NaN, Infinity, 12.5])("does not turn missing or invalid usage into zero: %s", (taskTokens) => {
    const input = fixture()
    Object.assign(input.pairs[0]?.b ?? {}, { taskTokens })
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive" })
  })

  it.each(["character-estimate", "offered-tokens"])("rejects %s as actual delivered harness tokens", (harnessBasis) => {
    const input = fixture()
    Object.assign(input.pairs[0]?.b ?? {}, { harnessBasis })
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive" })
  })

  it("rejects missing pairs, duplicate repetitions, unbalanced orders and mixed artifacts", () => {
    const missing = fixture()
    missing.pairs.pop()
    const duplicate = fixture()
    Object.assign(duplicate.pairs[1] ?? {}, { repetition: 1 })
    const order = fixture()
    for (const pair of order.pairs) pair.order = "AB"
    const artifact = fixture()
    Object.assign(artifact.pairs[0]?.b ?? {}, { artifactDigest: "9".repeat(64) })
    for (const input of [missing, duplicate, order, artifact]) {
      expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive" })
    }
  })

  it("keeps each host separate and rejects historical comparison records", () => {
    const claude = fixture()
    claude.host = "claude"
    expect(evaluateContextValueWindow(claude)).toMatchObject({ host: "claude", numericalVerdict: "MEETS_CRITERIA" })
    expect(evaluateContextValueWindow({ records: [], productVerdict: "PRODUCT_GO" })).toMatchObject({ status: "inconclusive" })
  })

  it("accepts four non-increasing pairs but still rejects an increased task median", () => {
    const input = fixture()
    input.pairs.forEach((pair, index) => { pair.b.taskTokens = index < 4 ? 10_000 : 11_000 })
    expect(evaluateContextValueWindow(input)).toMatchObject({ numericalVerdict: "MEETS_CRITERIA", nonIncreasingPairs: 4 })
    for (const pair of input.pairs) pair.b.taskTokens = 10_001
    expect(evaluateContextValueWindow(input)).toMatchObject({ numericalVerdict: "NOT_IMPROVED" })
  })

  it("does not infer a zero-payload explanation or divide by a zero baseline", () => {
    const input = fixture()
    for (const pair of input.pairs) pair.b.harnessTokens = 0
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive", reasons: ["zero-injection-unexplained"] })
    for (const pair of input.pairs) Object.assign(pair.b, { zeroInjectionReason: "already-present" })
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "ready" })
    for (const pair of input.pairs) Object.assign(pair.a, { harnessTokens: 0, zeroInjectionReason: "no-relevant-rules" })
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive", reasons: ["baseline-harness-zero"] })
  })

  it("rejects an explicitly reported quality regression", () => {
    const input = fixture()
    Object.assign(input.pairs[0]?.b ?? {}, { majorQualityRegression: true })
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive", reasons: ["value-unverified-or-lost"] })
  })

  it("never adds cache or reasoning counters to the normalized provider total", () => {
    const input = fixture()
    for (const pair of input.pairs) Object.assign(pair.b, { cacheTokens: 8_000, reasoningTokens: 2_000 })
    expect(evaluateContextValueWindow(input)).toMatchObject({ medians: { taskB: 10_000 } })
  })

  it.each([null, [], {}, { pairs: [null] }])("fails closed on malformed window input", (input) => {
    expect(evaluateContextValueWindow(input)).toMatchObject({ status: "inconclusive", productVerdict: "UNVERIFIED" })
  })
})
