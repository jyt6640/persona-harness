import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

export type WorkflowReportCoverageFinding = "PASS" | "WARN"

export type WorkflowReportCoverageSummary = {
  readonly reportCoverage: string
  readonly reportCoverageBlocking: boolean
  readonly reportCoverageFinding: WorkflowReportCoverageFinding
}

export type WorkflowReportCoverageInputs = {
  readonly projectDir: string
  readonly implementationStatus: string
  readonly reviewStatus: string
  readonly readCoverageBlocking: boolean
  readonly profileReadCoverageBlocking: boolean
  readonly javaRoleReadCoverageBlocking: boolean
}

const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const BLANK_REQUIRED_REPORT_FIELD_PATTERN =
  /^-\s*(?:README ranges read|Project profile ranges read|Profile ranges read|Java role files read|Read evidence notes):\s*$/im
const UNCHECKED_CHECKLIST_PATTERN = /^-\s*\[\s\]\s+.+$/gm
const CHECKED_CHECKLIST_PATTERN = /^-\s*\[[xX]\]\s+.+$/m
const COMPLETED_BEAR_SHELL_PATTERN = /^-\s*(?!\[\s*\])(?:\[[xX]\]\s*)?.*\bnpx ph bearshell\b/im
const IMPLEMENTATION_READ_EVIDENCE_PATTERN =
  /^-\s*(?:README ranges read|Project profile ranges read|Profile ranges read|Plan ranges read):\s*\S/im
const REVIEW_EVIDENCE_PATTERN =
  /^-\s*(?!\[\s*\])(?:\[[xX]\]\s*)?.*\b(?:requirements?|boundary|manual QA|reviewed)\b/im

function uncheckedChecklistCount(reportText: string): number {
  return [...reportText.matchAll(UNCHECKED_CHECKLIST_PATTERN)].length
}

export function isWorkflowReportTemplateLike(reportText: string): boolean {
  return BLANK_REQUIRED_REPORT_FIELD_PATTERN.test(reportText)
    || (uncheckedChecklistCount(reportText) >= 3 && !CHECKED_CHECKLIST_PATTERN.test(reportText))
}

export function hasSubstantiveWorkflowReportContent(
  kind: "implementation" | "review",
  reportText: string,
): boolean {
  if (isWorkflowReportTemplateLike(reportText)) {
    return false
  }
  if (kind === "implementation") {
    return IMPLEMENTATION_READ_EVIDENCE_PATTERN.test(reportText) && COMPLETED_BEAR_SHELL_PATTERN.test(reportText)
  }
  return REVIEW_EVIDENCE_PATTERN.test(reportText) && COMPLETED_BEAR_SHELL_PATTERN.test(reportText)
}

export function readWorkflowReportCoverage(inputs: WorkflowReportCoverageInputs): WorkflowReportCoverageSummary {
  if (inputs.implementationStatus !== "filled") {
    return {
      reportCoverage: "not checked until implementation report is filled",
      reportCoverageBlocking: false,
      reportCoverageFinding: "PASS",
    }
  }

  const reviewReportPath = join(inputs.projectDir, REVIEW_REPORT_PATH)
  const reviewText = existsSync(reviewReportPath) ? readFileSync(reviewReportPath, "utf8") : ""
  const issues = [
    ...(inputs.readCoverageBlocking ? ["README coverage missing"] : []),
    ...(inputs.profileReadCoverageBlocking ? ["profile read coverage missing"] : []),
    ...(inputs.javaRoleReadCoverageBlocking ? ["Java role read coverage missing"] : []),
    ...(inputs.reviewStatus === "filled" && isWorkflowReportTemplateLike(reviewText) ? ["review report checklist template-like"] : []),
  ]
  if (issues.length === 0) {
    return {
      reportCoverage: "filled reports include required coverage/checklist evidence",
      reportCoverageBlocking: false,
      reportCoverageFinding: "PASS",
    }
  }
  return {
    reportCoverage: `reports say filled but required coverage is missing: ${issues.join(", ")}`,
    reportCoverageBlocking: true,
    reportCoverageFinding: "WARN",
  }
}
