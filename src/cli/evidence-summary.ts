import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { basename, dirname, join, resolve } from "node:path"
import process from "node:process"

import { isRecord } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"
import { formatEvidenceAbReport, readEvidenceAbReport } from "./evidence-ab-report.js"

type EvidenceOptions = {
  readonly projectDir?: string
}

type EvidenceRecord = {
  readonly targetFile: string
  readonly fileRole: string
  readonly selectedRules: readonly string[]
  readonly selectedSharedSkills: readonly string[]
}

type EvidenceSummary = {
  readonly records: readonly EvidenceRecord[]
  readonly unreadableFiles: readonly string[]
}

type TokenAggregate = {
  readonly cacheRead: number
  readonly cacheWrite: number
  readonly input: number
  readonly output: number
  readonly reasoning: number
  readonly total: number
}

type TokenSessionMetrics = {
  readonly aggregate: TokenAggregate
  readonly modelID: string | null
  readonly modelLimit: number | null
  readonly providerID: string | null
  readonly ratio: number | null
  readonly sessionID: string
}

type FinishMetricRecord = {
  readonly file: string
  readonly status: "fail" | "pass" | "unknown"
}

type EvidenceMetrics = {
  readonly evidenceDir: string
  readonly filesScanned: number
  readonly finish: {
    readonly fail: number
    readonly pass: number
    readonly records: readonly FinishMetricRecord[]
    readonly unknown: number
  }
  readonly limitations: readonly string[]
  readonly mcp: {
    readonly byFamily: Readonly<Record<string, number>>
    readonly byTool: Readonly<Record<string, number>>
    readonly total: number
  }
  readonly projectDir: string
  readonly readChars: {
    readonly total: number
    readonly unavailableReason: string | null
  }
  readonly schemaVersion: "evidence-metrics.1"
  readonly tokenUsage: {
    readonly aggregate: TokenAggregate
    readonly sessions: readonly TokenSessionMetrics[]
  }
  readonly toolCalls: {
    readonly byTool: Readonly<Record<string, number>>
    readonly total: number
  }
  readonly unreadableFiles: readonly string[]
}

const SUMMARY_PATH = ".persona/evidence/summary.md"
const EVIDENCE_DIR = ".persona/evidence"
const TOKEN_ZERO: TokenAggregate = {
  cacheRead: 0,
  cacheWrite: 0,
  input: 0,
  output: 0,
  reasoning: 0,
  total: 0,
}
const MCP_FAMILIES = ["codegraph", "context7", "grep_app", "lsp", "persona-harness-code-nav"] as const

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : []
}

function skillNames(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.flatMap((entry) => (isRecord(entry) && typeof entry.name === "string" ? [entry.name] : []))
}

function listJsonFiles(dirPath: string): readonly string[] {
  if (!existsSync(dirPath)) {
    return []
  }
  const files: string[] = []
  for (const entry of readdirSync(dirPath)) {
    const entryPath = join(dirPath, entry)
    const stat = statSync(entryPath)
    if (stat.isDirectory()) {
      files.push(...listJsonFiles(entryPath))
    } else if (stat.isFile() && entryPath.endsWith(".json")) {
      files.push(entryPath)
    }
  }
  return files
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

function increment(counts: Map<string, number>, key: string): void {
  counts.set(key, (counts.get(key) ?? 0) + 1)
}

function countLines(counts: Map<string, number>): readonly string[] {
  if (counts.size === 0) {
    return ["- none"]
  }
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, count]) => `- ${key}: ${count}`)
}

function parseEvidenceFile(filePath: string): EvidenceRecord | undefined {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"))
  if (!isRecord(parsed)) {
    return undefined
  }
  return {
    targetFile: typeof parsed.targetFile === "string" ? parsed.targetFile : "unknown",
    fileRole: typeof parsed.fileRole === "string" ? parsed.fileRole : "unknown",
    selectedRules: stringArray(parsed.selectedRules),
    selectedSharedSkills: skillNames(parsed.selectedSharedSkills),
  }
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null
}

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function tokenAggregate(value: unknown): TokenAggregate {
  if (!isRecord(value)) {
    return TOKEN_ZERO
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

function addTokenAggregate(left: TokenAggregate, right: TokenAggregate): TokenAggregate {
  return {
    cacheRead: left.cacheRead + right.cacheRead,
    cacheWrite: left.cacheWrite + right.cacheWrite,
    input: left.input + right.input,
    output: left.output + right.output,
    reasoning: left.reasoning + right.reasoning,
    total: left.total + right.total,
  }
}

function tokenSessionMetric(parsed: Record<string, unknown>, filePath: string): TokenSessionMetrics | undefined {
  if (parsed.schemaVersion !== "token-usage.1") {
    return undefined
  }
  const aggregate = tokenAggregate(parsed.aggregate)
  return {
    aggregate,
    modelID: nullableString(parsed.modelID),
    modelLimit: nullableNumber(parsed.modelLimit),
    providerID: nullableString(parsed.providerID),
    ratio: nullableNumber(parsed.ratio),
    sessionID: nullableString(parsed.sessionID) ?? basename(filePath).replace(/\.json$/u, ""),
  }
}

function plainObject(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function normalizeToolName(value: string): string {
  return value.trim()
}

function toolFamily(toolName: string): string | undefined {
  return MCP_FAMILIES.find((family) => toolName === family || toolName.startsWith(`${family}_`) || toolName.startsWith(`${family}.`))
}

function looksLikeToolNameKey(key: string): boolean {
  return /^(tool|toolName|tool_name|name|identifier)$/u.test(key)
}

function isToolUseRecord(value: Record<string, unknown>): boolean {
  const type = typeof value.type === "string" ? value.type : ""
  const event = typeof value.event === "string" ? value.event : ""
  const kind = typeof value.kind === "string" ? value.kind : ""
  return /tool|mcp/u.test(`${type} ${event} ${kind}`)
}

function collectToolNames(value: unknown, names: string[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) {
      collectToolNames(entry, names)
    }
    return
  }
  const record = plainObject(value)
  if (record === undefined) {
    return
  }
  const recordLooksToolRelated = isToolUseRecord(record)
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry === "string" && looksLikeToolNameKey(key) && (key !== "name" || recordLooksToolRelated)) {
      const normalized = normalizeToolName(entry)
      if (normalized !== "") {
        names.push(normalized)
      }
    } else if (typeof entry === "object" && entry !== null) {
      collectToolNames(entry, names)
    }
  }
}

function finishStatus(value: Record<string, unknown>): "fail" | "pass" | "unknown" | undefined {
  const command = typeof value.command === "string" ? value.command : ""
  if (!/\bworkflow\s+finish\s+implement\b/u.test(command)) {
    return undefined
  }
  const status = value.status
  const exitCode = value.exitCode
  if (status === 0 || exitCode === 0 || status === "pass" || status === "passed") {
    return "pass"
  }
  if (
    (typeof status === "number" && status !== 0)
    || (typeof exitCode === "number" && exitCode !== 0)
    || status === "fail"
    || status === "failed"
  ) {
    return "fail"
  }
  return "unknown"
}

function directReadChars(value: Record<string, unknown>): number {
  const direct = numberValue(value.readChars) + numberValue(value.read_chars)
  if (direct > 0) {
    return direct
  }
  return typeof value.readOutput === "string" ? value.readOutput.length : 0
}

function objectsFromEvidenceFile(filePath: string): readonly unknown[] {
  const source = readFileSync(filePath, "utf8")
  if (filePath.endsWith(".jsonl")) {
    return source
      .split(/\r?\n/u)
      .filter((line) => line.trim() !== "")
      .map((line) => JSON.parse(line) as unknown)
  }
  return [JSON.parse(source) as unknown]
}

function readEvidenceSummary(projectDir: string): EvidenceSummary {
  const evidenceDir = join(projectDir, ".persona", "evidence")
  const records: EvidenceRecord[] = []
  const unreadableFiles: string[] = []
  for (const filePath of listJsonFiles(evidenceDir)) {
    try {
      const record = parseEvidenceFile(filePath)
      if (record === undefined) {
        unreadableFiles.push(filePath)
      } else {
        records.push(record)
      }
    } catch {
      unreadableFiles.push(filePath)
    }
  }
  return { records, unreadableFiles }
}

export function readEvidenceMetrics(options: EvidenceOptions = {}): EvidenceMetrics {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const evidenceDir = join(projectDir, ".persona", "evidence")
  const unreadableFiles: string[] = []
  const tokenSessions: TokenSessionMetrics[] = []
  const toolCounts = new Map<string, number>()
  const mcpCounts = new Map<string, number>()
  const mcpFamilyCounts = new Map<string, number>()
  const finishRecords: FinishMetricRecord[] = []
  let readChars = 0
  let filesScanned = 0

  for (const filePath of listEvidenceFiles(evidenceDir)) {
    filesScanned += 1
    try {
      for (const parsed of objectsFromEvidenceFile(filePath)) {
        const record = plainObject(parsed)
        if (record === undefined) {
          continue
        }
        const session = tokenSessionMetric(record, filePath)
        if (session !== undefined) {
          tokenSessions.push(session)
        }
        const toolNames: string[] = []
        collectToolNames(record, toolNames)
        for (const toolName of toolNames) {
          increment(toolCounts, toolName)
          const family = toolFamily(toolName)
          if (family !== undefined) {
            increment(mcpCounts, toolName)
            increment(mcpFamilyCounts, family)
          }
        }
        const finish = finishStatus(record)
        if (finish !== undefined) {
          finishRecords.push({ file: filePath, status: finish })
        }
        readChars += directReadChars(record)
      }
    } catch {
      unreadableFiles.push(filePath)
    }
  }

  const tokenTotal = tokenSessions.reduce((total, session) => addTokenAggregate(total, session.aggregate), TOKEN_ZERO)
  const mcpTotal = Array.from(mcpCounts.values()).reduce((sum, count) => sum + count, 0)
  const toolTotal = Array.from(toolCounts.values()).reduce((sum, count) => sum + count, 0)
  const finishPass = finishRecords.filter((record) => record.status === "pass").length
  const finishFail = finishRecords.filter((record) => record.status === "fail").length
  const finishUnknown = finishRecords.filter((record) => record.status === "unknown").length

  return {
    evidenceDir,
    filesScanned,
    finish: {
      fail: finishFail,
      pass: finishPass,
      records: finishRecords,
      unknown: finishUnknown,
    },
    limitations: [
      "Metrics aggregate local evidence only; missing evidence is reported as unavailable.",
      "Provider-token and tool-call totals are not an effectiveness or token-saving claim.",
      "Tool-call counts come from structured JSON/JSONL tool-name fields, not prose-only mentions.",
    ],
    mcp: {
      byFamily: Object.fromEntries(Array.from(mcpFamilyCounts.entries()).sort(([left], [right]) => left.localeCompare(right))),
      byTool: Object.fromEntries(Array.from(mcpCounts.entries()).sort(([left], [right]) => left.localeCompare(right))),
      total: mcpTotal,
    },
    projectDir,
    readChars: {
      total: readChars,
      unavailableReason: readChars === 0 ? "no structured readChars/readOutput evidence found" : null,
    },
    schemaVersion: "evidence-metrics.1",
    tokenUsage: {
      aggregate: tokenTotal,
      sessions: tokenSessions.sort((left, right) => left.sessionID.localeCompare(right.sessionID)),
    },
    toolCalls: {
      byTool: Object.fromEntries(Array.from(toolCounts.entries()).sort(([left], [right]) => left.localeCompare(right))),
      total: toolTotal,
    },
    unreadableFiles,
  }
}

function formatEvidenceSummary(projectDir: string, summary: EvidenceSummary): string {
  const roleCounts = new Map<string, number>()
  const ruleCounts = new Map<string, number>()
  const skillCounts = new Map<string, number>()
  for (const record of summary.records) {
    increment(roleCounts, record.fileRole)
    for (const rule of record.selectedRules) {
      increment(ruleCounts, rule)
    }
    for (const skill of record.selectedSharedSkills) {
      increment(skillCounts, skill)
    }
  }
  return [
    "# Persona Evidence Summary",
    "",
    `Project: \`${projectDir}\``,
    `Total evidence files: ${summary.records.length}`,
    `Unreadable evidence files: ${summary.unreadableFiles.length}`,
    "",
    "## Role Counts",
    "",
    ...countLines(roleCounts),
    "",
    "## Rule Counts",
    "",
    ...countLines(ruleCounts),
    "",
    "## Skill Counts",
    "",
    ...countLines(skillCounts),
    "",
    "## Targets",
    "",
    ...(summary.records.length === 0
      ? ["- none"]
      : summary.records.map((record) => `- ${basename(record.targetFile)} (${record.fileRole})`)),
    "",
    "## Unreadable Files",
    "",
    ...(summary.unreadableFiles.length === 0 ? ["- none"] : summary.unreadableFiles.map((filePath) => `- ${basename(filePath)}`)),
    "",
    "## Limitations",
    "",
    "- Summary-only evidence view.",
    "- Not generated app product-quality certification.",
    "",
  ].join("\n")
}

function formatEvidenceMetrics(metrics: EvidenceMetrics): string {
  return [
    "# Persona Evidence Metrics",
    "",
    `Project: \`${metrics.projectDir}\``,
    `Evidence directory: \`${metrics.evidenceDir}\``,
    `Evidence files scanned: ${metrics.filesScanned}`,
    `Unreadable evidence files: ${metrics.unreadableFiles.length}`,
    "",
    "## Provider Token Evidence",
    "",
    `Sessions: ${metrics.tokenUsage.sessions.length}`,
    `Input: ${metrics.tokenUsage.aggregate.input}`,
    `Output: ${metrics.tokenUsage.aggregate.output}`,
    `Reasoning: ${metrics.tokenUsage.aggregate.reasoning}`,
    `Cache read: ${metrics.tokenUsage.aggregate.cacheRead}`,
    `Cache write: ${metrics.tokenUsage.aggregate.cacheWrite}`,
    `Total: ${metrics.tokenUsage.aggregate.total}`,
    "",
    "## Tool Calls",
    "",
    `Total structured tool calls: ${metrics.toolCalls.total}`,
    ...countLines(new Map(Object.entries(metrics.toolCalls.byTool))),
    "",
    "## MCP Usage",
    "",
    `Total structured MCP calls: ${metrics.mcp.total}`,
    ...countLines(new Map(Object.entries(metrics.mcp.byFamily))),
    "",
    "## Finish Linkage",
    "",
    `Pass: ${metrics.finish.pass}`,
    `Fail: ${metrics.finish.fail}`,
    `Unknown: ${metrics.finish.unknown}`,
    "",
    "## Read Chars",
    "",
    metrics.readChars.unavailableReason === null
      ? `Structured read chars: ${metrics.readChars.total}`
      : `Structured read chars unavailable: ${metrics.readChars.unavailableReason}`,
    "",
    "## Limitations",
    "",
    ...metrics.limitations.map((limitation) => `- ${limitation}`),
    "",
  ].join("\n")
}

export function writeEvidenceSummary(options: EvidenceOptions = {}): string {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const outputPath = join(projectDir, SUMMARY_PATH)
  mkdirSync(dirname(outputPath), { recursive: true })
  writeFileSync(outputPath, formatEvidenceSummary(projectDir, readEvidenceSummary(projectDir)))
  return outputPath
}

export function runEvidenceCommand(args: readonly string[], options: EvidenceOptions = {}, invocationName = "ph"): CliRunResult {
  if (args.length === 1 && args[0] === "summary") {
    const outputPath = writeEvidenceSummary(options)
    const projectDir = resolve(options.projectDir ?? process.cwd())
    return {
      status: 0,
      stdout: [
        `Evidence summary written: ${outputPath}`,
        `Evidence directory: ${join(projectDir, EVIDENCE_DIR)}`,
      ].join("\n") + "\n",
      stderr: "",
    }
  }
  if ((args.length === 1 || args.length === 2) && args[0] === "metrics") {
    const metrics = readEvidenceMetrics(options)
    if (args.length === 2 && args[1] === "--json") {
      return { status: 0, stdout: `${JSON.stringify(metrics, null, 2)}\n`, stderr: "" }
    }
    if (args.length === 1) {
      return { status: 0, stdout: formatEvidenceMetrics(metrics), stderr: "" }
    }
  }
  if ((args.length === 1 || args.length === 2) && args[0] === "ab-report") {
    const report = readEvidenceAbReport(options)
    if (args.length === 2 && args[1] === "--json") {
      return { status: 0, stdout: `${JSON.stringify(report, null, 2)}\n`, stderr: "" }
    }
    if (args.length === 1) {
      return { status: 0, stdout: formatEvidenceAbReport(report), stderr: "" }
    }
  }
  return { status: 1, stdout: "", stderr: `Usage: ${invocationName} evidence <summary|metrics [--json]|ab-report [--json]>\n` }
}
