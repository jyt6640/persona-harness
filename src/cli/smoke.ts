import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { readDoctorSummary } from "./doctor.js"
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"

type SmokeOptions = {
  readonly projectDir?: string
}

const SMOKE_REPORT_PATH = ".persona/workflow/smoke-report.md"

function smokeUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} smoke`,
    "",
    "Write a report-only local smoke summary to .persona/workflow/smoke-report.md.",
    "",
    "Before running:",
    "- npx ph doctor",
    "- npx ph workflow check",
    "",
    "Scope:",
    "- report-only smoke summary",
    "- not generated app product-quality certification",
  ].join("\n")
}

function createSmokeReport(projectDir: string): string {
  const status = readWorkflowStatus(projectDir)
  const doctor = readDoctorSummary({ projectDir })
  const staleStatus = doctor.staleFixtureFindings.length === 0 ? "PASS" : `WARN (${doctor.staleFixtureFindings.length} findings)`
  const staleDetails =
    doctor.staleFixtureFindings.length === 0
      ? ["- none"]
      : doctor.staleFixtureFindings.map((finding) => `- ${finding.relativePath}: ${finding.matches.join(", ")}`)
  return [
    "# Persona Harness Smoke Report",
    "",
    `Project: \`${projectDir}\``,
    `Workflow status: ${status.finding}`,
    "",
    "## Local Integration",
    "",
    `- Node: ${doctor.node}`,
    `- npm: ${doctor.npm}`,
    `- OpenCode: ${doctor.opencode}`,
    `- Persona package version: ${doctor.packageVersion}`,
    `- npm registry: ${doctor.registry}`,
    `- .opencode/opencode.json: ${doctor.opencodeConfig}`,
    `- Persona plugin path: ${doctor.pluginPath}`,
    `- .persona/harness.jsonc: ${doctor.harnessConfig}`,
    `- .persona/rules: ${doctor.rules}`,
    `- Rules surface: ${doctor.rulesFileCount} files`,
    `- Stale fixture scan: ${staleStatus}`,
    "",
    "### Stale Fixture Details",
    "",
    ...staleDetails,
    "",
    "## Checks",
    "",
    `- plan: ${status.plan}`,
    `- implementation report: ${status.implementation}`,
    `- review report: ${status.review}`,
    `- evidence: ${status.evidence}`,
    "",
    "## Workflow Detail",
    "",
    "```text",
    formatWorkflowStatus(status),
    "```",
    "",
    "## Limitations",
    "",
    "- This is a report-only smoke summary.",
    "- It does not certify generated app product quality.",
    "",
  ].join("\n")
}

export function runSmokeCommand(args: readonly string[], options: SmokeOptions = {}, invocationName = "ph"): CliRunResult {
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { status: 0, stdout: `${smokeUsage(invocationName)}\n`, stderr: "" }
  }
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const reportPath = join(projectDir, SMOKE_REPORT_PATH)
  mkdirSync(dirname(reportPath), { recursive: true })
  writeFileSync(reportPath, createSmokeReport(projectDir))
  return { status: 0, stdout: `Smoke report written: ${reportPath}\n`, stderr: "" }
}
