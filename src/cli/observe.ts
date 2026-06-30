import { existsSync, readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative, resolve } from "node:path"
import process from "node:process"

import { CONTROLLER_REPOSITORY_CONVENTION } from "../config/convention-registry.js"
import type { ConventionDefinition, ConventionLevel } from "../config/convention-registry.js"
import type { CliRunResult } from "./bearshell.js"
import { runAstGrepConvention } from "./ast-grep-convention-runner.js"
import { readConventionDefinitions } from "./convention-definitions.js"
import { observeControllerRepositoryDependency } from "../observer/controller-repository-observer.js"
import type { ControllerRepositoryObservation } from "../observer/controller-repository-observer.js"
import { observeControllerServiceDependency } from "../observer/controller-service-observer.js"
import type { ControllerServiceObservation } from "../observer/controller-service-observer.js"
import { observeControllerSqlAccess } from "../observer/controller-sql-observer.js"
import type { ControllerSqlObservation } from "../observer/controller-sql-observer.js"
import { observeDtoBoundary } from "../observer/dto-boundary-observer.js"
import type { DtoBoundaryObservation } from "../observer/dto-boundary-observer.js"
import { observeServiceStorageOwnership } from "../observer/service-storage-observer.js"
import type { ServiceStorageObservation } from "../observer/service-storage-observer.js"
import { observeTestContractAnchors } from "../observer/test-contract-observer.js"
import type { TestContractObservation } from "../observer/test-contract-observer.js"

type ObserveOptions = {
  readonly projectDir?: string
}

type ObserveResult = "PASS" | "WARN" | "UNKNOWN"
type ObserveConfidence = "HIGH" | "MEDIUM" | "LOW" | "NONE"
type ObserverSource = "ast-grep" | "manual/text"

type ObserveFinding = {
  readonly ruleId: string
  readonly result: ObserveResult
  readonly evidence: unknown
  readonly confidence: ObserveConfidence
  readonly source: ObserverSource
  readonly limitations: readonly string[]
  readonly filePath: string
  readonly checkKind?: "ast-grep" | "observer"
  readonly fixPath?: string
  readonly level?: ConventionLevel
  readonly line?: number
  readonly message?: string
}

type ObserveReport = {
  readonly command: "ph observe"
  readonly targetPath: string
  readonly inspectedFiles: readonly string[]
  readonly findings: readonly ObserveFinding[]
  readonly limitations: readonly string[]
}

const JAVA_EXTENSION = ".java"
const OBSERVER_SOURCE: ObserverSource = "manual/text"
const INFO_NORMALIZATION_LIMITATION = "INFO observation normalized to UNKNOWN because ph observe schema is PASS/WARN/UNKNOWN."

export function runObserveCommand(args: readonly string[], options: ObserveOptions = {}, invocationName = "ph"): CliRunResult {
  const jsonOnly = args.includes("--json")
  const targetArg = args.find((arg) => arg !== "--json")
  if (targetArg === undefined || targetArg === "--help" || targetArg === "-h") {
    return { status: targetArg === undefined ? 1 : 0, stdout: observeUsage(invocationName), stderr: targetArg === undefined ? "Missing observe target path.\n" : "" }
  }

  const projectDir = options.projectDir ?? process.cwd()
  const targetPath = resolve(projectDir, targetArg)
  if (!existsSync(targetPath)) {
    return { status: 1, stdout: "", stderr: `Observe target not found: ${targetArg}\n` }
  }

  const javaFiles = collectJavaFiles(targetPath)
  if (javaFiles.length === 0) {
    return { status: 1, stdout: "", stderr: `Observe target has no Java files: ${targetArg}\n` }
  }

  const report = buildObserveReport(projectDir, targetPath, javaFiles)
  const json = `${JSON.stringify(report, null, 2)}\n`
  return { status: 0, stdout: jsonOnly ? json : `${formatHumanSummary(report)}\n\n${json}`, stderr: "" }
}

function observeUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} observe [--json] <java-file-or-directory>`,
    "",
    "Runs report-only Java observer checks and prints normalized findings.",
  ].join("\n")
}

function collectJavaFiles(targetPath: string): readonly string[] {
  const stat = statSync(targetPath)
  if (stat.isFile()) return targetPath.endsWith(JAVA_EXTENSION) ? [targetPath] : []
  if (!stat.isDirectory()) return []

  const files: string[] = []
  const visit = (currentPath: string): void => {
    for (const entry of readdirSync(currentPath, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git" || entry.name === "build" || entry.name === "dist") continue
      const entryPath = join(currentPath, entry.name)
      if (entry.isDirectory()) {
        visit(entryPath)
      } else if (entry.isFile() && entryPath.endsWith(JAVA_EXTENSION)) {
        files.push(entryPath)
      }
    }
  }
  visit(targetPath)
  return files.sort()
}

function buildObserveReport(projectDir: string, targetPath: string, javaFiles: readonly string[]): ObserveReport {
  const findings = [
    ...javaFiles.flatMap((filePath) => observeJavaFile(projectDir, filePath)),
    ...observeAstGrepConventions(projectDir, javaFiles),
  ]
  return {
    command: "ph observe",
    targetPath: relative(projectDir, targetPath) || ".",
    inspectedFiles: javaFiles.map((filePath) => relative(projectDir, filePath)),
    findings,
    limitations: [
      "Report-only observer output; not enforcement and not generated app quality certification.",
      "Java parsing is text based and may miss equivalent AST shapes.",
    ],
  }
}

function observeAstGrepConventions(projectDir: string, javaFiles: readonly string[]): readonly ObserveFinding[] {
  const inspectedFilePaths = new Set(javaFiles.map((filePath) => relative(projectDir, filePath).replace(/\\/g, "/")))
  return readConventionDefinitions(projectDir).flatMap((definition) => {
    if (definition.check.kind !== "ast-grep") {
      return []
    }
    return observeAstGrepConvention(projectDir, definition, inspectedFilePaths)
  })
}

function observeAstGrepConvention(
  projectDir: string,
  definition: ConventionDefinition,
  inspectedFilePaths: ReadonlySet<string>,
): readonly ObserveFinding[] {
  const result = runAstGrepConvention(projectDir, definition)
  if (result.status === "inactive") {
    return []
  }
  if (result.status === "skipped") {
    return [{
      ruleId: definition.id,
      result: "WARN",
      evidence: { status: "skipped", warning: result.warning },
      confidence: "NONE",
      source: "ast-grep",
      limitations: [result.warning],
      filePath: ".persona/conventions",
      checkKind: "ast-grep",
      fixPath: definition.fixPath,
      level: definition.defaultLevel,
      message: result.warning,
    }]
  }

  return result.findings.flatMap((finding) => {
    if (!inspectedFilePaths.has(finding.path)) {
      return []
    }
    return [{
      ruleId: definition.id,
      result: "WARN",
      evidence: { message: finding.message, source: finding.path, line: finding.line },
      confidence: definition.highPrecision ? "HIGH" : "LOW",
      source: "ast-grep",
      limitations: ["ast-grep structural convention finding; report-only observe output."],
      filePath: finding.path,
      checkKind: "ast-grep",
      fixPath: definition.fixPath,
      level: definition.defaultLevel,
      line: finding.line,
      message: definition.actionableMessage,
    }]
  })
}

function observeJavaFile(projectDir: string, filePath: string): readonly ObserveFinding[] {
  const source = readFileSync(filePath, "utf8")
  const relativePath = relative(projectDir, filePath)
  const findings: ObserveFinding[] = []
  if (filePath.endsWith("Controller.java")) {
    findings.push(
      normalizeObservation("controller.service-dependency", relativePath, observeControllerServiceDependency({ filePath, source })),
      normalizeObservation(CONTROLLER_REPOSITORY_CONVENTION.id, relativePath, observeControllerRepositoryDependency({ filePath, source })),
      normalizeObservation("controller.sql-access", relativePath, observeControllerSqlAccess({ filePath, source })),
    )
  }
  if (/(?:Request|Response|Dto|DTO)\.java$/.test(filePath)) {
    findings.push(normalizeObservation("dto.boundary", relativePath, observeDtoBoundary({ filePath, source })))
  }
  if (filePath.endsWith("Service.java")) {
    findings.push(normalizeObservation("service.storage-ownership", relativePath, observeServiceStorageOwnership({ filePath, source })))
  }
  if (/(?:Test|Tests|IntegrationTest)\.java$/.test(filePath)) {
    findings.push(normalizeObservation("test.contract-anchors", relativePath, observeTestContractAnchors({ filePath, source, scenario: "step1" })))
  }
  if (findings.length === 0) {
    findings.push({
      ruleId: "java-file.applicability",
      result: "UNKNOWN",
      evidence: {},
      confidence: "NONE",
      source: OBSERVER_SOURCE,
      limitations: ["No report-only observer applies to this Java file role."],
      filePath: relativePath,
    })
  }
  return findings
}

function normalizeObservation(
  ruleId: string,
  filePath: string,
  observation:
    | ControllerRepositoryObservation
    | ControllerServiceObservation
    | ControllerSqlObservation
    | DtoBoundaryObservation
    | ServiceStorageObservation
    | TestContractObservation,
): ObserveFinding {
  const isInfo = observation.finding === "INFO"
  return {
    ruleId,
    result: normalizeFindingResult(observation.finding),
    evidence: observation.evidence,
    confidence: observationConfidence(observation),
    source: OBSERVER_SOURCE,
    limitations: isInfo ? [...observation.limitations, INFO_NORMALIZATION_LIMITATION] : observation.limitations,
    filePath,
  }
}

function normalizeFindingResult(finding: "PASS" | "WARN" | "UNKNOWN" | "INFO"): ObserveResult {
  return finding === "INFO" ? "UNKNOWN" : finding
}

function observationConfidence(
  observation:
    | ControllerRepositoryObservation
    | ControllerServiceObservation
    | ControllerSqlObservation
    | DtoBoundaryObservation
    | ServiceStorageObservation
    | TestContractObservation,
): ObserveConfidence {
  return "confidence" in observation && observation.confidence !== undefined ? observation.confidence : "NONE"
}

function formatHumanSummary(report: ObserveReport): string {
  const counts = findingCounts(report.findings)
  const findingLines = report.findings.map((finding) =>
    `- ${finding.result} ${finding.ruleId} (${finding.filePath}) confidence=${finding.confidence}`,
  )
  return [
    `Observe summary: ${report.inspectedFiles.length} Java file(s), ${report.findings.length} finding(s).`,
    `Results: PASS=${counts.PASS}, WARN=${counts.WARN}, UNKNOWN=${counts.UNKNOWN}.`,
    "Report-only: not enforcement, not generated app quality certification.",
    ...findingLines,
    "JSON:",
  ].join("\n")
}

function findingCounts(findings: readonly ObserveFinding[]): Record<ObserveResult, number> {
  return findings.reduce<Record<ObserveResult, number>>(
    (counts, finding) => ({ ...counts, [finding.result]: counts[finding.result] + 1 }),
    { PASS: 0, WARN: 0, UNKNOWN: 0 },
  )
}
