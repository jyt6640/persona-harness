import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { basename, join, resolve } from "node:path"
import process from "node:process"

import { isRecord } from "../config/jsonc.js"

type EvidenceAbOptions = {
  readonly projectDir?: string
}

type TokenAggregate = {
  readonly cacheRead: number | null
  readonly cacheWrite: number | null
  readonly input: number | null
  readonly output: number | null
  readonly reasoning: number | null
  readonly total: number | null
}

type AbRunReport = {
  readonly blockedInvalidCompletion: boolean | null
  readonly elapsedMs: number | null
  readonly finishStatus: "blocked" | "fail" | "pass" | "unknown"
  readonly id: string
  readonly mcpCalls: number | null
  readonly outcome: string
  readonly providerTokens: TokenAggregate
  readonly readChars: number | null
  readonly toolCalls: number | null
}

type AbConditionReport = {
  readonly blockedInvalidCompletion: number
  readonly finish: {
    readonly blocked: number
    readonly fail: number
    readonly pass: number
    readonly unknown: number
  }
  readonly id: string
  readonly label: string
  readonly metrics: {
    readonly elapsedMs: NumberMetric
    readonly mcpCalls: NumberMetric
    readonly providerTokenTotal: NumberMetric
    readonly readChars: NumberMetric
    readonly toolCalls: NumberMetric
  }
  readonly runs: readonly AbRunReport[]
}

type NumberMetric = {
  readonly average: number | null
  readonly samples: number
  readonly total: number | null
  readonly unavailable: number
}

type SurfaceDefaultState = "default" | "off" | "opt-in" | "unknown"

type AbSurfaceReport = {
  readonly defaultState: SurfaceDefaultState
  readonly id: string
  readonly label: string
}

type AbScenarioReport = {
  readonly conditions: readonly AbConditionReport[]
  readonly files: readonly string[]
  readonly id: string
  readonly label: string
  readonly sources: readonly string[]
  readonly surface: AbSurfaceReport
}

export type EvidenceAbReport = {
  readonly evidenceDir: string
  readonly filesScanned: number
  readonly limitations: readonly string[]
  readonly projectDir: string
  readonly scenarios: readonly AbScenarioReport[]
  readonly schemaVersion: "evidence-ab-report.1"
  readonly unreadableFiles: readonly string[]
}

const EVIDENCE_DIR = ".persona/evidence"
const AB_SCHEMA_VERSION = "persona-ab-measurement.1"
const EMPTY_TOKENS: TokenAggregate = {
  cacheRead: null,
  cacheWrite: null,
  input: null,
  output: null,
  reasoning: null,
  total: null,
}

function listEvidenceFiles(dirPath: string): readonly string[] {
  if (!existsSync(dirPath)) {
    return []
  }
  const files: string[] = []
  for (const entry of readdirSync(dirPath)) {
    const entryPath = join(dirPath, entry)
    const stat = statSync(entryPath)
    if (stat.isDirectory()) {
      files.push(...listEvidenceFiles(entryPath))
    } else if (stat.isFile() && (entryPath.endsWith(".json") || entryPath.endsWith(".jsonl"))) {
      files.push(entryPath)
    }
  }
  return files.sort()
}

function objectsFromEvidenceFile(filePath: string): readonly unknown[] {
  const source = readFileSync(filePath, "utf8")
  if (filePath.endsWith(".jsonl")) {
    return source
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as unknown)
  }
  const parsed: unknown = JSON.parse(source)
  return Array.isArray(parsed) ? parsed : [parsed]
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function finishStatus(value: unknown): "blocked" | "fail" | "pass" | "unknown" {
  if (value === "blocked" || value === "fail" || value === "pass") {
    return value
  }
  if (value === "failed") {
    return "fail"
  }
  if (value === "passed") {
    return "pass"
  }
  return "unknown"
}

function surfaceDefaultState(value: unknown): SurfaceDefaultState {
  return value === "default" || value === "off" || value === "opt-in" ? value : "unknown"
}

function tokenAggregate(value: unknown): TokenAggregate {
  if (!isRecord(value)) {
    return {
      ...EMPTY_TOKENS,
      total: numberValue(value),
    }
  }
  return {
    cacheRead: numberValue(value.cacheRead),
    cacheWrite: numberValue(value.cacheWrite),
    input: numberValue(value.input),
    output: numberValue(value.output),
    reasoning: numberValue(value.reasoning),
    total: numberValue(value.total),
  }
}

function runReport(value: unknown, index: number): AbRunReport | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const providerTokens = tokenAggregate(value.providerTokens ?? value.providerTokenTotal)
  return {
    blockedInvalidCompletion:
      typeof value.blockedInvalidCompletion === "boolean" ? value.blockedInvalidCompletion : null,
    elapsedMs: numberValue(value.elapsedMs),
    finishStatus: finishStatus(value.finishStatus),
    id: stringValue(value.id) ?? `run-${index + 1}`,
    mcpCalls: numberValue(value.mcpCalls),
    outcome: stringValue(value.outcome) ?? "unknown",
    providerTokens,
    readChars: numberValue(value.readChars),
    toolCalls: numberValue(value.toolCalls),
  }
}

function numberMetric(values: readonly (number | null)[]): NumberMetric {
  const samples = values.filter((value): value is number => value !== null)
  const total = samples.length === 0 ? null : samples.reduce((sum, value) => sum + value, 0)
  return {
    average: total === null ? null : Math.round((total / samples.length) * 100) / 100,
    samples: samples.length,
    total,
    unavailable: values.length - samples.length,
  }
}

function conditionReport(value: unknown, index: number): AbConditionReport | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const runs = Array.isArray(value.runs)
    ? value.runs.flatMap((run, runIndex) => {
        const parsed = runReport(run, runIndex)
        return parsed === undefined ? [] : [parsed]
      })
    : []
  const finish = {
    blocked: runs.filter((run) => run.finishStatus === "blocked").length,
    fail: runs.filter((run) => run.finishStatus === "fail").length,
    pass: runs.filter((run) => run.finishStatus === "pass").length,
    unknown: runs.filter((run) => run.finishStatus === "unknown").length,
  }
  return {
    blockedInvalidCompletion: runs.filter((run) => run.blockedInvalidCompletion === true).length,
    finish,
    id: stringValue(value.id) ?? `condition-${index + 1}`,
    label: stringValue(value.label) ?? stringValue(value.id) ?? `Condition ${index + 1}`,
    metrics: {
      elapsedMs: numberMetric(runs.map((run) => run.elapsedMs)),
      mcpCalls: numberMetric(runs.map((run) => run.mcpCalls)),
      providerTokenTotal: numberMetric(runs.map((run) => run.providerTokens.total)),
      readChars: numberMetric(runs.map((run) => run.readChars)),
      toolCalls: numberMetric(runs.map((run) => run.toolCalls)),
    },
    runs,
  }
}

function scenarioReport(value: unknown, filePath: string): AbScenarioReport | undefined {
  if (!isRecord(value) || value.schemaVersion !== AB_SCHEMA_VERSION) {
    return undefined
  }
  const conditions = Array.isArray(value.conditions)
    ? value.conditions.flatMap((condition, index) => {
        const parsed = conditionReport(condition, index)
        return parsed === undefined ? [] : [parsed]
      })
    : []
  const id = stringValue(value.scenarioId) ?? basename(filePath).replace(/\.(json|jsonl)$/u, "")
  const surface = isRecord(value.surface) ? value.surface : undefined
  const surfaceId = stringValue(surface?.id) ?? stringValue(value.surfaceId) ?? id
  return {
    conditions,
    files: [filePath],
    id,
    label: stringValue(value.scenarioLabel) ?? id,
    sources: [stringValue(value.source) ?? "unknown"],
    surface: {
      defaultState: surfaceDefaultState(surface?.defaultState ?? value.surfaceDefaultState),
      id: surfaceId,
      label: stringValue(surface?.label) ?? stringValue(value.surfaceLabel) ?? surfaceId,
    },
  }
}

function mergeScenario(left: AbScenarioReport, right: AbScenarioReport): AbScenarioReport {
  const conditionMap = new Map<string, AbConditionReport>()
  for (const condition of [...left.conditions, ...right.conditions]) {
    const current = conditionMap.get(condition.id)
    if (current === undefined) {
      conditionMap.set(condition.id, condition)
      continue
    }
    conditionMap.set(
      condition.id,
      conditionReport(
        {
          id: current.id,
          label: current.label,
          runs: [...current.runs, ...condition.runs],
        },
        conditionMap.size,
      ) ?? current,
    )
  }
  return {
    conditions: Array.from(conditionMap.values()).sort((leftCondition, rightCondition) =>
      leftCondition.id.localeCompare(rightCondition.id),
    ),
    files: [...left.files, ...right.files].sort(),
    id: left.id,
    label: left.label,
    sources: Array.from(new Set([...left.sources, ...right.sources])).sort(),
    surface: left.surface,
  }
}

export function readEvidenceAbReport(options: EvidenceAbOptions = {}): EvidenceAbReport {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const evidenceDir = join(projectDir, EVIDENCE_DIR)
  const unreadableFiles: string[] = []
  const scenarios = new Map<string, AbScenarioReport>()
  let filesScanned = 0

  for (const filePath of listEvidenceFiles(evidenceDir)) {
    filesScanned += 1
    try {
      for (const parsed of objectsFromEvidenceFile(filePath)) {
        const scenario = scenarioReport(parsed, filePath)
        if (scenario === undefined) {
          continue
        }
        const current = scenarios.get(scenario.id)
        scenarios.set(scenario.id, current === undefined ? scenario : mergeScenario(current, scenario))
      }
    } catch {
      unreadableFiles.push(filePath)
    }
  }

  return {
    evidenceDir,
    filesScanned,
    limitations: [
      "A/B reports aggregate local structured evidence only; missing telemetry remains unavailable.",
      "Provider-token, read-char, tool-call, and outcome deltas are not token-saving or product-efficacy claims.",
      "Use repeated matched scenarios before interpreting a condition as better or worse.",
    ],
    projectDir,
    scenarios: Array.from(scenarios.values()).sort((left, right) => left.id.localeCompare(right.id)),
    schemaVersion: "evidence-ab-report.1",
    unreadableFiles,
  }
}

function metricLine(label: string, metric: NumberMetric): string {
  if (metric.samples === 0) {
    return `  ${label}: unavailable (${metric.unavailable} missing)`
  }
  return `  ${label}: total ${metric.total}, avg ${metric.average} (${metric.samples} samples, ${metric.unavailable} missing)`
}

export function formatEvidenceAbReport(report: EvidenceAbReport): string {
  const lines = [
    "# Persona A/B Evidence Report",
    "",
    `Project: \`${report.projectDir}\``,
    `Evidence directory: \`${report.evidenceDir}\``,
    `Evidence files scanned: ${report.filesScanned}`,
    `Unreadable evidence files: ${report.unreadableFiles.length}`,
    "",
    "## Scenarios",
    "",
  ]
  if (report.scenarios.length === 0) {
    lines.push("- none")
  }
  for (const scenario of report.scenarios) {
    lines.push(`### ${scenario.label}`, "")
    lines.push(`- id: ${scenario.id}`)
    lines.push(`- sources: ${scenario.sources.join(", ")}`)
    lines.push(`- evidence files: ${scenario.files.length}`)
    for (const condition of scenario.conditions) {
      lines.push("", `#### ${condition.label}`, "")
      lines.push(`- id: ${condition.id}`)
      lines.push(`- runs: ${condition.runs.length}`)
      lines.push(
        `- finish: pass ${condition.finish.pass}, fail ${condition.finish.fail}, blocked ${condition.finish.blocked}, unknown ${condition.finish.unknown}`,
      )
      lines.push(`- blocked invalid completion: ${condition.blockedInvalidCompletion}`)
      lines.push(metricLine("elapsed ms", condition.metrics.elapsedMs))
      lines.push(metricLine("provider token total", condition.metrics.providerTokenTotal))
      lines.push(metricLine("read chars", condition.metrics.readChars))
      lines.push(metricLine("tool calls", condition.metrics.toolCalls))
      lines.push(metricLine("MCP calls", condition.metrics.mcpCalls))
    }
    lines.push("")
  }
  lines.push("## Limitations", "")
  lines.push(...report.limitations.map((limitation) => `- ${limitation}`))
  lines.push("")
  return lines.join("\n")
}
