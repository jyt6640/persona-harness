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

/**
 * What a WARN from each text observer actually means, and what to do about it.
 *
 * These rules do not share a polarity: `controller.repository-dependency`,
 * `controller.sql-access`, and `service.storage-ownership` warn because
 * something is present, while `controller.service-dependency`,
 * `test.contract-anchors`, and `dto.boundary` warn because something is
 * absent. Printing a bare rule id left both kinds looking identical — a
 * Controller that legitimately warns on both counts produced two lines that a
 * reader could not tell apart, let alone act on.
 *
 * Presentation only: it explains findings that were already produced and
 * changes no verdict, level, or gate.
 */
const WARN_GUIDANCE: Readonly<Record<string, { readonly message: string; readonly fixPath: string }>> = {
  [CONTROLLER_REPOSITORY_CONVENTION.id]: {
    message: "This Controller depends on a Repository directly, so persistence choices leak into the web layer.",
    fixPath: CONTROLLER_REPOSITORY_CONVENTION.fixPath,
  },
  "controller.service-dependency": {
    message: "This Controller has no Service dependency, so orchestration lives in the web layer.",
    fixPath: "move the orchestration into a Service and have the Controller call it.",
  },
  "controller.sql-access": {
    message: "This Controller reaches SQL or persistence APIs directly, so queries are written at the HTTP boundary.",
    fixPath: "move the query behind a Repository or Service and return a DTO from the Controller.",
  },
  "dto.boundary": {
    message: "This type is named Dto, so the direction it carries is not visible at the boundary.",
    fixPath: "name it after its direction — Request for inbound, Response for outbound.",
  },
  "service.storage-ownership": {
    message: "This Service owns storage or mutates state it also holds, so persistence is not behind a boundary.",
    fixPath: "move the state behind a Repository or persistence-backed boundary.",
  },
  "test.contract-anchors": {
    message: "This test is missing contract anchors, so it does not pin the behaviour it claims to cover.",
    fixPath: "add the missing anchors listed in the finding evidence.",
  },
}

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
    targetPath: reportPath(projectDir, targetPath) || ".",
    inspectedFiles: javaFiles.map((filePath) => reportPath(projectDir, filePath)),
    findings,
    limitations: [
      "Report-only observer output; not enforcement and not generated app quality certification.",
      "Java parsing is text based and may miss equivalent AST shapes.",
    ],
  }
}

function observeAstGrepConventions(projectDir: string, javaFiles: readonly string[]): readonly ObserveFinding[] {
  const inspectedFilePaths = new Set(javaFiles.map((filePath) => reportPath(projectDir, filePath)))
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
    // A convention that never ran has no verdict. Reporting it as WARN told the
    // user their code violated a rule that was in fact not evaluated — on a host
    // without ast-grep that produced one fabricated violation per convention.
    return [{
      ruleId: definition.id,
      result: "UNKNOWN",
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

/**
 * Report paths in POSIX form on every platform.
 *
 * `relative()` yields backslashes on Windows while ast-grep always emits
 * forward slashes, so one report described the same file two ways and anything
 * grouping findings by `filePath` saw two files. The set at
 * `inspectedFilePaths` already normalized for exactly this reason; the reported
 * paths did not.
 */
function reportPath(projectDir: string, filePath: string): string {
  return relative(projectDir, filePath).replace(/\\/g, "/")
}

function observeJavaFile(projectDir: string, filePath: string): readonly ObserveFinding[] {
  const source = readFileSync(filePath, "utf8")
  const relativePath = reportPath(projectDir, filePath)
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
  if (filePath.endsWith("Service.java") || filePath.endsWith("ServiceImpl.java")) {
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
  const result = normalizeFindingResult(observation.finding)
  // Only a WARN asks the reader to do something, so only a WARN carries a fix
  // path. Attaching one to PASS would invent work that the observation did not
  // find.
  const guidance = result === "WARN" ? WARN_GUIDANCE[ruleId] : undefined
  return {
    ruleId,
    result,
    evidence: observation.evidence,
    confidence: observationConfidence(observation),
    source: OBSERVER_SOURCE,
    limitations: isInfo ? [...observation.limitations, INFO_NORMALIZATION_LIMITATION] : observation.limitations,
    filePath,
    ...(guidance === undefined ? {} : { message: guidance.message, fixPath: guidance.fixPath }),
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
  // The headline line is unchanged so existing readers and parsers keep working;
  // the explanation is appended underneath, and only when the finding has one.
  const findingLines = report.findings.flatMap((finding) => {
    const location = finding.line === undefined ? finding.filePath : `${finding.filePath}:${finding.line}`
    const headline = `- ${finding.result} ${finding.ruleId} (${location}) confidence=${finding.confidence}`
    return [
      headline,
      ...(finding.message === undefined ? [] : [`    why: ${finding.message}`]),
      ...(finding.fixPath === undefined ? [] : [`    fix: ${finding.fixPath}`]),
    ]
  })
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
