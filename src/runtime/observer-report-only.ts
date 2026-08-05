import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

import {
  findAstGrepBinary,
  loadAstGrepConventionDefinitions,
  runAstGrepConvention,
} from "../cli/ast-grep-convention-runner.js"
import { CONTROLLER_REPOSITORY_CONVENTION } from "../config/convention-registry.js"
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
import { warnRuntimeFailure } from "./error-boundary.js"
import type { ObserverReportOnlyFinding } from "./evidence.js"
import { writeObserverReportOnlyEvidence } from "./evidence.js"
import { isJavaTargetFile } from "./file-role.js"

type ObserveJavaWriteInput = {
  readonly evidenceDir?: string
  readonly projectDir: string
  readonly tool: string
  readonly sessionID: string
  readonly callID?: string
  readonly targetFile?: string
  readonly output?: ObserverToolOutput
}

/**
 * Structural view of the host tool output. Kept local so the observer does not
 * depend on the plugin hook module.
 */
export type ObserverToolOutput = {
  output?: unknown
}

export const OBSERVER_OUTPUT_MARKER = "[Persona Harness Observation]"
const OBSERVER_OUTPUT_BUDGET = 1_200
const OBSERVER_LINE_BUDGET = 240
const OBSERVER_OUTPUT_TRUNCATION = "… (truncated; see .persona/evidence for the full record)"
const OBSERVER_OUTPUT_FOOTER = "Report-only: not enforcement and not generated app quality certification."

type ObserverObservation =
  | ControllerRepositoryObservation
  | ControllerServiceObservation
  | ControllerSqlObservation
  | DtoBoundaryObservation
  | ServiceStorageObservation
  | TestContractObservation

const INFO_NORMALIZATION_LIMITATION = "INFO observation normalized to UNKNOWN because ph observe schema is PASS/WARN/UNKNOWN."
const AST_CONVENTION_LIMITATION = "AST convention match from ast-grep; report-only and not enforcement."
const OBSERVER_LIMITATIONS = [
  "Report-only observer output; not enforcement and not generated app quality certification.",
  "Java parsing is text based and may miss equivalent AST shapes.",
] as const

export function observeJavaWriteReportOnly(input: ObserveJavaWriteInput): void {
  if (!isJavaWriteOrEditTool(input.tool) || input.targetFile === undefined || !isJavaTargetFile(input.targetFile)) {
    return
  }

  try {
    const absoluteTargetPath = resolve(input.projectDir, input.targetFile)
    const source = readFileSync(absoluteTargetPath, "utf8")
    const inspectedFile = relative(input.projectDir, absoluteTargetPath) || "."
    const findings = observeJavaFile(input.projectDir, absoluteTargetPath, source)
    writeObserverReportOnlyEvidence(input.projectDir, {
      hook: "tool.execute.after",
      sessionID: input.sessionID,
      callID: input.callID,
      targetFile: input.targetFile,
      inspectedFile,
      findings,
      limitations: OBSERVER_LIMITATIONS,
    }, {
      evidenceDir: input.evidenceDir,
    })
    if (input.output !== undefined) {
      appendObserverFindingsToToolOutput(input.output, findings, inspectedFile)
    }
  } catch (error) {
    const detail = input.targetFile
    if (error instanceof Error) {
      warnRuntimeFailure("observer-report-only", "observer-report-only", detail, error)
      return
    }
    warnRuntimeFailure("observer-report-only", "observer-report-only", detail, new Error(String(error)))
  }
}

/**
 * Runs the AST conventions against the single file that was just written.
 * The CLI `observe` surface already reports these; without this the runtime hook
 * saw only the text-based observers, so the higher-precision AST findings never
 * reached the agent. The scan is scoped to one file so its cost does not grow
 * with the project, and it is skipped entirely when ast-grep is unavailable.
 */
function observeAstGrepConventions(
  projectDir: string,
  filePath: string,
  relativePath: string,
): readonly ObserverReportOnlyFinding[] {
  if (findAstGrepBinary() === undefined) {
    return []
  }
  const findings: ObserverReportOnlyFinding[] = []
  for (const definition of loadAstGrepConventionDefinitions(projectDir)) {
    const result = runAstGrepConvention(projectDir, definition, { scanPath: filePath })
    if (result.status !== "checked" || result.findings.length === 0) {
      continue
    }
    findings.push({
      ruleId: definition.id,
      result: "WARN",
      evidence: { matches: result.findings.map((match) => `line ${match.line}: ${match.message}`) },
      // AST conventions match a concrete syntax node rather than a text
      // heuristic, so a match is a high-confidence observation.
      confidence: definition.highPrecision ? "HIGH" : "MEDIUM",
      source: "live-hook/text",
      limitations: [AST_CONVENTION_LIMITATION],
      filePath: relativePath,
    })
  }
  return findings
}

/**
 * Surfaces actionable observer findings in the tool output the agent reads.
 * Only HIGH-confidence WARN findings backed by concrete evidence are appended;
 * every finding is still written to the evidence store regardless of this.
 */
export function appendObserverFindingsToToolOutput(
  output: ObserverToolOutput,
  findings: readonly ObserverReportOnlyFinding[],
  inspectedFile: string,
): void {
  if (typeof output.output !== "string" || output.output.includes(OBSERVER_OUTPUT_MARKER)) {
    return
  }
  const block = formatObserverFindingsBlock(findings, inspectedFile)
  if (block === undefined) {
    return
  }
  output.output = `${output.output}\n\n---\n\n${block}`
}

export function formatObserverFindingsBlock(
  findings: readonly ObserverReportOnlyFinding[],
  inspectedFile: string,
): string | undefined {
  const actionable = findings.filter(isActionableFinding)
  if (actionable.length === 0) {
    return undefined
  }

  const lines: string[] = []
  let used = 0
  let truncated = false
  for (const finding of actionable) {
    const line = truncateTo(`- ${finding.ruleId}: ${summarizeEvidence(finding.evidence)}`, OBSERVER_LINE_BUDGET)
    if (lines.length > 0 && used + line.length > OBSERVER_OUTPUT_BUDGET) {
      truncated = true
      break
    }
    lines.push(line)
    used += line.length + 1
  }

  return [
    `${OBSERVER_OUTPUT_MARKER} ${inspectedFile}`,
    "",
    ...lines,
    ...(truncated ? [OBSERVER_OUTPUT_TRUNCATION] : []),
    "",
    OBSERVER_OUTPUT_FOOTER,
  ].join("\n")
}

function isActionableFinding(finding: ObserverReportOnlyFinding): boolean {
  return finding.result === "WARN" && finding.confidence === "HIGH" && summarizeEvidence(finding.evidence).length > 0
}

/**
 * Flattens the observer evidence shape into the concrete source spans that make
 * a finding checkable. Findings whose evidence carries no span are not
 * actionable and are filtered out by {@link isActionableFinding}.
 */
function summarizeEvidence(evidence: unknown): string {
  if (typeof evidence === "string") {
    return evidence.trim()
  }
  if (!isPlainRecord(evidence)) {
    return ""
  }
  const spans: string[] = []
  for (const value of Object.values(evidence)) {
    if (typeof value === "string" && value.trim().length > 0) {
      spans.push(value.trim())
      continue
    }
    if (!Array.isArray(value)) {
      continue
    }
    for (const item of value) {
      if (typeof item === "string" && item.trim().length > 0) {
        spans.push(item.trim())
      }
    }
  }
  return spans.join(" | ")
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function truncateTo(value: string, budget: number): string {
  return value.length <= budget ? value : `${value.slice(0, Math.max(0, budget - 1))}…`
}

function isJavaWriteOrEditTool(tool: string): boolean {
  const normalizedTool = tool.toLowerCase()
  return (
    normalizedTool === "write" ||
    normalizedTool === "edit" ||
    normalizedTool === "patch" ||
    normalizedTool === "multiedit" ||
    normalizedTool === "multi_edit" ||
    normalizedTool.includes("write") ||
    normalizedTool.includes("edit")
  )
}

function observeJavaFile(projectDir: string, filePath: string, source: string): readonly ObserverReportOnlyFinding[] {
  const relativePath = relative(projectDir, filePath)
  const findings: ObserverReportOnlyFinding[] = []
  if (filePath.endsWith("Controller.java")) {
    findings.push(
      normalizeObservation(
        "controller.service-dependency",
        relativePath,
        observeControllerServiceDependency({ filePath, source }),
      ),
      normalizeObservation(
        CONTROLLER_REPOSITORY_CONVENTION.id,
        relativePath,
        observeControllerRepositoryDependency({ filePath, source }),
      ),
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
  findings.push(...observeAstGrepConventions(projectDir, filePath, relativePath))
  if (findings.length === 0) {
    findings.push({
      ruleId: "java-file.applicability",
      result: "UNKNOWN",
      evidence: {},
      confidence: "NONE",
      source: "live-hook/text",
      limitations: ["No report-only observer applies to this Java file role."],
      filePath: relativePath,
    })
  }
  return findings
}

function normalizeObservation(
  ruleId: string,
  filePath: string,
  observation: ObserverObservation,
): ObserverReportOnlyFinding {
  const isInfo = observation.finding === "INFO"
  return {
    ruleId,
    result: normalizeFindingResult(observation.finding),
    evidence: observation.evidence,
    confidence: observationConfidence(observation),
    source: "live-hook/text",
    limitations: isInfo ? [...observation.limitations, INFO_NORMALIZATION_LIMITATION] : observation.limitations,
    filePath,
  }
}

function normalizeFindingResult(finding: ObserverObservation["finding"]): ObserverReportOnlyFinding["result"] {
  return finding === "INFO" ? "UNKNOWN" : finding
}

function observationConfidence(observation: ObserverObservation): ObserverReportOnlyFinding["confidence"] {
  return "confidence" in observation && observation.confidence !== undefined ? observation.confidence : "NONE"
}
