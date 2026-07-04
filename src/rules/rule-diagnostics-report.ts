import { mkdirSync } from "node:fs"
import { dirname, join } from "node:path"

import { loadHarnessConfig, resolveConfiguredPath } from "../config/harness-config.js"
import { writeFileAtomic } from "../io/atomic-file.js"
import { loadRuleCatalog } from "./rule-catalog.js"
import type { RuleFrontmatterDiagnostic } from "./rule-frontmatter-diagnostics.js"

export type RuleDiagnosticsFinding = "PASS" | "WARN"

export type RuleDiagnosticReportItem = {
  readonly path: string
  readonly diagnostic: RuleFrontmatterDiagnostic
}

export type RuleDiagnosticsSummary = {
  readonly projectDir: string
  readonly finding: RuleDiagnosticsFinding
  readonly ruleCount: number
  readonly diagnosticCount: number
  readonly diagnostics: readonly RuleDiagnosticReportItem[]
}

export function defaultRuleDiagnosticsReportPath(projectDir: string): string {
  const config = loadHarnessConfig(projectDir)
  return join(resolveConfiguredPath(projectDir, config.evidenceDir), "phase-next", "rule-diagnostics-report.md")
}

export function summarizeRuleDiagnostics(projectDir: string): RuleDiagnosticsSummary {
  const catalog = loadRuleCatalog(projectDir)
  const diagnostics = catalog.flatMap((entry) =>
    entry.diagnostics.map((diagnostic) => ({
      path: entry.path,
      diagnostic,
    })),
  )

  return {
    projectDir,
    finding: diagnostics.length === 0 ? "PASS" : "WARN",
    ruleCount: catalog.length,
    diagnosticCount: diagnostics.length,
    diagnostics,
  }
}

function diagnosticField(diagnostic: RuleFrontmatterDiagnostic): string {
  return diagnostic.field ?? "-"
}

export function renderRuleDiagnosticsReport(summary: RuleDiagnosticsSummary): string {
  const lines = [
    "# PersonaHarnessRule Diagnostics Report",
    "",
    `Project: ${summary.projectDir}`,
    `Finding: ${summary.finding}`,
    `Rules: ${summary.ruleCount}`,
    `Diagnostics: ${summary.diagnosticCount}`,
    "",
    "## Diagnostics",
    "",
  ]

  if (summary.diagnostics.length === 0) {
    return `${lines.concat("No rule frontmatter diagnostics found.", "").join("\n")}`
  }

  return `${lines
    .concat(
      "| Rule | Code | Field | Message |",
      "| --- | --- | --- | --- |",
      ...summary.diagnostics.map(
        (item) =>
          `| ${item.path} | ${item.diagnostic.code} | ${diagnosticField(item.diagnostic)} | ${item.diagnostic.message} |`,
      ),
      "",
      "## Decision",
      "",
      "Diagnostics are report-only. They do not block rule loading, rule selection, tests, typecheck, build, or injection.",
      "",
    )
    .join("\n")}`
}

export function writeRuleDiagnosticsReport(projectDir: string, outputPath: string): RuleDiagnosticsSummary {
  const summary = summarizeRuleDiagnostics(projectDir)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileAtomic(outputPath, `${renderRuleDiagnosticsReport(summary)}\n`)
  return summary
}
