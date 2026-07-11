import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { isRecord } from "../config/jsonc.js"
import { summarizeConventionPackDiagnostics } from "./convention-pack-diagnostics.js"
import type { CliRunResult } from "./bearshell.js"
import {
  detectCommandOutput,
  detectCommandVersion,
  type DoctorCommandFinder,
  type DoctorCommandRunner,
} from "./doctor-command-detection.js"
import {
  readDoctorReachability,
  type DoctorReachabilitySummary,
} from "./doctor-reachability.js"
import { summarizeRuleDiagnostics } from "../rules/rule-diagnostics-report.js"
import type { RuleDiagnosticReportItem } from "../rules/rule-diagnostics-report.js"
import type { ConventionPackDiagnostic } from "./convention-pack-diagnostics.js"

type DoctorOptions = {
  readonly projectDir?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly platform?: NodeJS.Platform
  readonly commandFinder?: DoctorCommandFinder
  readonly commandRunner?: DoctorCommandRunner
}

export type StaleFixtureFinding = {
  readonly relativePath: string
  readonly matches: readonly string[]
}

export type DoctorSummary = {
  readonly projectDir: string
  readonly node: string
  readonly npm: string
  readonly npx: string
  readonly opencode: string
  readonly runtimeReadiness: "PASS" | "WARN"
  readonly runtimeFindings: readonly string[]
  readonly reachability: DoctorReachabilitySummary
  readonly packageVersion: string
  readonly registry: string
  readonly opencodeConfig: "present" | "missing"
  readonly pluginPath: "configured" | "missing" | "unreadable"
  readonly harnessConfig: "present" | "missing"
  readonly rules: "present" | "missing"
  readonly workflowPlan: "present" | "missing"
  readonly evidence: "present" | "missing"
  readonly rulesFileCount: number
  readonly rulePackDiagnostics: "PASS" | "WARN"
  readonly rulePackDiagnosticCount: number
  readonly rulePackDiagnosticDetails: readonly RuleDiagnosticReportItem[]
  readonly conventionPackDiagnostics: "PASS" | "WARN"
  readonly conventionPackDiagnosticCount: number
  readonly conventionPackDiagnosticDetails: readonly ConventionPackDiagnostic[]
  readonly staleFixtureFindings: readonly StaleFixtureFinding[]
  readonly legacyDiffRulesPresent: boolean
}

const STALE_FIXTURE_TOKENS = [
  "step1-api-contract",
  "step2-3-api-contract",
] as const

function commandVersion(command: string, args: readonly string[], options: DoctorOptions): string {
  return detectCommandVersion(command, args, {
    env: options.env ?? process.env,
    finder: options.commandFinder,
    platform: options.platform,
    runner: options.commandRunner,
  })
}

function opencodeVersion(options: DoctorOptions): string {
  const env = options.env ?? process.env
  return env.PH_DOCTOR_OPENCODE_VERSION ?? commandVersion("opencode", ["--version"], options)
}

function commandOutput(command: string, args: readonly string[], options: DoctorOptions): string | undefined {
  return detectCommandOutput(command, args, {
    env: options.env ?? process.env,
    finder: options.commandFinder,
    platform: options.platform,
    runner: options.commandRunner,
  })
}

function pathStatus(projectDir: string, relativePath: string): "present" | "missing" {
  return existsSync(join(projectDir, relativePath)) ? "present" : "missing"
}

function packageVersion(): string {
  const packagePath = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json")
  try {
    const parsed: unknown = JSON.parse(readFileSync(packagePath, "utf8"))
    return isRecord(parsed) && typeof parsed.version === "string" ? parsed.version : "unknown"
  } catch {
    return process.env.npm_package_version ?? "unknown"
  }
}

function registryStatus(options: DoctorOptions): string {
  const env = options.env ?? process.env
  const distTagsJson = env.PH_DOCTOR_REGISTRY_DIST_TAGS ?? commandOutput("npm", ["view", "persona-harness", "dist-tags", "--json"], options)
  if (distTagsJson === undefined || distTagsJson.length === 0) {
    return "unavailable"
  }
  try {
    const parsed: unknown = JSON.parse(distTagsJson)
    if (!isRecord(parsed)) {
      return "unavailable"
    }
    const alpha = typeof parsed.alpha === "string" ? parsed.alpha : "missing"
    const latest = typeof parsed.latest === "string" ? parsed.latest : "missing"
    return `alpha=${alpha}, latest=${latest}`
  } catch {
    return "unavailable"
  }
}

function normalizeRelativePath(filePath: string, rootDir: string): string {
  return filePath === rootDir ? "" : filePath.slice(rootDir.length + 1).replace(/\\/g, "/")
}

function listRuleFiles(rulesDir: string): readonly string[] {
  if (!existsSync(rulesDir)) {
    return []
  }
  const files: string[] = []
  const visit = (currentDir: string): void => {
    for (const entry of readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        visit(entryPath)
      } else if (entry.isFile()) {
        files.push(entryPath)
      }
    }
  }
  if (statSync(rulesDir).isDirectory()) {
    visit(rulesDir)
  }
  return files.sort()
}

function staleMatches(relativePath: string, content: string): readonly string[] {
  const haystack = `${relativePath}\n${content}`
  return STALE_FIXTURE_TOKENS.filter((token) => haystack.includes(token))
}

function scanStaleFixtureRules(projectDir: string): {
  readonly rulesFileCount: number
  readonly staleFixtureFindings: readonly StaleFixtureFinding[]
} {
  const rulesDir = join(projectDir, ".persona", "rules")
  const ruleFiles = listRuleFiles(rulesDir)
  const findings = ruleFiles.flatMap((filePath): readonly StaleFixtureFinding[] => {
    const relativePath = normalizeRelativePath(filePath, rulesDir)
    try {
      const matches = staleMatches(relativePath, readFileSync(filePath, "utf8"))
      return matches.length > 0 ? [{ relativePath, matches }] : []
    } catch {
      return [{ relativePath, matches: ["unreadable"] }]
    }
  })
  return { rulesFileCount: ruleFiles.length, staleFixtureFindings: findings }
}

export function readDoctorSummary(options: DoctorOptions = {}): DoctorSummary {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const env = options.env ?? process.env
  const rulesScan = scanStaleFixtureRules(projectDir)
  const rulePackDiagnostics = summarizeRuleDiagnostics(projectDir)
  const conventionPackDiagnostics = summarizeConventionPackDiagnostics(projectDir)
  const opencode = opencodeVersion(options)
  const reachability = readDoctorReachability(projectDir)
  const runtimeFindings = opencode === "missing"
    ? ["OpenCode CLI is missing; Persona Harness plugin runtime attachment cannot be verified."]
    : []
  return {
    projectDir,
    node: process.version,
    npm: commandVersion("npm", ["--version"], options),
    npx: commandVersion("npx", ["--version"], options),
    opencode,
    runtimeReadiness: runtimeFindings.length === 0 ? "PASS" : "WARN",
    runtimeFindings,
    reachability,
    packageVersion: packageVersion(),
    registry: registryStatus(options),
    opencodeConfig: pathStatus(projectDir, ".opencode/opencode.json"),
    pluginPath:
      reachability.projectPluginState === "configured"
        ? "configured"
        : reachability.projectPluginState === "unreadable"
          ? "unreadable"
          : "missing",
    harnessConfig: pathStatus(projectDir, ".persona/harness.jsonc"),
    rules: pathStatus(projectDir, ".persona/rules"),
    workflowPlan: pathStatus(projectDir, ".persona/workflow/plan.md"),
    evidence: pathStatus(projectDir, ".persona/evidence"),
    legacyDiffRulesPresent: existsSync(join(projectDir, ".persona", "rules", "diff-rules")),
    rulePackDiagnostics: rulePackDiagnostics.finding,
    rulePackDiagnosticCount: rulePackDiagnostics.diagnosticCount,
    rulePackDiagnosticDetails: rulePackDiagnostics.diagnostics,
    conventionPackDiagnostics: conventionPackDiagnostics.finding,
    conventionPackDiagnosticCount: conventionPackDiagnostics.diagnosticCount,
    conventionPackDiagnosticDetails: conventionPackDiagnostics.diagnostics,
    ...rulesScan,
  }
}

function formatRulePackDiagnostic(item: RuleDiagnosticReportItem): string {
  const field = item.diagnostic.field === undefined ? "-" : item.diagnostic.field
  return `- ${item.path} [${item.diagnostic.code}/${field}]: ${item.diagnostic.message}`
}

function formatConventionPackDiagnostic(item: ConventionPackDiagnostic): string {
  const field = item.field === undefined ? "-" : item.field
  return `- ${item.path} [${item.code}/${field}]: ${item.message}`
}

export function formatDoctorSummary(summary: DoctorSummary): string {
  const staleStatus = summary.staleFixtureFindings.length === 0 ? "PASS" : `WARN (${summary.staleFixtureFindings.length} findings)`
  const staleDetails =
    summary.staleFixtureFindings.length === 0
      ? []
      : [
          "",
          "Stale fixture findings:",
          ...summary.staleFixtureFindings.map(
            (finding) => `- ${finding.relativePath}: ${finding.matches.join(", ")}`,
          ),
        ]
  const rulePackDetails =
    summary.rulePackDiagnosticDetails.length === 0
      ? []
      : [
          "",
          "Rule pack diagnostic details:",
          ...summary.rulePackDiagnosticDetails.map(formatRulePackDiagnostic),
        ]
  const conventionPackDetails =
    summary.conventionPackDiagnosticDetails.length === 0
      ? []
      : [
          "",
          "Convention pack diagnostic details:",
          ...summary.conventionPackDiagnosticDetails.map(formatConventionPackDiagnostic),
        ]
  const legacyDiffRulesDetails =
    summary.legacyDiffRulesPresent
      ? [
          "",
          "Legacy package material:",
          "- .persona/rules/diff-rules/: legacy/unneeded package material from an older Persona Harness install; it is no longer shipped or required. Persona Harness leaves user files untouched; remove it manually only after review.",
        ]
      : []
  return [
    "Persona Harness Doctor",
    "",
    `Project: ${summary.projectDir}`,
    `Node: ${summary.node}`,
    `npm: ${summary.npm}`,
    `npx: ${summary.npx}`,
    `OpenCode: ${summary.opencode}`,
    `Runtime readiness: ${summary.runtimeReadiness}`,
    ...summary.runtimeFindings.map((finding) => `- ${finding}`),
    `Session reachability: ${summary.reachability.level}`,
    `AGENTS.md steering: ${summary.reachability.agentsState}`,
    `Project-local OpenCode plugin registration: ${summary.reachability.projectPluginState}`,
    `PH-run verification: ${summary.reachability.executeVerification ? "ON" : "OFF"}`,
    ...summary.reachability.findings.map((finding) => `- [${finding.level}] ${finding.message}`),
    ...summary.reachability.followUpLines,
    `Persona package version: ${summary.packageVersion}`,
    `npm registry: ${summary.registry}`,
    "",
    "Project integration:",
    `.opencode/opencode.json: ${summary.opencodeConfig}`,
    `Persona plugin path: ${summary.pluginPath}`,
    `.persona/harness.jsonc: ${summary.harnessConfig}`,
    `.persona/rules: ${summary.rules}`,
    `.persona/workflow/plan.md: ${summary.workflowPlan}`,
    `.persona/evidence: ${summary.evidence}`,
    `Rules surface: ${summary.rulesFileCount} files`,
    "",
    "Rule pack diagnostics:",
    `Rules: ${summary.rulePackDiagnostics} (${summary.rulePackDiagnosticCount} diagnostics)`,
    `Conventions: ${summary.conventionPackDiagnostics} (${summary.conventionPackDiagnosticCount} diagnostics)`,
    "Pack diagnostics are report-only; they do not block existing workflow gates.",
    ...rulePackDetails,
    ...conventionPackDetails,
    `Stale fixture scan: ${staleStatus}`,
    ...staleDetails,
    ...legacyDiffRulesDetails,
    "",
    "Scope:",
    "- local install / tarball install diagnostics",
    "- no generated app product-quality certification",
  ].join("\n")
}

export function runDoctorCommand(_args: readonly string[], options: DoctorOptions = {}): CliRunResult {
  const summary = readDoctorSummary(options)
  return {
    status: summary.reachability.level === "BLOCK" ? 1 : 0,
    stdout: `${formatDoctorSummary(summary)}\n`,
    stderr: "",
  }
}
