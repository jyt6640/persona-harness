import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { readWorkflowStatus, type WorkflowStatusSummary } from "./workflow-status.js"

type ClosureAction = "next" | "status"
type ClosureArchive = "complete" | "history-only-repair" | "pending"
type ClosureEvidence = "missing" | "present"
type ClosureFinish = "blocked" | "passed"
type ClosureReportStatus = "filled" | "missing" | "template" | "unknown"
type ClosureStepKind = "cli-command" | "human-or-model-content" | "terminal"
type ClosureStepStatus = "blocked" | "complete" | "pending"
type ClosureVerification = "failed" | "not-run" | "passed" | "unknown"

type ClosureTicket = {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly state: "active-work" | "history-only" | "missing-work"
}

type ClosureBlocker = {
  readonly evidenceRef?: string
  readonly id: string
  readonly reason: string
  readonly source: string
}

type ClosureStep = {
  readonly blockerId?: string
  readonly command?: string
  readonly commandAfterContent?: string
  readonly evidenceRef?: string
  readonly id: string
  readonly kind: ClosureStepKind
  readonly reason?: string
  readonly source?: string
  readonly status: ClosureStepStatus
}

type WorkflowClosureState = {
  readonly archive: ClosureArchive
  readonly blockers: readonly ClosureBlocker[]
  readonly currentTicket: ClosureTicket | undefined
  readonly evidence: ClosureEvidence
  readonly finish: ClosureFinish
  readonly implementationReport: ClosureReportStatus
  readonly pendingTickets: readonly string[]
  readonly plan: string
  readonly reportCoverage: "missing" | "not-checked" | "sufficient"
  readonly reviewReport: ClosureReportStatus
  readonly verification: ClosureVerification
}

type ClosurePayload = {
  readonly action: ClosureAction
  readonly state: WorkflowClosureState
  readonly steps: readonly ClosureStep[]
}

type VerificationSummary = {
  readonly evidenceRef?: string
  readonly reason: string
  readonly verification: ClosureVerification
}

const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const PLAN_PATH = ".persona/workflow/plan.md"
const EVIDENCE_DIR = ".persona/evidence"
const SUCCESS_PATTERNS = [
  /BUILD SUCCESSFUL/i,
  /(?:test|build|runtime smoke|bootRun)\s+PASS/i,
  /Tomcat started/i,
  /Started\s+\w*Application/i,
] as const
const FAILURE_PATTERNS = [
  /BUILD FAILED/i,
  /Could not resolve/i,
  /exit\s+1/i,
  /(?:compile|compilation|test|build|runtime smoke|bootRun)\s+failed/i,
] as const
const COMMAND_MENTION_PATTERN = /\b(?:\.\/)?gradlew(?:\.bat)?\s+(?:test|build|bootRun)\b|\bbootRun\b|\bcurl\b/i

export function runWorkflowClosureCommand(action: ClosureAction, options: { readonly projectDir?: string }): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const state = readWorkflowClosureState(projectDir)
  return {
    status: 0,
    stdout: `${JSON.stringify({ action, state, steps: closureSteps(state) } satisfies ClosurePayload, null, 2)}\n`,
    stderr: "",
  }
}

function readWorkflowClosureState(projectDir: string): WorkflowClosureState {
  const summary = readWorkflowStatus(projectDir)
  const verification = readClosureVerification(projectDir, summary)
  const pendingTickets = summary.pendingTickets.map((ticket) => ticket.ticket)
  const currentTicket = closureTicket(summary)
  const partialState = {
    archive: closureArchive(summary),
    currentTicket,
    evidence: summary.evidence,
    finish: "blocked" as const,
    implementationReport: closureReportStatus(summary.implementation),
    pendingTickets,
    plan: summary.plan,
    reportCoverage: closureReportCoverage(summary),
    reviewReport: closureReportStatus(summary.review),
    verification: verification.verification,
  }
  const blockers = closureBlockers(partialState, verification, summary)
  const finish: ClosureFinish = blockers.length === 0 && summary.finding === "PASS" ? "passed" : "blocked"
  const state = { ...partialState, finish }
  return { ...state, blockers: finish === "blocked" && blockers.length === 0 ? [finishBlocker(summary)] : blockers }
}

function closureTicket(summary: WorkflowStatusSummary): ClosureTicket | undefined {
  const ticket = summary.pendingTickets[0]
  return ticket === undefined
    ? undefined
    : { id: ticket.ticket, path: ticket.path, state: ticket.archiveState, title: ticket.title }
}

function closureReportStatus(status: string): ClosureReportStatus {
  if (status === "filled" || status === "missing" || status === "template") {
    return status
  }
  return "unknown"
}

function closureReportCoverage(summary: WorkflowStatusSummary): WorkflowClosureState["reportCoverage"] {
  if (summary.implementation !== "filled") {
    return "not-checked"
  }
  return summary.reportCoverageFinding === "PASS" ? "sufficient" : "missing"
}

function closureArchive(summary: WorkflowStatusSummary): ClosureArchive {
  if (summary.pendingTickets.length === 0) {
    return "complete"
  }
  return summary.pendingTickets.some((ticket) => ticket.archiveState === "history-only") ? "history-only-repair" : "pending"
}

function closureBlockers(
  state: Omit<WorkflowClosureState, "blockers">,
  verification: VerificationSummary,
  summary: WorkflowStatusSummary,
): readonly ClosureBlocker[] {
  if (state.plan !== "accepted") {
    return [{ id: "plan-not-accepted", reason: `workflow plan is ${state.plan}`, source: PLAN_PATH }]
  }
  const blockers: ClosureBlocker[] = []
  if (verification.verification === "failed") {
    blockers.push({ evidenceRef: verification.evidenceRef, id: "verification-failed", reason: verification.reason, source: verification.evidenceRef ?? EVIDENCE_DIR })
  } else if (verification.verification !== "passed") {
    blockers.push({ evidenceRef: verification.evidenceRef, id: "verification-unknown", reason: verification.reason, source: verification.evidenceRef ?? EVIDENCE_DIR })
  }
  if (state.implementationReport !== "filled") {
    blockers.push({ evidenceRef: state.evidence === "present" ? EVIDENCE_DIR : undefined, id: "implementation-report-missing", reason: `implementation report is ${state.implementationReport}`, source: IMPLEMENTATION_REPORT_PATH })
  }
  if (state.reviewReport !== "filled") {
    blockers.push({ id: "review-report-missing", reason: `review report is ${state.reviewReport}`, source: REVIEW_REPORT_PATH })
  }
  if (state.currentTicket !== undefined) {
    blockers.push(
      state.currentTicket.state === "history-only"
        ? { id: "history-backlog-mismatch", reason: `${state.currentTicket.id} exists in history but backlog remains pending`, source: state.currentTicket.path }
        : { id: "pending-ticket", reason: `${state.currentTicket.id} remains pending`, source: state.currentTicket.path },
    )
  }
  if (blockers.length === 0 && summary.finding !== "PASS") {
    blockers.push(finishBlocker(summary))
  }
  return blockers
}

function finishBlocker(summary: WorkflowStatusSummary): ClosureBlocker {
  return { id: "finish-blocked", reason: summary.next, source: "npx ph workflow finish implement" }
}

function closureSteps(state: WorkflowClosureState): readonly ClosureStep[] {
  if (state.finish === "passed" && state.blockers.length === 0) {
    return [{ id: "terminal", kind: "terminal", status: "complete" }]
  }
  return state.blockers.map((blocker, index) => blockerStep(blocker, state, index === 0 ? "blocked" : "pending"))
}

function blockerStep(blocker: ClosureBlocker, state: WorkflowClosureState, status: ClosureStepStatus): ClosureStep {
  if (blocker.id === "plan-not-accepted") {
    return { blockerId: blocker.id, command: state.plan === "missing" ? "npx ph plan" : "npx ph plan --accept", id: "accept-plan", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "verification-failed") {
    return { blockerId: blocker.id, evidenceRef: blocker.evidenceRef, id: "fix-verification", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "verification-unknown") {
    return { blockerId: blocker.id, evidenceRef: blocker.evidenceRef, id: "verify-app", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "implementation-report-missing") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph plan --report-filled implementation", evidenceRef: blocker.evidenceRef, id: "fill-implementation-report", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "review-report-missing") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph plan --report-filled review", id: "fill-review-report", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "history-backlog-mismatch" && state.currentTicket !== undefined) {
    return { blockerId: blocker.id, command: `npx ph workflow archive ${state.currentTicket.id}`, id: "repair-archive-state", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "pending-ticket" && state.currentTicket !== undefined) {
    return { blockerId: blocker.id, commandAfterContent: `npx ph workflow archive ${state.currentTicket.id}`, id: "archive-current-ticket", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  return { blockerId: blocker.id, command: "npx ph workflow finish implement", id: "finish-implement", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
}

function readClosureVerification(projectDir: string, summary: WorkflowStatusSummary): VerificationSummary {
  if (summary.verificationFailureBlocking) {
    return { reason: summary.verificationFailure, verification: "failed" }
  }
  const evidence = verificationCorpus(projectDir)
  if (evidence.text.length === 0) {
    return { reason: "no verification evidence observed", verification: "not-run" }
  }
  if (FAILURE_PATTERNS.some((pattern) => pattern.test(evidence.text))) {
    return { evidenceRef: evidence.ref, reason: "explicit verification failure evidence observed", verification: "failed" }
  }
  if (SUCCESS_PATTERNS.some((pattern) => pattern.test(evidence.text))) {
    return { evidenceRef: evidence.ref, reason: "verification success evidence observed", verification: "passed" }
  }
  if (COMMAND_MENTION_PATTERN.test(evidence.text)) {
    return { evidenceRef: evidence.ref, reason: "verification commands mentioned without success/failure output", verification: "unknown" }
  }
  return { evidenceRef: evidence.ref, reason: "verification evidence is present but inconclusive", verification: "unknown" }
}

function verificationCorpus(projectDir: string): { readonly ref?: string; readonly text: string } {
  const reportText = [IMPLEMENTATION_REPORT_PATH, REVIEW_REPORT_PATH]
    .map((path) => join(projectDir, path))
    .filter((path) => existsSync(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n")
  const evidenceDir = join(projectDir, EVIDENCE_DIR)
  const evidenceText = readFilesDeep(evidenceDir)
  return {
    ref: evidenceText.length > 0 ? EVIDENCE_DIR : undefined,
    text: [reportText, evidenceText].filter((text) => text.length > 0).join("\n"),
  }
}

function readFilesDeep(dirPath: string): string {
  if (!existsSync(dirPath)) {
    return ""
  }
  return readdirSync(dirPath)
    .map((entry) => {
      const entryPath = join(dirPath, entry)
      const stat = statSync(entryPath)
      if (stat.isDirectory()) {
        return readFilesDeep(entryPath)
      }
      return stat.isFile() ? readFileSync(entryPath, "utf8") : ""
    })
    .filter((text) => text.length > 0)
    .join("\n")
}
