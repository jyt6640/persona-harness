import { resolve } from "node:path"
import process from "node:process"

import type { CliRunResult } from "./bearshell.js"
import { readClosureVerification, type ClosureVerification } from "./workflow-closure-verification.js"
import { readWorkflowStatus, type WorkflowStatusSummary } from "./workflow-status.js"

export type ClosureAction = "next" | "status"
type ClosureArchive = "complete" | "history-only-repair" | "pending"
type ClosureEvidence = "missing" | "present"
type ClosureFinish = "blocked" | "passed"
type ClosureReportStatus = "filled" | "missing" | "template" | "unknown"
type ClosureStepKind = "cli-command" | "human-or-model-content" | "terminal"
type ClosureStepStatus = "blocked" | "complete" | "pending"
export type ClosureTicket = {
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

export type ClosureStep = {
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

export type WorkflowClosureState = {
  readonly archive: ClosureArchive
  readonly blockers: readonly ClosureBlocker[]
  readonly currentTicket: ClosureTicket | null
  readonly evidence: ClosureEvidence
  readonly finish: ClosureFinish
  readonly implementationReport: ClosureReportStatus
  readonly pendingTickets: readonly string[]
  readonly plan: string
  readonly reportCoverage: "missing" | "not-checked" | "sufficient"
  readonly reviewReport: ClosureReportStatus
  readonly verification: ClosureVerification
}

export type ClosureStatusPayload = {
  readonly action: "status"
  readonly state: WorkflowClosureState
  readonly steps: readonly ClosureStep[]
}

export type ClosureNextPayload = {
  readonly action: "next"
  readonly nextStep: ClosureStep | null
  readonly state: WorkflowClosureState
  readonly steps: readonly ClosureStep[]
}

export type ClosurePayload = ClosureNextPayload | ClosureStatusPayload

const IMPLEMENTATION_REPORT_PATH = ".persona/workflow/implementation-report.md"
const REVIEW_REPORT_PATH = ".persona/workflow/review-report.md"
const PLAN_PATH = ".persona/workflow/plan.md"
const EVIDENCE_DIR = ".persona/evidence"

export function runWorkflowClosureCommand(action: ClosureAction, options: { readonly projectDir?: string }): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  return {
    status: 0,
    stdout: `${JSON.stringify(readWorkflowClosurePayload(action, projectDir), null, 2)}\n`,
    stderr: "",
  }
}

export function readWorkflowClosurePayload(action: ClosureAction, projectDir: string): ClosurePayload {
  const state = readWorkflowClosureState(projectDir)
  const steps = closureSteps(state)
  if (action === "next") {
    return { action, nextStep: steps[0] ?? null, state, steps }
  }
  return { action, state, steps }
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

function closureTicket(summary: WorkflowStatusSummary): ClosureTicket | null {
  const ticket = summary.pendingTickets[0]
  return ticket === undefined
    ? null
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
  verification: ReturnType<typeof readClosureVerification>,
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
  if (state.currentTicket !== null) {
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
  if (blocker.id === "history-backlog-mismatch" && state.currentTicket !== null) {
    return { blockerId: blocker.id, command: `npx ph workflow archive ${state.currentTicket.id}`, id: "repair-archive-state", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "pending-ticket" && state.currentTicket !== null) {
    return { blockerId: blocker.id, commandAfterContent: `npx ph workflow archive ${state.currentTicket.id}`, id: "archive-current-ticket", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  return { blockerId: blocker.id, command: "npx ph workflow finish implement", id: "finish-implement", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
}
