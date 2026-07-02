import type { EvidenceAbReport } from "./evidence-ab-report.js"
import { readEvidenceAbReport } from "./evidence-ab-report.js"

type EvidencePminusOptions = {
  readonly projectDir?: string
}

type AbScenario = EvidenceAbReport["scenarios"][number]
type AbCondition = AbScenario["conditions"][number]
type NumberMetric = AbCondition["metrics"]["elapsedMs"]

type MetricDirection = "higher" | "lower" | "same" | "unavailable"
type PminusDecisionHint = "downgrade" | "keep" | "keep-opt-in" | "no-claim" | "remove-candidate"
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

const KILL_CRITERION =
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

function outcomeFromProviderTokens(left: NumberMetric, right: NumberMetric): {
  readonly outcome: PminusOutcome
  readonly reason: string
} | undefined {
  const direction = metricDirection(left, right)
  if (direction === "lower") {
    return { outcome: "improved", reason: "Candidate condition has lower measured provider-token total in this scenario." }
  }
  if (direction === "higher") {
    return { outcome: "worse", reason: "Candidate condition has higher measured provider-token total in this scenario." }
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

function decisionHint(outcome: PminusOutcome, surface: AbScenario["surface"]): PminusDecisionHint {
  if (outcome === "improved") {
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

  const secondaryMetrics = {
    elapsedMs: metricDirection(baseline.metrics.elapsedMs, candidate.metrics.elapsedMs),
    mcpCalls: metricDirection(baseline.metrics.mcpCalls, candidate.metrics.mcpCalls),
    readChars: metricDirection(baseline.metrics.readChars, candidate.metrics.readChars),
    toolCalls: metricDirection(baseline.metrics.toolCalls, candidate.metrics.toolCalls),
  }
  const providerTokens = telemetryAvailability(baseline.metrics.providerTokenTotal, candidate.metrics.providerTokenTotal)
  const providerOutcome =
    providerTokens === "available"
      ? outcomeFromProviderTokens(baseline.metrics.providerTokenTotal, candidate.metrics.providerTokenTotal)
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
    reason: classification.reason,
    surface: scenario.surface,
    surfaceDecisionHint: decisionHint(classification.outcome, scenario.surface),
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
      "Missing provider-token telemetry is reported as missing; non-provider metrics are secondary evidence only.",
    ],
    projectDir: abReport.projectDir,
    scenarios: abReport.scenarios.map(classifyScenario),
    schemaVersion: "evidence-pminus-report.1",
    unreadableFiles: abReport.unreadableFiles,
  }
}

export function formatEvidencePminusReport(report: EvidencePminusReport): string {
  const lines = [
    "# Persona P-minus Evidence Report",
    "",
    `Project: \`${report.projectDir}\``,
    `Evidence directory: \`${report.evidenceDir}\``,
    `Evidence files scanned: ${report.filesScanned}`,
    `Unreadable evidence files: ${report.unreadableFiles.length}`,
    "",
    "## Surface Decisions",
    "",
  ]
  if (report.scenarios.length === 0) {
    lines.push("- none")
    lines.push("", `- ${KILL_CRITERION}`)
  }
  for (const scenario of report.scenarios) {
    lines.push(`### ${scenario.label}`, "")
    lines.push(`- id: ${scenario.id}`)
    lines.push(
      `- surface: ${scenario.surface.label} (${scenario.surface.id}, default-state ${scenario.surface.defaultState})`,
    )
    lines.push(`- compared: ${scenario.baselineCondition ?? "unknown"} -> ${scenario.candidateCondition ?? "unknown"}`)
    lines.push(`- outcome: ${scenario.outcome}`)
    lines.push(`- decision hint: ${scenario.surfaceDecisionHint}`)
    lines.push(`- provider-token telemetry: ${scenario.telemetry.providerTokens}`)
    lines.push(`- reason: ${scenario.reason}`)
    lines.push(`- ${scenario.killCriterion}`)
    lines.push("")
  }
  lines.push("## Limitations", "")
  lines.push(...report.limitations.map((limitation) => `- ${limitation}`))
  lines.push("")
  return lines.join("\n")
}
