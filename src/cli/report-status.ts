import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { writeFileAtomic } from "../io/atomic-file.js"
import { replaceWorkflowReportStatusText } from "../runtime/workflow-report-status.js"
import { IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH, type PlanOptions } from "./plan.js"

export type WorkflowReportKind = "implementation" | "review"
export type WorkflowReportStatus = "filled"

export type WorkflowReportStatusResult = {
  readonly reportPath: string
  readonly relativePath: string
  readonly status: WorkflowReportStatus
}

export class WorkflowReportStatusError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "WorkflowReportStatusError"
  }
}

function reportPathForKind(kind: WorkflowReportKind): string {
  if (kind === "implementation") {
    return IMPLEMENTATION_REPORT_PATH
  }
  return REVIEW_REPORT_PATH
}

export function parseWorkflowReportKind(value: string | undefined): WorkflowReportKind | undefined {
  if (value === "implementation") {
    return value
  }
  if (value === "review") {
    return value
  }
  return undefined
}

export function updateWorkflowReportStatus(
  kind: WorkflowReportKind,
  status: WorkflowReportStatus,
  options: PlanOptions = {},
): WorkflowReportStatusResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const relativePath = reportPathForKind(kind)
  const reportPath = join(projectDir, relativePath)
  if (!existsSync(reportPath)) {
    throw new WorkflowReportStatusError(`No ${kind} report found. Run npx ph plan first.`)
  }

  const reportText = readFileSync(reportPath, "utf8")
  const updatedReportText = replaceWorkflowReportStatusText(reportText, status)
  if (updatedReportText === undefined) {
    throw new WorkflowReportStatusError(`No Status line found in ${relativePath}.`)
  }

  writeFileAtomic(reportPath, updatedReportText)
  return { reportPath, relativePath, status }
}
