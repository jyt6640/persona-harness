import type { EvidencePminusReport } from "./evidence-pminus-report.js"
import type { PairedMetricComparison } from "./evidence-pminus-paired.js"

const KILL_CRITERION =
  "Kill criteria are decision support only: repeated matched scenarios with worse or no-improvement should trigger keep-opt-in, downgrade, or remove review; this command does not delete, downgrade, or mutate configuration."

function pairedLine(label: string, comparison: PairedMetricComparison): string {
  const signTest = comparison.signTestPValue === null ? "n/a" : comparison.signTestPValue.toFixed(5)
  return [
    `${label}: aggregate ${comparison.aggregateDirection}`,
    `candidate lower ${comparison.candidateLower}`,
    `higher ${comparison.candidateHigher}`,
    `tied ${comparison.tied}`,
    `total comparable ${comparison.totalComparable}`,
    `sign-test p ${signTest}`,
    `interpretation ${comparison.interpretation}`,
  ].join(", ")
}

function closureLine(scenario: EvidencePminusReport["scenarios"][number]): string {
  const finishPassDelta = scenario.closureIntegrity.finishPassDelta ?? "unavailable"
  return [
    `interpretation ${scenario.closureIntegrity.interpretation}`,
    `candidate reduced ${scenario.closureIntegrity.candidateReducedBlockers}`,
    `baseline reduced ${scenario.closureIntegrity.baselineReducedBlockers}`,
    `paired better ${scenario.closureIntegrity.pairedBetter}`,
    `worse ${scenario.closureIntegrity.pairedWorse}`,
    `tied ${scenario.closureIntegrity.tied}`,
    `total comparable ${scenario.closureIntegrity.totalComparable}`,
    `finish-pass delta ${finishPassDelta}`,
  ].join(", ")
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
    lines.push(`- closure integrity: ${closureLine(scenario)}`)
    lines.push(`- paired primary metric: ${scenario.pairedConsistency.primaryMetric}`)
    lines.push(`- paired provider tokens: ${pairedLine("providerTokenTotal", scenario.pairedConsistency.metrics.providerTokenTotal)}`)
    lines.push(`- paired elapsed ms: ${pairedLine("elapsedMs", scenario.pairedConsistency.metrics.elapsedMs)}`)
    lines.push(`- paired read chars: ${pairedLine("readChars", scenario.pairedConsistency.metrics.readChars)}`)
    lines.push(`- paired tool calls: ${pairedLine("toolCalls", scenario.pairedConsistency.metrics.toolCalls)}`)
    lines.push(`- paired MCP calls: ${pairedLine("mcpCalls", scenario.pairedConsistency.metrics.mcpCalls)}`)
    lines.push(`- reason: ${scenario.reason}`)
    lines.push(`- ${scenario.killCriterion}`)
    lines.push("")
  }
  lines.push("## Limitations", "")
  lines.push(...report.limitations.map((limitation) => `- ${limitation}`))
  lines.push("")
  return lines.join("\n")
}
