import type { EvidenceAbReport } from "./evidence-ab-report.js"

type AbScenario = EvidenceAbReport["scenarios"][number]
type AbCondition = AbScenario["conditions"][number]
type AbRun = AbCondition["runs"][number]
type NumberMetric = AbCondition["metrics"]["elapsedMs"]
type MetricDirection = "higher" | "lower" | "same" | "unavailable"

export type PairedMetricInterpretation =
  | "aggregate-higher-but-paired-inconsistent"
  | "aggregate-lower-but-paired-inconsistent"
  | "insufficient-pairs"
  | "paired-consistent-improvement"
  | "paired-consistent-worse"
  | "paired-no-improvement"
  | "unavailable"

export type PairedMetricComparison = {
  readonly aggregateDirection: MetricDirection
  readonly candidateHigher: number
  readonly candidateLower: number
  readonly interpretation: PairedMetricInterpretation
  readonly signTestPValue: number | null
  readonly tied: number
  readonly totalComparable: number
}

export type PairedConsistencyReport = {
  readonly metrics: {
    readonly elapsedMs: PairedMetricComparison
    readonly mcpCalls: PairedMetricComparison
    readonly providerTokenTotal: PairedMetricComparison
    readonly readChars: PairedMetricComparison
    readonly toolCalls: PairedMetricComparison
  }
  readonly primaryMetric: "providerTokenTotal"
}

type MetricName = keyof PairedConsistencyReport["metrics"]

const MIN_CONSISTENCY_SAMPLE_SIZE = 10
const CONSISTENT_SHARE = 0.7

function metricDirection(left: NumberMetric, right: NumberMetric): MetricDirection {
  if (left.average === null || right.average === null) {
    return "unavailable"
  }
  if (right.average > left.average) {
    return "higher"
  }
  if (right.average < left.average) {
    return "lower"
  }
  return "same"
}

function metricValue(run: AbRun, metric: MetricName): number | null {
  if (metric === "elapsedMs") {
    return run.elapsedMs
  }
  if (metric === "mcpCalls") {
    return run.mcpCalls
  }
  if (metric === "providerTokenTotal") {
    return run.providerTokens.total
  }
  if (metric === "readChars") {
    return run.readChars
  }
  return run.toolCalls
}

function chooseProbability(n: number, k: number): number {
  let probability = 1
  for (let index = 1; index <= k; index += 1) {
    probability *= (n - (k - index)) / index
  }
  return probability
}

function signTestPValue(candidateLower: number, candidateHigher: number): number | null {
  const comparable = candidateLower + candidateHigher
  if (comparable === 0) {
    return null
  }
  const smallerTail = Math.min(candidateLower, candidateHigher)
  let probability = 0
  for (let count = 0; count <= smallerTail; count += 1) {
    probability += chooseProbability(comparable, count) * 0.5 ** comparable
  }
  return Math.min(1, probability * 2)
}

function consistentThreshold(totalComparable: number): number {
  return Math.ceil(totalComparable * CONSISTENT_SHARE)
}

function interpretation(
  aggregateDirection: MetricDirection,
  candidateLower: number,
  candidateHigher: number,
  tied: number,
): PairedMetricInterpretation {
  const totalComparable = candidateLower + candidateHigher + tied
  if (aggregateDirection === "unavailable" || totalComparable === 0) {
    return "unavailable"
  }
  if (aggregateDirection === "same") {
    return candidateLower === 0 && candidateHigher === 0 ? "paired-no-improvement" : "insufficient-pairs"
  }
  if (totalComparable < MIN_CONSISTENCY_SAMPLE_SIZE) {
    return "insufficient-pairs"
  }
  const threshold = consistentThreshold(totalComparable)
  if (aggregateDirection === "lower") {
    return candidateLower >= threshold ? "paired-consistent-improvement" : "aggregate-lower-but-paired-inconsistent"
  }
  return candidateHigher >= threshold ? "paired-consistent-worse" : "aggregate-higher-but-paired-inconsistent"
}

function compareMetric(baseline: AbCondition, candidate: AbCondition, metric: MetricName): PairedMetricComparison {
  let candidateLower = 0
  let candidateHigher = 0
  let tied = 0
  const pairCount = Math.min(baseline.runs.length, candidate.runs.length)
  for (let index = 0; index < pairCount; index += 1) {
    const baselineRun = baseline.runs[index]
    const candidateRun = candidate.runs[index]
    if (baselineRun === undefined || candidateRun === undefined) {
      continue
    }
    const baselineValue = metricValue(baselineRun, metric)
    const candidateValue = metricValue(candidateRun, metric)
    if (baselineValue === null || candidateValue === null) {
      continue
    }
    if (candidateValue < baselineValue) {
      candidateLower += 1
    } else if (candidateValue > baselineValue) {
      candidateHigher += 1
    } else {
      tied += 1
    }
  }
  const aggregateDirection = metricDirection(baseline.metrics[metric], candidate.metrics[metric])
  return {
    aggregateDirection,
    candidateHigher,
    candidateLower,
    interpretation: interpretation(aggregateDirection, candidateLower, candidateHigher, tied),
    signTestPValue: signTestPValue(candidateLower, candidateHigher),
    tied,
    totalComparable: candidateLower + candidateHigher + tied,
  }
}

export function pairedConsistencyReport(baseline: AbCondition, candidate: AbCondition): PairedConsistencyReport {
  return {
    metrics: {
      elapsedMs: compareMetric(baseline, candidate, "elapsedMs"),
      mcpCalls: compareMetric(baseline, candidate, "mcpCalls"),
      providerTokenTotal: compareMetric(baseline, candidate, "providerTokenTotal"),
      readChars: compareMetric(baseline, candidate, "readChars"),
      toolCalls: compareMetric(baseline, candidate, "toolCalls"),
    },
    primaryMetric: "providerTokenTotal",
  }
}
