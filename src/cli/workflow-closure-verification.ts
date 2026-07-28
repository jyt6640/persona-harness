import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { loadHarnessConfig, loadHarnessConfigResult } from "../config/harness-config.js"
import {
  runCapabilityBoundClosureVerification,
  runDirectClosureVerification,
} from "./closure-verification-runner.js"
import {
  hasVerificationCommandMention,
  hasVerificationSuccessText,
  readExecutionEvidenceVerification,
} from "./workflow-execution-evidence.js"
import { readVerificationFailure } from "./verification-failure.js"
import { readWorkflowReportStatus } from "../runtime/workflow-report-status.js"
import type { ProjectReadBoundary } from "../io/bootstrap-write-boundary.js"
import type { ProjectReadSnapshot } from "../io/project-read-snapshot.js"

export type ClosureVerification = "failed" | "not-run" | "passed" | "unknown"

export type ClosureVerificationSummary = {
  readonly evidenceRef?: string
  readonly reason: string
  readonly verification: ClosureVerification
}

const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"

export function readClosureVerification(
  projectDir: string,
  boundary?: ProjectReadBoundary,
  snapshot?: ProjectReadSnapshot,
): ClosureVerificationSummary {
  const configResult = loadHarnessConfigResult(projectDir, boundary)
  if (!configResult.safe) {
    return {
      evidenceRef: ".persona/harness.jsonc",
      reason: "harness configuration is invalid; read-only recovery is required",
      verification: "unknown",
    }
  }
  const config = loadHarnessConfig(projectDir, boundary)
  if (config.enforce.executeVerification) {
    if (snapshot !== undefined && boundary !== undefined) {
      return runCapabilityBoundClosureVerification(projectDir, boundary)
    }
    return runDirectClosureVerification(projectDir)
  }

  const verificationFailure = readVerificationFailure(
    projectDir,
    readWorkflowReportStatus(projectDir, IMPLEMENTATION_REPORT_PATH, snapshot),
    snapshot,
  )
  if (verificationFailure.verificationFailureBlocking) {
    return { reason: verificationFailure.verificationFailure, verification: "failed" }
  }

  const reportText = readWorkflowReportText(projectDir, snapshot)
  const execution = readExecutionEvidenceVerification(projectDir, boundary, snapshot)
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

function readWorkflowReportText(projectDir: string, snapshot?: ProjectReadSnapshot): string {
  if (snapshot !== undefined) {
    return [IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH]
      .map((path) => snapshot.readText(path))
      .filter((text): text is string => text !== undefined)
      .join("\n")
  }
  return [IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH]
    .map((path) => join(projectDir, path))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")
}
