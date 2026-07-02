import type { EvidencePminusReport, EvidencePminusScenarioReport } from "./evidence-pminus-report.js"
import { readEvidencePminusReport } from "./evidence-pminus-report.js"

type EvidencePminusStatusOptions = {
  readonly projectDir?: string
}

type OutcomeCount = {
  readonly improved: number
  readonly inconclusive: number
  readonly "no-improvement": number
  readonly worse: number
}

type DecisionHintCount = {
  readonly downgrade: number
  readonly keep: number
  readonly "keep-opt-in": number
  readonly "no-claim": number
  readonly "remove-candidate": number
}

type ProviderTelemetryCoverage = {
  readonly available: number
  readonly missing: number
  readonly partial: number
  readonly state: "available" | "missing" | "partial"
}

type MutableDecisionHintCount = {
  -readonly [Key in keyof DecisionHintCount]: DecisionHintCount[Key]
}
type MutableOutcomeCount = {
  -readonly [Key in keyof OutcomeCount]: OutcomeCount[Key]
}

type SurfaceDefaultStatus = "default" | "mixed" | "off" | "opt-in" | "unknown"
type RecommendedNextAction =
  | "downgrade candidate"
  | "keep gathering"
  | "keep opt-in"
  | "needs larger A/B"
  | "no-claim"
  | "remove-candidate"

export type EvidencePminusSurfaceStatus = {
  readonly defaultState: SurfaceDefaultStatus
  readonly evidenceFiles: readonly string[]
  readonly id: string
  readonly label: string
  readonly latestDecisionHints: readonly EvidencePminusScenarioReport["surfaceDecisionHint"][]
  readonly latestEvidenceFile: string | null
  readonly outcomeCounts: OutcomeCount
  readonly providerTelemetry: ProviderTelemetryCoverage
  readonly recommendedNextAction: RecommendedNextAction
  readonly scenarioCount: number
  readonly scenarioIds: readonly string[]
  readonly surfaceDecisionHints: DecisionHintCount
}

export type EvidencePminusStatusReport = {
  readonly evidenceDir: string
  readonly filesScanned: number
  readonly limitations: readonly string[]
  readonly projectDir: string
  readonly schemaVersion: "evidence-pminus-status.1"
  readonly surfaces: readonly EvidencePminusSurfaceStatus[]
  readonly unreadableFiles: readonly string[]
}

function emptyOutcomeCount(): MutableOutcomeCount {
  return {
    improved: 0,
    inconclusive: 0,
    "no-improvement": 0,
    worse: 0,
  }
}

function emptyDecisionHintCount(): MutableDecisionHintCount {
  return {
    downgrade: 0,
    keep: 0,
    "keep-opt-in": 0,
    "no-claim": 0,
    "remove-candidate": 0,
  }
}

function providerTelemetryState(coverage: Omit<ProviderTelemetryCoverage, "state">): ProviderTelemetryCoverage["state"] {
  if (coverage.available > 0 && coverage.missing === 0 && coverage.partial === 0) {
    return "available"
  }
  if (coverage.available === 0 && coverage.partial === 0) {
    return "missing"
  }
  return "partial"
}

function surfaceDefaultState(states: readonly EvidencePminusScenarioReport["surface"]["defaultState"][]): SurfaceDefaultStatus {
  const uniqueStates = Array.from(new Set(states))
  return uniqueStates.length === 1 ? (uniqueStates[0] ?? "unknown") : "mixed"
}

function latestEvidenceFile(scenarios: readonly EvidencePminusScenarioReport[]): string | null {
  const files = scenarios.flatMap((scenario) => [...scenario.evidenceFiles])
  return files.length === 0 ? null : files.sort((left, right) => right.localeCompare(left))[0] ?? null
}

function latestDecisionHints(
  scenarios: readonly EvidencePminusScenarioReport[],
  latestFile: string | null,
): readonly EvidencePminusScenarioReport["surfaceDecisionHint"][] {
  if (latestFile === null) {
    return []
  }
  return Array.from(
    new Set(
      scenarios
        .filter((scenario) => scenario.evidenceFiles.includes(latestFile))
        .map((scenario) => scenario.surfaceDecisionHint),
    ),
  ).sort()
}

function recommendedNextAction(
  outcomes: OutcomeCount,
  defaultState: SurfaceDefaultStatus,
  providerTelemetry: ProviderTelemetryCoverage,
): RecommendedNextAction {
  if (outcomes.worse > 0) {
    return defaultState === "default" || defaultState === "mixed" ? "downgrade candidate" : "remove-candidate"
  }
  if (outcomes["no-improvement"] > 0) {
    return "keep opt-in"
  }
  if (outcomes.inconclusive > 0) {
    return providerTelemetry.state === "missing" ? "no-claim" : "needs larger A/B"
  }
  if (outcomes.improved > 0) {
    return "keep gathering"
  }
  return "no-claim"
}

function surfaceStatus(
  surfaceId: string,
  scenarios: readonly EvidencePminusScenarioReport[],
): EvidencePminusSurfaceStatus {
  const outcomeCounts = emptyOutcomeCount()
  const surfaceDecisionHints = emptyDecisionHintCount()
  const providerTelemetry = { available: 0, missing: 0, partial: 0 }
  for (const scenario of scenarios) {
    outcomeCounts[scenario.outcome] += 1
    surfaceDecisionHints[scenario.surfaceDecisionHint] += 1
    providerTelemetry[scenario.telemetry.providerTokens] += 1
  }
  const defaultState = surfaceDefaultState(scenarios.map((scenario) => scenario.surface.defaultState))
  const latestFile = latestEvidenceFile(scenarios)
  const providerTelemetrySummary = {
    ...providerTelemetry,
    state: providerTelemetryState(providerTelemetry),
  }
  return {
    defaultState,
    evidenceFiles: Array.from(new Set(scenarios.flatMap((scenario) => scenario.evidenceFiles))).sort(),
    id: surfaceId,
    label: scenarios[0]?.surface.label ?? surfaceId,
    latestDecisionHints: latestDecisionHints(scenarios, latestFile),
    latestEvidenceFile: latestFile,
    outcomeCounts,
    providerTelemetry: providerTelemetrySummary,
    recommendedNextAction: recommendedNextAction(outcomeCounts, defaultState, providerTelemetrySummary),
    scenarioCount: scenarios.length,
    scenarioIds: scenarios.map((scenario) => scenario.id).sort(),
    surfaceDecisionHints,
  }
}

function groupBySurface(report: EvidencePminusReport): readonly EvidencePminusSurfaceStatus[] {
  const surfaces = new Map<string, EvidencePminusScenarioReport[]>()
  for (const scenario of report.scenarios) {
    const scenarios = surfaces.get(scenario.surface.id) ?? []
    scenarios.push(scenario)
    surfaces.set(scenario.surface.id, scenarios)
  }
  return Array.from(surfaces.entries())
    .map(([surfaceId, scenarios]) => surfaceStatus(surfaceId, scenarios))
    .sort((left, right) => left.id.localeCompare(right.id))
}

export function readEvidencePminusStatus(options: EvidencePminusStatusOptions = {}): EvidencePminusStatusReport {
  const report = readEvidencePminusReport(options)
  return {
    evidenceDir: report.evidenceDir,
    filesScanned: report.filesScanned,
    limitations: [
      "P-minus status is read-only decision support; it writes no files and does not mutate configuration.",
      "Recommended next actions are review hints only, not automatic downgrade, removal, or product-efficacy claims.",
      "Provider-token telemetry coverage reports availability only; missing telemetry remains unavailable.",
    ],
    projectDir: report.projectDir,
    schemaVersion: "evidence-pminus-status.1",
    surfaces: groupBySurface(report),
    unreadableFiles: report.unreadableFiles,
  }
}

function outcomeLine(outcomes: OutcomeCount): string {
  return `improved ${outcomes.improved}, no-improvement ${outcomes["no-improvement"]}, worse ${outcomes.worse}, inconclusive ${outcomes.inconclusive}`
}

function providerLine(coverage: ProviderTelemetryCoverage): string {
  return `${coverage.state} (available ${coverage.available}, partial ${coverage.partial}, missing ${coverage.missing})`
}

export function formatEvidencePminusStatus(report: EvidencePminusStatusReport): string {
  const lines = [
    "# Persona P-minus Surface Status",
    "",
    `Project: \`${report.projectDir}\``,
    `Evidence directory: \`${report.evidenceDir}\``,
    `Evidence files scanned: ${report.filesScanned}`,
    `Unreadable evidence files: ${report.unreadableFiles.length}`,
    "",
    "## Surfaces",
    "",
  ]
  if (report.surfaces.length === 0) {
    lines.push("- none")
  }
  for (const surface of report.surfaces) {
    lines.push(`### ${surface.label}`, "")
    lines.push(`- id: ${surface.id}`)
    lines.push(`- default state: ${surface.defaultState}`)
    lines.push(`- scenarios: ${surface.scenarioCount} (${surface.scenarioIds.join(", ")})`)
    lines.push(`- outcomes: ${outcomeLine(surface.outcomeCounts)}`)
    lines.push(`- provider-token telemetry: ${providerLine(surface.providerTelemetry)}`)
    lines.push(`- latest decision hints: ${surface.latestDecisionHints.join(", ") || "none"}`)
    lines.push(`- recommended next action: ${surface.recommendedNextAction}`)
    lines.push(`- latest evidence file: ${surface.latestEvidenceFile ?? "none"}`)
    lines.push("")
  }
  lines.push("## Limitations", "")
  lines.push(...report.limitations.map((limitation) => `- ${limitation}`))
  lines.push("")
  return lines.join("\n")
}
