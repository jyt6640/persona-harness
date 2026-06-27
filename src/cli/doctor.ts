import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

import { isRecord } from "../config/jsonc.js"
import type { CliRunResult } from "./bearshell.js"
import {
  detectCommandOutput,
  detectCommandVersion,
  type DoctorCommandFinder,
  type DoctorCommandRunner,
} from "./doctor-command-detection.js"

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
  readonly packageVersion: string
  readonly registry: string
  readonly opencodeConfig: "present" | "missing"
  readonly pluginPath: "configured" | "missing" | "unreadable"
  readonly harnessConfig: "present" | "missing"
  readonly rules: "present" | "missing"
  readonly workflowPlan: "present" | "missing"
  readonly evidence: "present" | "missing"
  readonly rulesFileCount: number
  readonly staleFixtureFindings: readonly StaleFixtureFinding[]
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

function pluginStatus(projectDir: string): "configured" | "missing" | "unreadable" {
  const configPath = join(projectDir, ".opencode", "opencode.json")
  if (!existsSync(configPath)) {
    return "missing"
  }
  try {
    const content = readFileSync(configPath, "utf8")
    return content.includes("dist/index.js") || content.includes("persona-harness") ? "configured" : "missing"
  } catch {
    return "unreadable"
  }
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
  const opencode = opencodeVersion(options)
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
    packageVersion: packageVersion(),
    registry: registryStatus(options),
    opencodeConfig: pathStatus(projectDir, ".opencode/opencode.json"),
    pluginPath: pluginStatus(projectDir),
    harnessConfig: pathStatus(projectDir, ".persona/harness.jsonc"),
    rules: pathStatus(projectDir, ".persona/rules"),
    workflowPlan: pathStatus(projectDir, ".persona/workflow/plan.md"),
    evidence: pathStatus(projectDir, ".persona/evidence"),
    ...rulesScan,
  }
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
    `Stale fixture scan: ${staleStatus}`,
    ...staleDetails,
    "",
    "Scope:",
    "- local install / tarball install diagnostics",
    "- no generated app product-quality certification",
  ].join("\n")
}

export function runDoctorCommand(_args: readonly string[], options: DoctorOptions = {}): CliRunResult {
  return { status: 0, stdout: `${formatDoctorSummary(readDoctorSummary(options))}\n`, stderr: "" }
}
