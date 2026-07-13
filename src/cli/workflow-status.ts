import { existsSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import { findConventionByBlockerId } from "../config/convention-registry.js"
import { loadHarnessConfigResult, resolveConfiguredPathResult, resolveSafeEvidenceRootResult } from "../config/harness-config.js"
import { walkBoundedFiles, type BoundedWalkResult } from "../io/bounded-path-walker.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"
import { readWorkflowReportStatus } from "../runtime/workflow-report-status.js"
import { readArchitectureConventions, type ArchitectureConventionBlocker, type ArchitectureConventionSummary } from "./architecture-conventions.js"
import { backendShapeReportStatus } from "./backend-shape-report-status.js"
import { readJavaRoleReadCoverage, type JavaRoleReadCoverageSummary } from "./java-role-read-coverage.js"
import { personaHarnessSelfProfileGuidance } from "./self-profile-guidance.js"
import { readWorkflowReportCoverage, type WorkflowReportCoverageSummary } from "./workflow-report-coverage.js"
import { readStackAlignment, type StackAlignmentSummary } from "./stack-alignment.js"
import { readVerificationFailure, type VerificationFailureSummary } from "./verification-failure.js"
import { POST_BUILD_CLOSURE_NEXT_ACTION } from "./workflow-closure-rail.js"
import {
  formatPendingWorkflowTicketStatusLines,
  workflowPendingTicketStatus,
  type WorkflowPendingTicket,
} from "./workflow-ticket-summary.js"

export type WorkflowStatusSummary = {
  readonly projectDir: string
  readonly finding: "PASS" | "WARN"
  readonly plan: string
  readonly implementation: string
  readonly review: string
  readonly evidence: "present" | "missing"
  readonly readCoverage: string
  readonly readCoverageBlocking: boolean
  readonly readCoverageFinding: "PASS" | "WARN"
  readonly profileReadCoverage: string
  readonly profileReadCoverageBlocking: boolean
  readonly profileReadCoverageFinding: "PASS" | "WARN"
  readonly javaRoleReadCoverage: string
  readonly javaRoleReadCoverageBlocking: boolean
  readonly javaRoleReadCoverageFinding: "PASS" | "WARN"
  readonly reportCoverage: string
  readonly reportCoverageBlocking: boolean
  readonly reportCoverageFinding: "PASS" | "WARN"
  readonly commandDiscipline: string
  readonly commandDisciplineBlocking: boolean
  readonly commandDisciplineFinding: "PASS" | "WARN"
  readonly verificationFailure: string
  readonly verificationFailureBlocking: boolean
  readonly verificationFailureFinding: "PASS" | "WARN"
  readonly stackAlignment: string
  readonly stackAlignmentBlocking: boolean
  readonly stackAlignmentFinding: "PASS" | "WARN"
  readonly architectureConventions: string
  readonly architectureConventionBlockers: readonly ArchitectureConventionBlocker[]
  readonly architectureConventionsBlocking: boolean
  readonly architectureConventionsFinding: "PASS" | "WARN"
  readonly pendingTickets: readonly WorkflowPendingTicket[]
  readonly pendingTicketsFinding: "PASS" | "WARN"
  readonly next: string
}

const PLAN_PATH = ".persona/workflow/plan.md"
const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const README_PATH = "README.md"
const PROFILE_PATH = ".persona/project-profile.jsonc"

function readStatusLine(filePath: string): string {
  if (!existsSync(filePath)) {
    return "missing"
  }
  const match = readFileSync(filePath, "utf8").split(/\r?\n/).map((line) => line.trim()).find((line) =>
    /^Status:\s*(.+)$/i.test(line)
    || /^[-*]\s*(?:\*\*)?Status(?:\*\*)?:\s*(.+)$/i.test(line)
    || /^(?:\*\*)?Status(?:\*\*)?:\s*(.+)$/i.test(line)
  )
  if (match === undefined) {
    return "unknown"
  }
  const value =
    /^Status:\s*(.+)$/i.exec(match)?.[1]
    ?? /^[-*]\s*(?:\*\*)?Status(?:\*\*)?:\s*(.+)$/i.exec(match)?.[1]
    ?? /^(?:\*\*)?Status(?:\*\*)?:\s*(.+)$/i.exec(match)?.[1]
  return value?.replace(/\*\*/g, "").trim() ?? "unknown"
}

function stackAlignment(projectDir: string, implementationStatus: string): StackAlignmentSummary {
  const profileState = readBackendProjectProfileState(projectDir)
  if (profileState.status !== "ready") {
    return {
      stackAlignment: "not checked until backend project profile is ready",
      stackAlignmentBlocking: false,
      stackAlignmentFinding: "PASS",
    }
  }
  return readStackAlignment(projectDir, implementationStatus)
}

function readExistingFiles(filePaths: readonly string[]): string {
  return filePaths.filter((filePath) => existsSync(filePath)).map((filePath) => readFileSync(filePath, "utf8")).join("\n")
}

function hasEvidenceTarget(
  evidence: BoundedWalkResult,
  targetPattern: RegExp,
): boolean {
  return evidence.files.some((file) =>
    targetPattern.test(file.relativePath.toLowerCase())
    || (file.text !== undefined && targetPattern.test(file.text)),
  )
}

const RAW_SHELL_PATTERN = /raw shell|직접\s*썼|직접\s*사용|raw\s+command/i
const DIRECT_RULES_READ_PATTERN = /(?:read|읽)[^\n]*(?:\.persona\/rules|\.persona\\rules)|\.persona\/rules\/|\.persona\\rules\\/i
const FINAL_VERIFICATION_PATTERN = /(?:\.\/)?gradlew?\s+(?:test|build|bootRun)\b|gradle\s+(?:test|build|bootRun)\b|bootRun\b|curl\b/i
const RAW_FINAL_VERIFICATION_PATTERN = /(?:raw shell|직접\s*썼|직접\s*사용|raw\s+command)[^\n]*(?:final verification|최종\s*검증)|(?:final verification|최종\s*검증)[^\n]*(?:raw shell|직접\s*썼|직접\s*사용|raw\s+command)/i
const RAW_WITHOUT_BEARSHELL_PATTERN = /(?:raw shell|직접\s*썼|직접\s*사용|raw\s+command)[^\n]*(?:bearshell)[^\n]*(?:not provided|not used|없|않|못|미사용|제공되지)/i
const FINAL_VERIFICATION_RERUN_PATTERN = /(?:final verification|최종\s*검증)[^\n]*(?:rerun|re-run|다시\s*실행|재실행|다시\s*검증)[^\n]*(?:bearshell|npx\s+ph\s+bearshell)|(?:final verification|최종\s*검증)[^\n]*(?:bearshell|npx\s+ph\s+bearshell)[^\n]*(?:rerun|re-run|다시\s*실행|재실행|다시\s*검증)|(?:bearshell|npx\s+ph\s+bearshell)[^\n]*(?:rerun|re-run|다시\s*실행|재실행|다시\s*검증)[^\n]*(?:final verification|최종\s*검증)/i
const RAW_SHELL_TEMPLATE_CHECKLIST_PATTERN = /raw shell을 직접 썼다면|if raw shell/i

type CommandDisciplineSummary = Pick<WorkflowStatusSummary, "commandDiscipline" | "commandDisciplineBlocking" | "commandDisciplineFinding">
type WorkflowVerificationFailureSummary = VerificationFailureSummary
type ReadCoverageSummary = Pick<WorkflowStatusSummary, "readCoverage" | "readCoverageBlocking" | "readCoverageFinding">
type ProfileReadCoverageSummary = Pick<WorkflowStatusSummary, "profileReadCoverage" | "profileReadCoverageBlocking" | "profileReadCoverageFinding">

const README_RANGES_FIELD_PATTERN = /^-\s*README ranges read:\s*(.*)$/i
const README_RANGES_HEADING_PATTERN = /^##+\s*README ranges read:?\s*$/i
const PROFILE_RANGES_FIELD_PATTERN = /^-\s*(?:Project profile|Profile)\s+ranges read:\s*(.*)$/i
const PROFILE_RANGES_HEADING_PATTERN = /^##+\s*(?:Project profile|Profile)\s+ranges read:?\s*$/i
const READ_COVERAGE_STOP_PATTERN = /^-\s*(?:Plan read method|Plan ranges read|Unread ranges|Read evidence notes):/i
const PROFILE_COVERAGE_STOP_PATTERN = /^-\s*(?:README read method|README ranges read|Plan read method|Plan ranges read|Unread ranges|Read evidence notes):/i
const RANGE_COVERAGE_PATTERN = /\b\d+\s*[-–]\s*\d+\b|\ball\b|\bcomplete\b|전체|끝까지|완독/i

function hasRangeCoverage(reportText: string, fieldPattern: RegExp, headingPattern: RegExp, stopPattern: RegExp): boolean {
  const lines = reportText.split(/\r?\n/)
  const fieldIndex = lines.findIndex((line) => fieldPattern.test(line))
  if (fieldIndex !== -1) {
    const fieldMatch = fieldPattern.exec(lines[fieldIndex])
    if (fieldMatch?.[1] !== undefined && RANGE_COVERAGE_PATTERN.test(fieldMatch[1])) {
      return true
    }

    for (const line of lines.slice(fieldIndex + 1)) {
      if (/^##\s+/.test(line) || stopPattern.test(line)) {
        return false
      }
      if (RANGE_COVERAGE_PATTERN.test(line)) {
        return true
      }
    }
  }

  const headingIndex = lines.findIndex((line) => headingPattern.test(line))
  if (headingIndex === -1) {
    return false
  }
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^##\s+/.test(line)) {
      return false
    }
    if (RANGE_COVERAGE_PATTERN.test(line)) {
      return true
    }
  }
  return false
}

function hasReadmeRangeCoverage(reportText: string): boolean {
  return hasRangeCoverage(reportText, README_RANGES_FIELD_PATTERN, README_RANGES_HEADING_PATTERN, READ_COVERAGE_STOP_PATTERN)
}

function hasProjectProfileRangeCoverage(reportText: string): boolean {
  return hasRangeCoverage(reportText, PROFILE_RANGES_FIELD_PATTERN, PROFILE_RANGES_HEADING_PATTERN, PROFILE_COVERAGE_STOP_PATTERN)
}

function readCoverage(
  projectDir: string,
  implementationStatus: string,
  evidence: BoundedWalkResult,
): ReadCoverageSummary {
  if (implementationStatus !== "filled") {
    return {
      readCoverage: "not checked until implementation report is filled",
      readCoverageBlocking: false,
      readCoverageFinding: "PASS",
    }
  }
  if (!evidence.safe) {
    return {
      readCoverage: "configured evidence traversal is unsafe; read-only recovery is required",
      readCoverageBlocking: true,
      readCoverageFinding: "WARN",
    }
  }
  if (!existsSync(join(projectDir, README_PATH))) {
    return {
      readCoverage: "README.md missing; range coverage not required",
      readCoverageBlocking: false,
      readCoverageFinding: "PASS",
    }
  }

  const implementationReportPath = join(projectDir, IMPLEMENTATION_REPORT_PATH)
  const reportText = existsSync(implementationReportPath) ? readFileSync(implementationReportPath, "utf8") : ""
  if (hasReadmeRangeCoverage(reportText)) {
    return {
      readCoverage: "README ranges observed",
      readCoverageBlocking: false,
      readCoverageFinding: "PASS",
    }
  }
  if (hasEvidenceTarget(evidence, /["/\\]README\.md["/\\]?|README\.md/i)) {
    return {
      readCoverage: "README read evidence observed",
      readCoverageBlocking: false,
      readCoverageFinding: "PASS",
    }
  }
  return {
    readCoverage: "README.md exists but README ranges read is empty",
    readCoverageBlocking: true,
    readCoverageFinding: "WARN",
  }
}

function profileReadCoverage(
  projectDir: string,
  implementationStatus: string,
  evidence: BoundedWalkResult,
): ProfileReadCoverageSummary {
  if (implementationStatus !== "filled") {
    return {
      profileReadCoverage: "not checked until implementation report is filled",
      profileReadCoverageBlocking: false,
      profileReadCoverageFinding: "PASS",
    }
  }
  if (!evidence.safe) {
    return {
      profileReadCoverage: "configured evidence traversal is unsafe; read-only recovery is required",
      profileReadCoverageBlocking: true,
      profileReadCoverageFinding: "WARN",
    }
  }
  const profileState = readBackendProjectProfileState(projectDir)
  if (profileState.status !== "ready") {
    return {
      profileReadCoverage: "not checked until backend project profile is ready",
      profileReadCoverageBlocking: false,
      profileReadCoverageFinding: "PASS",
    }
  }

  const implementationReportPath = join(projectDir, IMPLEMENTATION_REPORT_PATH)
  const reportText = existsSync(implementationReportPath) ? readFileSync(implementationReportPath, "utf8") : ""
  if (hasProjectProfileRangeCoverage(reportText)) {
    return {
      profileReadCoverage: "project profile ranges observed",
      profileReadCoverageBlocking: false,
      profileReadCoverageFinding: "PASS",
    }
  }
  if (hasEvidenceTarget(evidence, /["/\\]project-profile\.jsonc["/\\]?|project-profile\.jsonc/i)) {
    return {
      profileReadCoverage: "project profile read evidence observed",
      profileReadCoverageBlocking: false,
      profileReadCoverageFinding: "PASS",
    }
  }
  return {
    profileReadCoverage: "project profile exists but profile read coverage is empty",
    profileReadCoverageBlocking: true,
    profileReadCoverageFinding: "WARN",
  }
}

function commandDiscipline(projectDir: string, implementationStatus: string, reviewStatus: string): CommandDisciplineSummary {
  if (implementationStatus !== "filled") {
    return {
      commandDiscipline: "not checked until implementation report is filled",
      commandDisciplineBlocking: false,
      commandDisciplineFinding: "PASS",
    }
  }
  const reportText = readExistingFiles([
    join(projectDir, IMPLEMENTATION_REPORT_PATH),
    join(projectDir, REVIEW_REPORT_PATH),
  ])
  const hasBearshell = reportText.includes("npx ph bearshell")
  const hasRawShell = RAW_SHELL_PATTERN.test(reportText)
  const hasDirectRulesRead = DIRECT_RULES_READ_PATTERN.test(reportText)
  const lines = reportText.split(/\r?\n/)
  const hasFinalVerification = lines.some((line) => FINAL_VERIFICATION_PATTERN.test(line))
  const hasFinalVerificationRerun = lines.some((line) => FINAL_VERIFICATION_RERUN_PATTERN.test(line))
  const hasRawWithoutBearshell = lines.some((line) =>
    !RAW_SHELL_TEMPLATE_CHECKLIST_PATTERN.test(line)
    && !FINAL_VERIFICATION_RERUN_PATTERN.test(line)
    && RAW_WITHOUT_BEARSHELL_PATTERN.test(line)
  )
  const hasRawFinalVerification = !hasFinalVerificationRerun && lines.some((line) =>
    !RAW_SHELL_TEMPLATE_CHECKLIST_PATTERN.test(line)
    && !FINAL_VERIFICATION_RERUN_PATTERN.test(line)
    && (
      RAW_FINAL_VERIFICATION_PATTERN.test(line)
      || (!line.includes("npx ph bearshell") && RAW_SHELL_PATTERN.test(line) && FINAL_VERIFICATION_PATTERN.test(line))
    )
  ) || (!hasFinalVerificationRerun && hasRawWithoutBearshell && hasFinalVerification)
  if (hasRawFinalVerification) {
    return {
      commandDiscipline: "raw shell used for final verification; rerun test/build/bootRun through `npx ph bearshell`",
      commandDisciplineBlocking: true,
      commandDisciplineFinding: "WARN",
    }
  }
  if (hasBearshell) {
    const warnings = [
      ...(hasRawShell ? ["non-blocking raw shell environment probe observed; final verification is acceptable only when rerun through `npx ph bearshell`"] : []),
    ]
    const notes = [
      ...(hasDirectRulesRead ? ["direct `.persona/rules` read observed"] : []),
    ]
    const details = [
      ...warnings.map((warning) => `warning: ${warning}`),
      ...notes.map((note) => `note: ${note}`),
    ]
    return {
      commandDiscipline: details.length > 0 ? `bearshell observed; ${details.join("; ")}` : "bearshell observed",
      commandDisciplineBlocking: false,
      commandDisciplineFinding: warnings.length > 0 ? "WARN" : "PASS",
    }
  }
  if (reviewStatus === "filled") {
    return {
      commandDiscipline: "final verification through `npx ph bearshell` not observed in filled workflow reports",
      commandDisciplineBlocking: true,
      commandDisciplineFinding: "WARN",
    }
  }
  return {
    commandDiscipline: "not checked until review report is filled",
    commandDisciplineBlocking: false,
    commandDisciplineFinding: "PASS",
  }
}

function nextAction(summary: Omit<WorkflowStatusSummary, "finding" | "next">): string {
  if (summary.plan === "missing") return "run `npx ph plan`"
  if (summary.plan !== "accepted") {
    return "review plan, then run `npx ph plan --accept` or `npx ph plan --revise`"
  }
  if (summary.implementation !== "filled") {
    return summary.pendingTickets.length > 0 ? POST_BUILD_CLOSURE_NEXT_ACTION : "run `npx ph workflow implement`, implement, fill implementation report, then run `npx ph plan --report-filled implementation`"
  }
  if (summary.verificationFailureBlocking) return "fix compile/test failure, rerun `./gradlew test` or `gradlew.bat test`, then run `npx ph workflow check`"
  if (summary.review !== "filled") return "fill review report and run `npx ph plan --report-filled review`"
  if (summary.commandDisciplineBlocking) return "rerun final verification through `npx ph bearshell`"
  if (summary.reportCoverageBlocking) return "fill report coverage: read README/profile/generated Java role files, update reports, then run `npx ph workflow check`"
  if (summary.readCoverageBlocking) return "record README ranges read in `.persona/workflow/implementation-report.md`"
  if (summary.profileReadCoverageBlocking) return "record project profile read coverage in `.persona/workflow/implementation-report.md`"
  if (summary.javaRoleReadCoverageBlocking) return "read generated Java role files and rerun `npx ph workflow check`"
  if (summary.stackAlignmentBlocking) return "fix generated project stack to match `.persona/project-profile.jsonc` before finishing"
  if (summary.architectureConventionsBlocking) {
    const blocker = summary.architectureConventionBlockers[0]
    const convention = blocker === undefined ? undefined : findConventionByBlockerId(blocker.id)
    return `${convention?.fixPath ?? "fix architecture convention blockers"}, then run \`npx ph workflow check\``
  }
  if (summary.pendingTickets.length > 0) {
    const pendingTicket = summary.pendingTickets[0]
    if (pendingTicket?.archiveState === "history-only") {
      return `repair archived ticket backlog state with \`npx ph workflow archive ${pendingTicket.ticket}\`, then rerun \`npx ph workflow check\``
    }
    return `run \`npx ph workflow next\` or \`npx ph workflow continue\` for pending ticket ${pendingTicket?.ticket ?? "<unknown>"}`
  }
  if (summary.stackAlignmentFinding === "WARN") return "review profile/generated stack mismatch before archiving workflow"
  if (summary.commandDisciplineFinding === "WARN") {
    return "review non-blocking workflow notes, then archive completed workflow if acceptable"
  }
  return "archive completed workflow with `npx ph history --id <run-id>`"
}

export function readWorkflowStatus(projectDirInput?: string): WorkflowStatusSummary {
  const projectDir = resolve(projectDirInput ?? process.cwd())
  const configResult = loadHarnessConfigResult(projectDir)
  const evidencePath = configResult.safe
    ? resolveConfiguredPathResult(projectDir, configResult.config.evidenceDir)
    : undefined
  const evidence = evidencePath?.ok === true
    ? walkBoundedFiles(evidencePath.path, projectDir, {
        displayRoot: evidencePath.relativePath || configResult.config.evidenceDir,
        includeText: true,
      })
    : {
        diagnostics: [],
        files: [],
        present: false,
        safe: false,
      }
  const summary = {
    projectDir,
    plan: readStatusLine(join(projectDir, PLAN_PATH)),
    implementation: readWorkflowReportStatus(projectDir, IMPLEMENTATION_REPORT_PATH),
    review: readWorkflowReportStatus(projectDir, REVIEW_REPORT_PATH),
    evidence: evidence.files.length > 0 ? "present" : "missing",
  } as const
  const coverage = readCoverage(projectDir, summary.implementation, evidence)
  const profileCoverage = profileReadCoverage(projectDir, summary.implementation, evidence)
  const javaRoleCoverage: JavaRoleReadCoverageSummary = readJavaRoleReadCoverage(projectDir, summary.implementation)
  const reportCoverageSummary: WorkflowReportCoverageSummary = readWorkflowReportCoverage({
    projectDir,
    implementationStatus: summary.implementation,
    reviewStatus: summary.review,
    readCoverageBlocking: coverage.readCoverageBlocking,
    profileReadCoverageBlocking: profileCoverage.profileReadCoverageBlocking,
    javaRoleReadCoverageBlocking: javaRoleCoverage.javaRoleReadCoverageBlocking,
  })
  const command = commandDiscipline(projectDir, summary.implementation, summary.review)
  const verificationFailure: WorkflowVerificationFailureSummary = readVerificationFailure(projectDir, summary.implementation)
  const stack = stackAlignment(projectDir, summary.implementation)
  const architectureConventions: ArchitectureConventionSummary = readArchitectureConventions(projectDir, summary.implementation)
  const pendingTickets = workflowPendingTicketStatus(projectDir)
  const pendingTicketsFinding = pendingTickets.length > 0 ? "WARN" : "PASS"
  const next = nextAction({ ...summary, ...coverage, ...profileCoverage, ...javaRoleCoverage, ...reportCoverageSummary, ...command, ...verificationFailure, ...stack, ...architectureConventions, pendingTickets, pendingTicketsFinding })
  const finding =
    summary.plan === "accepted"
    && summary.implementation === "filled"
    && summary.review === "filled"
    && coverage.readCoverageFinding === "PASS"
    && profileCoverage.profileReadCoverageFinding === "PASS"
    && javaRoleCoverage.javaRoleReadCoverageFinding === "PASS"
    && reportCoverageSummary.reportCoverageFinding === "PASS"
    && command.commandDisciplineFinding === "PASS"
    && verificationFailure.verificationFailureFinding === "PASS"
    && stack.stackAlignmentFinding === "PASS"
    && architectureConventions.architectureConventionsFinding === "PASS"
    && pendingTicketsFinding === "PASS"
      ? "PASS"
      : "WARN"
  return { ...summary, ...coverage, ...profileCoverage, ...javaRoleCoverage, ...reportCoverageSummary, ...command, ...verificationFailure, ...stack, ...architectureConventions, pendingTickets, pendingTicketsFinding, finding, next }
}

export function formatWorkflowStatus(summary: WorkflowStatusSummary): string {
  const selfProfileGuidance = summary.stackAlignmentFinding === "WARN" ? personaHarnessSelfProfileGuidance(summary.projectDir) : []
  const evidenceRoot = resolveSafeEvidenceRootResult(summary.projectDir)
  const displayEvidenceRoot = evidenceRoot.ok ? evidenceRoot.relativePath : "unavailable"
  return [
    "Persona Harness Workflow Check",
    "",
    `Workflow status: ${summary.finding}`,
    `Project: ${summary.projectDir}`,
    "",
    "Artifacts:",
    `- .persona/workflow/plan.md: ${summary.plan}`,
    `- .persona/workflow/implementation-report.md: ${summary.implementation}`,
    `- .persona/workflow/review-report.md: ${summary.review}`,
    `- ${displayEvidenceRoot}: ${summary.evidence}`,
    `- read coverage: ${summary.readCoverage}`,
    `- profile read coverage: ${summary.profileReadCoverage}`,
    `- java role read coverage: ${summary.javaRoleReadCoverage}`,
    `- report coverage: ${summary.reportCoverage}`,
    `- command discipline: ${summary.commandDiscipline}`,
    `- verification failure: ${summary.verificationFailure}`,
    `- stack alignment: ${summary.stackAlignment}`,
    `- architecture conventions: ${summary.architectureConventions}`,
    `- backend shape report: ${backendShapeReportStatus(summary.projectDir)}`,
    ...formatPendingWorkflowTicketStatusLines(summary.pendingTickets),
    ...(selfProfileGuidance.length === 0
      ? []
      : [
          "",
          "Self-profile note:",
          ...selfProfileGuidance.map((line) => `- ${line}`),
        ]),
    "",
    `Next: ${summary.next}`,
    "",
    "Scope:",
    "- report-only workflow status",
    "- not generated app product-quality certification",
  ].join("\n")
}
