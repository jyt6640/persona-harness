import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import {
  hasVerificationCommandMention,
  hasVerificationSuccessText,
  readExecutionEvidenceVerification,
} from "./workflow-execution-evidence.js"
import type { WorkflowStatusSummary } from "./workflow-status.js"

export type ClosureVerification = "failed" | "not-run" | "passed" | "unknown"

export type ClosureVerificationSummary = {
  readonly evidenceRef?: string
  readonly reason: string
  readonly verification: ClosureVerification
}

const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"

export function readClosureVerification(projectDir: string, summary: WorkflowStatusSummary): ClosureVerificationSummary {
  if (summary.verificationFailureBlocking) {
    return { reason: summary.verificationFailure, verification: "failed" }
  }

  const reportText = readWorkflowReportText(projectDir)
  const execution = readExecutionEvidenceVerification(projectDir)
  if (execution.verification === "failed" || execution.verification === "passed") {
    return { evidenceRef: execution.evidenceRef, reason: execution.reason, verification: execution.verification }
  }
  if (reportText.length === 0 && !execution.observed) {
    return { reason: "no verification evidence observed", verification: "not-run" }
  }
  if (hasVerificationSuccessText(reportText)) {
    return {
      evidenceRef: execution.evidenceRef,
      reason: "workflow reports claim verification success, but no structured execution evidence was found",
      verification: "unknown",
    }
  }
  if (hasVerificationCommandMention(reportText) || execution.observed) {
    return { evidenceRef: execution.evidenceRef, reason: execution.reason, verification: "unknown" }
  }
  return { evidenceRef: execution.evidenceRef, reason: "verification evidence is present but inconclusive", verification: "unknown" }
}

function readWorkflowReportText(projectDir: string): string {
  return [IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH]
    .map((path) => join(projectDir, path))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")
}
