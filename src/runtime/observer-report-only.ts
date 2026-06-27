import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

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
  readonly projectDir: string
  readonly tool: string
  readonly sessionID: string
  readonly callID?: string
  readonly targetFile?: string
}

type ObserverObservation =
  | ControllerRepositoryObservation
  | ControllerServiceObservation
  | ControllerSqlObservation
  | DtoBoundaryObservation
  | ServiceStorageObservation
  | TestContractObservation

const INFO_NORMALIZATION_LIMITATION = "INFO observation normalized to UNKNOWN because ph observe schema is PASS/WARN/UNKNOWN."
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
    writeObserverReportOnlyEvidence(input.projectDir, {
      hook: "tool.execute.after",
      sessionID: input.sessionID,
      callID: input.callID,
      targetFile: input.targetFile,
      inspectedFile,
      findings: observeJavaFile(input.projectDir, absoluteTargetPath, source),
      limitations: OBSERVER_LIMITATIONS,
    })
  } catch (error) {
    const detail = input.targetFile
    if (error instanceof Error) {
      warnRuntimeFailure("observer-report-only", "observer-report-only", detail, error)
      return
    }
    warnRuntimeFailure("observer-report-only", "observer-report-only", detail, new Error(String(error)))
  }
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
        "controller.repository-dependency",
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
