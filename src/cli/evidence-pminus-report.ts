import type { EvidenceAbReport } from "./evidence-ab-report.js"
import { readEvidenceAbReport } from "./evidence-ab-report.js"
export { formatEvidencePminusReport } from "./evidence-pminus-format.js"
import type { PairedConsistencyReport, PairedMetricComparison } from "./evidence-pminus-paired.js"
import { pairedConsistencyReport } from "./evidence-pminus-paired.js"

type EvidencePminusOptions = {
  readonly projectDir?: string
}

type AbScenario = EvidenceAbReport["scenarios"][number]
type AbCondition = AbScenario["conditions"][number]
type NumberMetric = AbCondition["metrics"]["elapsedMs"]

type MetricDirection = "higher" | "lower" | "same" | "unavailable"
export type PminusDecisionHint =
  | "downgrade"
  | "keep"
  | "keep-gathering"
  | "keep-opt-in"
  | "no-claim"
  | "remove-candidate"
type PminusOutcome = "improved" | "inconclusive" | "no-improvement" | "worse"
type TelemetryAvailability = "available" | "missing" | "partial"

export type EvidencePminusScenarioReport = {
  readonly baselineCondition: string | null
  readonly candidateCondition: string | null
  readonly evidenceFiles: readonly string[]
  readonly id: string
  readonly killCriterion: string
  readonly label: string
  readonly outcome: PminusOutcome
  readonly pairedConsistency: PairedConsistencyReport
  readonly reason: string
  readonly surface: AbScenario["surface"]
  readonly surfaceDecisionHint: PminusDecisionHint
  readonly telemetry: {
    readonly providerTokens: TelemetryAvailability
    readonly secondaryMetrics: {
      readonly elapsedMs: MetricDirection
      readonly mcpCalls: MetricDirection
      readonly readChars: MetricDirection
      readonly toolCalls: MetricDirection
    }
  }
}

export type EvidencePminusReport = {
  readonly evidenceDir: string
  readonly filesScanned: number
  readonly limitations: readonly string[]
  readonly projectDir: string
  readonly scenarios: readonly EvidencePminusScenarioReport[]
  readonly schemaVersion: "evidence-pminus-report.1"
  readonly unreadableFiles: readonly string[]
}

export const KILL_CRITERION =
  "Kill criteria are decision support only: repeated matched scenarios with worse or no-improvement should trigger keep-opt-in, downgrade, or remove review; this command does not delete, downgrade, or mutate configuration."

function conditionRolePattern(role: "baseline" | "candidate"): RegExp {
  return role === "baseline" ? /\b(baseline|control|off)\b/iu : /\b(candidate|enabled|on|preview|treatment)\b/iu
}

function matchesRole(condition: AbCondition, role: "baseline" | "candidate"): boolean {
  const pattern = conditionRolePattern(role)
  return pattern.test(condition.id) || pattern.test(condition.label)
}

function comparableConditions(scenario: AbScenario): {
  readonly baseline: AbCondition | undefined
  readonly candidate: AbCondition | undefined
} {
  const baseline = scenario.conditions.find((condition) => matchesRole(condition, "baseline")) ?? scenario.conditions[0]
  const candidate =
    scenario.conditions.find((condition) => condition.id !== baseline?.id && matchesRole(condition, "candidate"))
    ?? scenario.conditions.find((condition) => condition.id !== baseline?.id)
  return { baseline, candidate }
}

function telemetryAvailability(left: NumberMetric, right: NumberMetric): TelemetryAvailability {
  if (left.samples > 0 && right.samples > 0) {
    return "available"
  }
  return left.samples === 0 && right.samples === 0 ? "missing" : "partial"
}

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

function pairedProviderPhrase(comparison: PairedMetricComparison): string {
  const signTest = comparison.signTestPValue === null ? "n/a" : comparison.signTestPValue.toFixed(5)
  return `paired candidate-lower ${comparison.candidateLower}/${comparison.totalComparable}, higher ${comparison.candidateHigher}, tied ${comparison.tied}, sign-test p ${signTest}`
}

function outcomeFromProviderTokens(left: NumberMetric, right: NumberMetric, pairedProviderTokens: PairedMetricComparison): {
  readonly outcome: PminusOutcome
  readonly reason: string
} | undefined {
  const direction = metricDirection(left, right)
  if (direction === "lower") {
    if (pairedProviderTokens.interpretation === "aggregate-lower-but-paired-inconsistent") {
      return {
        outcome: "improved",
        reason: `Candidate condition has lower aggregate measured provider-token total, but paired evidence is inconsistent (${pairedProviderPhrase(pairedProviderTokens)}).`,
      }
    }
    return {
      outcome: "improved",
      reason: `Candidate condition has lower measured provider-token total in this scenario (${pairedProviderPhrase(pairedProviderTokens)}).`,
    }
  }
  if (direction === "higher") {
    if (pairedProviderTokens.interpretation === "aggregate-higher-but-paired-inconsistent") {
      return {
        outcome: "worse",
        reason: `Candidate condition has higher aggregate measured provider-token total, but paired evidence is inconsistent (${pairedProviderPhrase(pairedProviderTokens)}).`,
      }
    }
    return {
      outcome: "worse",
      reason: `Candidate condition has higher measured provider-token total in this scenario (${pairedProviderPhrase(pairedProviderTokens)}).`,
    }
  }
  if (direction === "same") {
    return { outcome: "no-improvement", reason: "Candidate condition has the same measured provider-token total." }
  }
  return undefined
}

function secondaryOutcome(directions: readonly MetricDirection[]): {
  readonly outcome: PminusOutcome
  readonly reason: string
} {
  const available = directions.filter((direction) => direction !== "unavailable")
  if (available.length < 2) {
    return {
      outcome: "inconclusive",
      reason: "Provider-token telemetry is missing or partial, and non-provider metrics do not give a stable direction.",
    }
  }
  if (available.every((direction) => direction === "lower" || direction === "same") && available.includes("lower")) {
    return {
      outcome: "improved",
      reason: "Provider tokens are missing, but available elapsed/read/tool metrics are lower in this scenario.",
    }
  }
  if (available.every((direction) => direction === "higher" || direction === "same") && available.includes("higher")) {
    return {
      outcome: "worse",
      reason: "Provider tokens are missing, and available elapsed/read/tool metrics are worse or unchanged.",
    }
  }
  if (available.every((direction) => direction === "same")) {
    return { outcome: "no-improvement", reason: "Available non-provider metrics are unchanged." }
  }
  return {
    outcome: "inconclusive",
    reason: "Provider-token telemetry is missing or partial, and non-provider metrics do not give a stable direction.",
  }
}

function decisionHint(
  outcome: PminusOutcome,
  surface: AbScenario["surface"],
  pairedProviderTokens: PairedMetricComparison,
): PminusDecisionHint {
  if (outcome === "improved") {
    if (pairedProviderTokens.interpretation === "aggregate-lower-but-paired-inconsistent") {
      return "keep-gathering"
    }
    return "keep"
  }
  if (outcome === "no-improvement") {
    return "keep-opt-in"
  }
  if (outcome === "worse") {
    return surface.defaultState === "default" ? "downgrade" : "remove-candidate"
  }
  return "no-claim"
}

function classifyScenario(scenario: AbScenario): EvidencePminusScenarioReport {
  const { baseline, candidate } = comparableConditions(scenario)
  if (baseline === undefined || candidate === undefined) {
    return {
      baselineCondition: baseline?.id ?? null,
      candidateCondition: candidate?.id ?? null,
      evidenceFiles: scenario.files,
      id: scenario.id,
      killCriterion: KILL_CRITERION,
      label: scenario.label,
      outcome: "inconclusive",
      pairedConsistency: {
        metrics: {
          elapsedMs: {
            aggregateDirection: "unavailable",
            candidateHigher: 0,
            candidateLower: 0,
            interpretation: "unavailable",
            signTestPValue: null,
            tied: 0,
            totalComparable: 0,
          },
          mcpCalls: {
            aggregateDirection: "unavailable",
            candidateHigher: 0,
            candidateLower: 0,
            interpretation: "unavailable",
            signTestPValue: null,
            tied: 0,
            totalComparable: 0,
          },
          providerTokenTotal: {
            aggregateDirection: "unavailable",
            candidateHigher: 0,
            candidateLower: 0,
            interpretation: "unavailable",
            signTestPValue: null,
            tied: 0,
            totalComparable: 0,
          },
          readChars: {
            aggregateDirection: "unavailable",
            candidateHigher: 0,
            candidateLower: 0,
            interpretation: "unavailable",
            signTestPValue: null,
            tied: 0,
            totalComparable: 0,
          },
          toolCalls: {
            aggregateDirection: "unavailable",
            candidateHigher: 0,
            candidateLower: 0,
            interpretation: "unavailable",
            signTestPValue: null,
            tied: 0,
            totalComparable: 0,
          },
        },
        primaryMetric: "providerTokenTotal",
      },
      reason: "Need at least two matched conditions before comparing a surface.",
      surface: scenario.surface,
      surfaceDecisionHint: "no-claim",
      telemetry: {
        providerTokens: "missing",
        secondaryMetrics: {
          elapsedMs: "unavailable",
          mcpCalls: "unavailable",
          readChars: "unavailable",
          toolCalls: "unavailable",
        },
      },
    }
  }

  const pairedConsistency = pairedConsistencyReport(baseline, candidate)
  const secondaryMetrics = {
    elapsedMs: metricDirection(baseline.metrics.elapsedMs, candidate.metrics.elapsedMs),
    mcpCalls: metricDirection(baseline.metrics.mcpCalls, candidate.metrics.mcpCalls),
    readChars: metricDirection(baseline.metrics.readChars, candidate.metrics.readChars),
    toolCalls: metricDirection(baseline.metrics.toolCalls, candidate.metrics.toolCalls),
  }
  const providerTokens = telemetryAvailability(baseline.metrics.providerTokenTotal, candidate.metrics.providerTokenTotal)
  const providerOutcome =
    providerTokens === "available"
      ? outcomeFromProviderTokens(
          baseline.metrics.providerTokenTotal,
          candidate.metrics.providerTokenTotal,
          pairedConsistency.metrics.providerTokenTotal,
        )
      : undefined
  const classification =
    candidate.blockedInvalidCompletion > baseline.blockedInvalidCompletion
      ? { outcome: "improved" as const, reason: "ON condition blocked invalid completion while OFF did not." }
      : candidate.finish.pass < baseline.finish.pass
        ? { outcome: "worse" as const, reason: "Candidate condition has fewer passing finish outcomes." }
        : providerOutcome ?? secondaryOutcome(Object.values(secondaryMetrics))

  return {
    baselineCondition: baseline.id,
    candidateCondition: candidate.id,
    evidenceFiles: scenario.files,
    id: scenario.id,
    killCriterion: KILL_CRITERION,
    label: scenario.label,
    outcome: classification.outcome,
    pairedConsistency,
    reason: classification.reason,
    surface: scenario.surface,
    surfaceDecisionHint: decisionHint(classification.outcome, scenario.surface, pairedConsistency.metrics.providerTokenTotal),
    telemetry: {
      providerTokens,
      secondaryMetrics,
    },
  }
}

export function readEvidencePminusReport(options: EvidencePminusOptions = {}): EvidencePminusReport {
  const abReport = readEvidenceAbReport(options)
  return {
    evidenceDir: abReport.evidenceDir,
    filesScanned: abReport.filesScanned,
    limitations: [
      "P-minus reports are read-only decision support; this command writes no files and does not delete, downgrade, or mutate configuration.",
      "Outcomes are local evidence classifications, not token-saving, product-efficacy, navigation-benefit, or quality claims.",
      "Aggregate mean deltas and paired consistency can diverge; paired inconsistency lowers decision hints to keep-gathering/no-claim style review.",
      "Missing provider-token telemetry is reported as missing; non-provider metrics are secondary evidence only.",
    ],
    projectDir: abReport.projectDir,
    scenarios: abReport.scenarios.map(classifyScenario),
    schemaVersion: "evidence-pminus-report.1",
    unreadableFiles: abReport.unreadableFiles,
  }
}
