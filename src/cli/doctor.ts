import { existsSync, readFileSync } from "node:fs"
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
import {
  loadHarnessConfigResult,
  resolveConfiguredPathResult,
  type HarnessConfigDiagnostic,
} from "../config/harness-config.js"
import { walkBoundedFiles } from "../io/bounded-path-walker.js"
import {
  readEntrySteeringStatusSummary,
  type EntrySteeringStatusSummary,
} from "../runtime/entry-steering-status.js"
import {
  assessVerificationAuthority,
  type VerificationAuthorityAssessment,
} from "./workflow-verification-receipt.js"

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
  readonly harnessConfig: "present" | "missing" | "invalid"
  readonly rules: "present" | "missing" | "invalid"
  readonly workflowPlan: "present" | "missing"
  readonly evidence: "present" | "missing" | "invalid"
  readonly configDiagnostics: readonly HarnessConfigDiagnostic[]
  readonly pathSafetyDiagnostics: readonly string[]
  readonly rulesFileCount: number
  readonly rulePackDiagnostics: "PASS" | "WARN"
  readonly rulePackDiagnosticCount: number
  readonly rulePackDiagnosticDetails: readonly RuleDiagnosticReportItem[]
  readonly conventionPackDiagnostics: "PASS" | "WARN"
  readonly conventionPackDiagnosticCount: number
  readonly conventionPackDiagnosticDetails: readonly ConventionPackDiagnostic[]
  readonly staleFixtureFindings: readonly StaleFixtureFinding[]
  readonly legacyDiffRulesPresent: boolean
  readonly entrySteeringEnabled: boolean
  readonly entrySteeringStatus: EntrySteeringStatusSummary
  readonly verificationAuthority: VerificationAuthorityAssessment
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

function pathStatus(absolutePath: string): "present" | "missing" {
  return existsSync(absolutePath) ? "present" : "missing"
}

function platformFindings(platform: NodeJS.Platform): readonly string[] {
  return platform === "win32"
    ? [
        "Unverified platform: Windows has not been measured or verified for Persona Harness.",
        "Lock identity device/inode behavior is not measured or verified on Windows; stale-lock and concurrency conclusions are limited.",
      ]
    : []
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

function staleMatches(relativePath: string, content: string): readonly string[] {
  const haystack = `${relativePath}\n${content}`
  return STALE_FIXTURE_TOKENS.filter((token) => haystack.includes(token))
}

function scanStaleFixtureRules(projectDir: string, rulesDir: string, displayRoot: string): {
  readonly pathSafetyDiagnostics: readonly string[]
  readonly rulesFileCount: number
  readonly staleFixtureFindings: readonly StaleFixtureFinding[]
} {
  const walked = walkBoundedFiles(rulesDir, projectDir, {
    displayRoot,
    extensions: [".md"],
    includeText: true,
  })
  const findings = walked.files.flatMap((file): readonly StaleFixtureFinding[] => {
    const relativePath = normalizeRelativePath(file.absolutePath, rulesDir)
    const matches = staleMatches(relativePath, file.text ?? "")
    return matches.length > 0 ? [{ relativePath, matches }] : []
  })
  return {
    pathSafetyDiagnostics: walked.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`),
    rulesFileCount: walked.files.length,
    staleFixtureFindings: findings,
  }
}

export function readDoctorSummary(options: DoctorOptions = {}): DoctorSummary {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const configResult = loadHarnessConfigResult(projectDir)
  const harnessConfig = configResult.config
  const rulesPath = configResult.safe
    ? resolveConfiguredPathResult(projectDir, harnessConfig.rulesDir)
    : undefined
  const evidencePath = configResult.safe
    ? resolveConfiguredPathResult(projectDir, harnessConfig.evidenceDir)
    : undefined
  const rulesScan = rulesPath?.ok === true
    ? scanStaleFixtureRules(projectDir, rulesPath.path, rulesPath.relativePath || harnessConfig.rulesDir)
    : {
        pathSafetyDiagnostics: [],
        rulesFileCount: 0,
        staleFixtureFindings: [],
      }
  const evidenceScan = evidencePath?.ok === true
    ? walkBoundedFiles(evidencePath.path, projectDir, {
        displayRoot: evidencePath.relativePath || harnessConfig.evidenceDir,
        includeText: false,
      })
    : undefined
  const configPathDiagnostics = configResult.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
  const pathSafetyDiagnostics = [
    ...configPathDiagnostics,
    ...rulesScan.pathSafetyDiagnostics,
    ...(evidenceScan?.diagnostics.map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`) ?? []),
  ]
  const rulePackDiagnostics = summarizeRuleDiagnostics(projectDir)
  const conventionPackDiagnostics = summarizeConventionPackDiagnostics(projectDir)
  const opencode = opencodeVersion(options)
  const reachability = readDoctorReachability(projectDir)
  const verificationAuthority = assessVerificationAuthority(projectDir)
  const runtimeFindings = [
    ...platformFindings(options.platform ?? process.platform),
    ...(opencode === "missing"
      ? ["OpenCode CLI is missing; Persona Harness plugin runtime attachment cannot be verified."]
      : []),
    ...(pathSafetyDiagnostics.length > 0
      ? ["Harness configuration/path safety is blocked; read-only recovery is required."]
      : []),
  ]
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
    opencodeConfig: pathStatus(join(projectDir, ".opencode/opencode.json")),
    pluginPath:
      reachability.projectPluginState === "configured"
        ? "configured"
        : reachability.projectPluginState === "unreadable"
          ? "unreadable"
          : "missing",
    harnessConfig: configResult.diagnostics.length > 0
      ? "invalid"
      : pathStatus(join(projectDir, ".persona", "harness.jsonc")),
    rules: rulesScan.pathSafetyDiagnostics.length > 0
      ? "invalid"
      : rulesPath?.ok === true
        ? pathStatus(rulesPath.path)
        : "invalid",
    workflowPlan: pathStatus(join(projectDir, ".persona", "workflow", "plan.md")),
    evidence: evidenceScan?.safe === false
      ? "invalid"
      : evidencePath?.ok === true
        ? pathStatus(evidencePath.path)
        : "invalid",
    configDiagnostics: configResult.diagnostics,
    pathSafetyDiagnostics,
    entrySteeringEnabled: harnessConfig.features.entrySteering,
    entrySteeringStatus: readEntrySteeringStatusSummary(projectDir, harnessConfig),
    verificationAuthority,
    legacyDiffRulesPresent: rulesPath?.ok === true && existsSync(join(rulesPath.path, "diff-rules")),
    rulePackDiagnostics: rulePackDiagnostics.finding,
    rulePackDiagnosticCount: rulePackDiagnostics.diagnosticCount,
    rulePackDiagnosticDetails: rulePackDiagnostics.diagnostics,
    conventionPackDiagnostics: conventionPackDiagnostics.finding,
    conventionPackDiagnosticCount: conventionPackDiagnostics.diagnosticCount,
    conventionPackDiagnosticDetails: conventionPackDiagnostics.diagnostics,
    rulesFileCount: rulesScan.rulesFileCount,
    staleFixtureFindings: rulesScan.staleFixtureFindings,
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

function configuredRootDisplay(projectDir: string, configuredPath: string): string {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return "unavailable"
  }
  const result = resolveConfiguredPathResult(projectDir, configuredPath)
  return result.ok ? result.relativePath : "unavailable"
}

export function formatDoctorSummary(summary: DoctorSummary): string {
  const rulesRoot = configuredRootDisplay(summary.projectDir, loadHarnessConfigResult(summary.projectDir).config.rulesDir)
  const evidenceRoot = configuredRootDisplay(summary.projectDir, loadHarnessConfigResult(summary.projectDir).config.evidenceDir)
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
  const pathSafetyDetails =
    summary.pathSafetyDiagnostics.length === 0
      ? []
      : [
          "",
          "Config/path safety:",
          "- BLOCK: configured paths are read-only inspected with no-follow traversal and bounded limits.",
          ...summary.pathSafetyDiagnostics.map((diagnostic) => `- ${diagnostic}`),
        ]
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
    `Entry steering: ${summary.entrySteeringEnabled ? "ON (default-off opt-in)" : "OFF"}`,
    `Entry steering decisions: ${summary.entrySteeringStatus.decisions}`,
    `Entry steering fired: ${summary.entrySteeringStatus.fired}`,
    `Entry steering invalid records: ${summary.entrySteeringStatus.invalidRecords}`,
    `Verification receipt authority: ${summary.verificationAuthority.state} (read-only; no receipt grants finish authority)`,
    `Verification receipt diagnostics: ${summary.verificationAuthority.summary}`,
    `Legacy evidence records: ${summary.verificationAuthority.legacyEvidence.files.length} (diagnostic-only; no automatic migration)`,
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
    `Rules root: ${rulesRoot}`,
    `Evidence root: ${evidenceRoot}`,
    `.persona/workflow/plan.md: ${summary.workflowPlan}`,
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
    ...pathSafetyDetails,
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
    status: summary.reachability.level === "BLOCK" || summary.pathSafetyDiagnostics.length > 0 ? 1 : 0,
    stdout: `${formatDoctorSummary(summary)}\n`,
    stderr: "",
  }
}
