import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { AtomicWriteConflictError, readTextFileSnapshot, writeFileAtomicIfUnchanged } from "../io/atomic-file.js"
import {
  parseWorkflowReportStatusDetail,
  replaceWorkflowReportStatusText,
} from "../runtime/workflow-report-status.js"
import { IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH, type PlanOptions } from "./plan.js"
import { hasSubstantiveWorkflowReportContent } from "./workflow-report-coverage.js"
import { beforeWorkflowStateWrite, toWorkflowStateConflict } from "./workflow-state-conflict.js"

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

const MAX_SUBMITTED_REPORT_BYTES = 64 * 1024

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

  const snapshot = readTextFileSnapshot(reportPath)
  const updatedReportText = replaceWorkflowReportStatusText(snapshot.text, status)
  if (updatedReportText === undefined) {
    throw new WorkflowReportStatusError(`No Status line found in ${relativePath}.`)
  }
  validateWorkflowReportContent(kind, relativePath, snapshot.text)

  beforeWorkflowStateWrite(options, reportPath)
  try {
    writeFileAtomicIfUnchanged(snapshot, updatedReportText)
  } catch (error) {
    if (error instanceof AtomicWriteConflictError) {
      throw toWorkflowStateConflict(error, projectDir)
    }
    throw error
  }
  return { reportPath, relativePath, status }
}

export function submitWorkflowReport(
  kind: WorkflowReportKind,
  submittedText: string,
  options: PlanOptions = {},
): WorkflowReportStatusResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const relativePath = reportPathForKind(kind)
  const reportPath = join(projectDir, relativePath)
  if (!existsSync(reportPath)) {
    throw new WorkflowReportStatusError(`No ${kind} report found. Run npx ph plan first.`)
  }
  if (submittedText.trim() === "") {
    throw new WorkflowReportStatusError("Workflow report stdin is empty.")
  }
  if (Buffer.byteLength(submittedText, "utf8") > MAX_SUBMITTED_REPORT_BYTES) {
    throw new WorkflowReportStatusError(`Workflow report stdin exceeds the ${MAX_SUBMITTED_REPORT_BYTES}-byte limit.`)
  }
  if (hasUnsafeControlCharacter(submittedText)) {
    throw new WorkflowReportStatusError("Workflow report stdin contains unsupported control characters.")
  }

  const snapshot = readTextFileSnapshot(reportPath)
  if (parseWorkflowReportStatusDetail(snapshot.text).status !== "template") {
    throw new WorkflowReportStatusError(`Cannot replace ${relativePath} after it has left template status.`)
  }
  if (parseWorkflowReportStatusDetail(submittedText).status !== "filled") {
    throw new WorkflowReportStatusError("Workflow report stdin must declare exactly one filled Status value.")
  }

  const normalizedText = submittedText.replace(/\r\n/gu, "\n").replace(/\r/gu, "\n").replace(/\n?$/u, "\n")
  validateWorkflowReportContent(kind, relativePath, normalizedText)

  beforeWorkflowStateWrite(options, reportPath)
  try {
    writeFileAtomicIfUnchanged(snapshot, normalizedText)
  } catch (error) {
    if (error instanceof AtomicWriteConflictError) {
      throw toWorkflowStateConflict(error, projectDir)
    }
    throw error
  }
  return { reportPath, relativePath, status: "filled" }
}

function hasUnsafeControlCharacter(value: string): boolean {
  return /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(value)
}

function validateWorkflowReportContent(
  kind: WorkflowReportKind,
  relativePath: string,
  reportText: string,
): void {
  if (hasSubstantiveWorkflowReportContent(kind, reportText)) {
    return
  }
  throw new WorkflowReportStatusError(
    [
      `Cannot mark ${relativePath} filled because required substantive ${kind} report content is still template-like or incomplete.`,
      `Next action: complete the required ${kind} report content, then run npx ph plan --report-filled ${kind}.`,
    ].join("\n"),
  )
}
