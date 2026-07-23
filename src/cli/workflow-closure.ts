import { resolve } from "node:path"
import process from "node:process"

import { findConventionByBlockerId } from "../config/convention-registry.js"
import type { WorkflowLifecycleProjection } from "../runtime/workflow-lifecycle-projection.js"
import { CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID } from "./architecture-conventions.js"
import type { CliRunResult } from "./bearshell.js"
import { readClosureVerification, type ClosureVerification } from "./workflow-closure-verification.js"
import { readWorkflowFinishAuthority, TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID } from "./workflow-finish-authority.js"
import {
  safeWorkflowClosureNextPayload,
  safeWorkflowClosureStatusPayload,
} from "./workflow-safe-rendering.js"
import { readWorkflowStatus, type WorkflowStatusSummary } from "./workflow-status.js"
import { workflowPendingTicketStatus } from "./workflow-ticket-summary.js"
import { readTddClosureFinding, type TddClosureFinding } from "./workflow-tdd.js"

// allow: SIZE_OK - blocker collection and step priority stay one deterministic closure state machine.
export type ClosureAction = "next" | "status"
type ClosureArchive = "complete" | "history-only-repair" | "pending"
type ClosureEvidence = "missing" | "present"
type ClosureFinish = "blocked" | "passed"
type ClosureReportStatus = "conflicting" | "filled" | "malformed" | "missing" | "template" | "unknown"
export type ClosureStepKind = "cli-command" | "human-or-model-content" | "terminal"
export type ClosureStepStatus = "blocked" | "complete" | "pending"
export const UNMAPPED_BLOCKER_STEP_ID = "unmapped-blocker"
export type ClosureTicket = {
  readonly id: string
  readonly title: string
  readonly path: string
  readonly reviewArchiveCandidate: boolean
  readonly state: "active-work" | "history-only" | "missing-work"
  readonly technicalSignals: readonly string[]
}

export type ClosureBlocker = {
  readonly evidenceRef?: string
  readonly id: string
  readonly reason: string
  readonly source: string
  readonly tickets?: readonly ClosureTicket[]
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
  readonly lifecycle: WorkflowLifecycleProjection
  readonly pendingTickets: readonly string[]
  readonly plan: string
  readonly reportCoverage: "missing" | "not-checked" | "sufficient"
  readonly reviewReport: ClosureReportStatus
  readonly tdd: TddClosureFinding
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

export function runWorkflowClosureCommand(action: ClosureAction, options: { readonly projectDir?: string }): CliRunResult {
  const projectDir = resolve(options.projectDir ?? process.cwd())
  const payload = readWorkflowClosurePayload(action, projectDir)
  const output = payload.action === "next"
    ? safeWorkflowClosureNextPayload(payload)
    : safeWorkflowClosureStatusPayload(payload)
  return {
    status: 0,
    stdout: `${JSON.stringify(output, null, 2)}\n`,
    stderr: "",
  }
}

export function readWorkflowClosurePayload(
  action: "next",
  projectDir: string,
  options?: {
    readonly consumeExternalAttestation?: boolean
    readonly now?: Date
    readonly recordTddGreenEvidence?: boolean
  },
): ClosureNextPayload
export function readWorkflowClosurePayload(
  action: "status",
  projectDir: string,
  options?: {
    readonly consumeExternalAttestation?: boolean
    readonly now?: Date
    readonly recordTddGreenEvidence?: boolean
  },
): ClosureStatusPayload
export function readWorkflowClosurePayload(
  action: ClosureAction,
  projectDir: string,
  options?: {
    readonly consumeExternalAttestation?: boolean
    readonly now?: Date
    readonly recordTddGreenEvidence?: boolean
  },
): ClosurePayload
export function readWorkflowClosurePayload(
  action: ClosureAction,
  projectDir: string,
  options: {
    readonly consumeExternalAttestation?: boolean
    readonly now?: Date
    readonly recordTddGreenEvidence?: boolean
  } = {},
): ClosurePayload {
  const state = readWorkflowClosureState(projectDir, options)
  const steps = closureSteps(state)
  if (action === "next") {
    return { action, nextStep: steps[0] ?? null, state, steps }
  }
  return { action, state, steps }
}

function readWorkflowClosureState(
  projectDir: string,
  options: {
    readonly consumeExternalAttestation?: boolean
    readonly now?: Date
    readonly recordTddGreenEvidence?: boolean
  },
): WorkflowClosureState {
  const verification = readClosureVerification(projectDir)
  const initialTicket = workflowPendingTicketStatus(projectDir)[0]?.ticket ?? null
  const tdd = readTddClosureFinding(projectDir, initialTicket, { recordGreenEvidence: options.recordTddGreenEvidence })
  const authority = readWorkflowFinishAuthority(projectDir, {
    consumeExternalAttestation: options.consumeExternalAttestation ?? false,
    now: options.now,
  })
  const summary = readWorkflowStatus(projectDir, { finishAuthority: authority, now: options.now })
  const pendingTickets = summary.pendingTickets.map((ticket) => ticket.ticket)
  const currentTicket = closureTickets(summary)[0] ?? null
  const partialState = {
    archive: closureArchive(summary),
    currentTicket,
    evidence: summary.evidence,
    finish: "blocked" as const,
    implementationReport: closureReportStatus(summary.implementation),
    lifecycle: summary.lifecycle,
    pendingTickets,
    plan: summary.plan,
    reportCoverage: closureReportCoverage(summary),
    reviewReport: closureReportStatus(summary.review),
    tdd,
    verification: verification.verification,
  }
  const lifecycleSafetyBlockers = closureLifecycleSafetyBlockers(summary.lifecycle)
  const legacyBlockers = closureBlockers(partialState, verification, summary, summary.lifecycle)
  const blockers = lifecycleSafetyBlockers.length > 0
    ? lifecycleSafetyBlockers
      : legacyBlockers.length === 0 && summary.lifecycle.finishAuthority.blocker !== null
        ? [summary.lifecycle.finishAuthority.blocker]
        : legacyBlockers
  const finish: ClosureFinish = blockers.length === 0 ? "passed" : "blocked"
  const state = { ...partialState, finish }
  return { ...state, blockers }
}

function closureTickets(summary: WorkflowStatusSummary): readonly ClosureTicket[] {
  return summary.pendingTickets.map((ticket) => ({
    id: ticket.ticket,
    path: ticket.path,
    reviewArchiveCandidate: ticket.reviewArchiveCandidate,
    state: ticket.archiveState,
    technicalSignals: ticket.reviewArchiveCandidate ? satisfiedTechnicalConstraintSignals(summary) : [],
    title: ticket.title,
  }))
}

function closureReportStatus(status: string): ClosureReportStatus {
  if (status === "conflicting" || status === "filled" || status === "malformed" || status === "missing" || status === "template") {
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
  lifecycle: WorkflowLifecycleProjection,
): readonly ClosureBlocker[] {
  if (state.plan !== "accepted") {
    return [{ id: "plan-not-accepted", reason: `workflow plan is ${state.plan}`, source: PLAN_PATH }]
  }
  const blockers: ClosureBlocker[] = []
  if (verification.verification === "failed") {
    blockers.push({ evidenceRef: verification.evidenceRef, id: "verification-failed", reason: verification.reason, source: verification.evidenceRef ?? lifecycle.evidence.source })
  } else if (verification.verification !== "passed") {
    blockers.push({ evidenceRef: verification.evidenceRef, id: "verification-unknown", reason: verification.reason, source: verification.evidenceRef ?? lifecycle.evidence.source })
  }
  pushLifecycleImplementationReportBlocker(blockers, lifecycle, state.evidence)
  pushLifecycleBlocker(blockers, lifecycle, "review-report-conflicting", "review-report-malformed", "review-report-missing")
  pushLifecycleBlocker(blockers, lifecycle, "evidence-missing")
  if (summary.commandDisciplineBlocking) {
    blockers.push({ id: "command-discipline-blocking", reason: summary.commandDiscipline, source: "workflow reports" })
  }
  if (summary.reportCoverageBlocking) {
    blockers.push({ id: "report-coverage-missing", reason: summary.reportCoverage, source: "workflow reports" })
  }
  if (summary.readCoverageBlocking) {
    blockers.push({ id: "read-coverage-missing", reason: summary.readCoverage, source: IMPLEMENTATION_REPORT_PATH })
  }
  if (summary.profileReadCoverageBlocking) {
    blockers.push({ id: "profile-read-coverage-missing", reason: summary.profileReadCoverage, source: IMPLEMENTATION_REPORT_PATH })
  }
  if (summary.javaRoleReadCoverageBlocking) {
    blockers.push({ id: "java-role-read-coverage-missing", reason: summary.javaRoleReadCoverage, source: IMPLEMENTATION_REPORT_PATH })
  }
  if (summary.stackAlignmentFinding === "WARN") {
    blockers.push({ id: "stack-alignment-mismatch", reason: summary.stackAlignment, source: ".persona/project-profile.jsonc" })
  }
  if (summary.architectureConventionsBlocking) {
    blockers.push(...summary.architectureConventionBlockers.map((blocker) => ({
      id: blocker.id,
      reason: blocker.reason,
      source: blocker.source,
    })))
  }
  pushLifecycleBlocker(blockers, lifecycle, "workflow-loop-state-malformed", "workflow-loop-state-stale", "ralph-loop-state-malformed")
  if (state.tdd.kind === "red-missing") {
    blockers.push({
      evidenceRef: state.tdd.evidenceRef,
      id: "tdd-red-evidence-missing",
      reason: state.tdd.reason,
      source: state.tdd.source,
    })
  } else if (state.tdd.kind === "red-without-green") {
    blockers.push({
      evidenceRef: state.tdd.evidenceRef,
      id: "tdd-not-red-then-green",
      reason: state.tdd.reason,
      source: state.tdd.source,
    })
  }
  if (lifecycle.tickets.status === "pending" && state.currentTicket !== null) {
    const tickets = closureTickets(summary)
    blockers.push(
      state.currentTicket.state === "history-only"
        ? { id: "history-backlog-mismatch", reason: `${state.currentTicket.id} exists in history but backlog remains pending`, source: state.currentTicket.path, tickets }
        : { id: "pending-ticket", reason: `${tickets.map((ticket) => ticket.id).join(", ")} remain pending`, source: state.currentTicket.path, tickets },
    )
  }
  return blockers
}

function closureLifecycleSafetyBlockers(lifecycle: WorkflowLifecycleProjection): readonly ClosureBlocker[] {
  return lifecycle.blockers.filter((blocker) =>
    blocker.id === "harness-config-invalid"
    || blocker.id === "rules-path-unsafe"
    || blocker.id === "evidence-path-unsafe",
  )
}

function pushLifecycleBlocker(
  blockers: ClosureBlocker[],
  lifecycle: WorkflowLifecycleProjection,
  ...ids: readonly string[]
): void {
  const blocker = lifecycle.blockers.find((candidate) => ids.includes(candidate.id))
  if (blocker !== undefined) {
    blockers.push(blocker)
  }
}

function pushLifecycleImplementationReportBlocker(
  blockers: ClosureBlocker[],
  lifecycle: WorkflowLifecycleProjection,
  evidence: ClosureEvidence,
): void {
  const blocker = lifecycle.blockers.find((candidate) =>
    candidate.id === "implementation-report-conflicting"
    || candidate.id === "implementation-report-malformed"
    || candidate.id === "implementation-report-missing",
  )
  if (blocker !== undefined) {
    blockers.push({
      ...blocker,
      ...(evidence === "present" ? { evidenceRef: lifecycle.evidence.source } : {}),
    })
  }
}

function satisfiedTechnicalConstraintSignals(summary: WorkflowStatusSummary): readonly string[] {
  return [
    ...(summary.implementation === "filled" && summary.review === "filled" ? ["workflow reports filled"] : []),
    ...(summary.readCoverageFinding === "PASS" ? ["README/read coverage PASS"] : []),
    ...(summary.profileReadCoverageFinding === "PASS" ? ["project profile read coverage PASS"] : []),
    ...(summary.stackAlignmentFinding === "PASS" ? ["Java/Spring Gradle stack alignment PASS"] : []),
    ...(summary.commandDisciplineFinding === "PASS" ? ["bearshell command discipline PASS"] : []),
    ...(summary.evidence === "present" ? ["workflow evidence present"] : []),
  ]
}

function closureSteps(state: WorkflowClosureState): readonly ClosureStep[] {
  if (state.finish === "passed" && state.blockers.length === 0) {
    return [{ id: "terminal", kind: "terminal", status: "complete" }]
  }
  return state.blockers.map((blocker, index) => blockerStep(blocker, state, index === 0 ? "blocked" : "pending"))
}

export function isUnmappedBlockerStep(step: ClosureStep | null | undefined): boolean {
  return step?.id === UNMAPPED_BLOCKER_STEP_ID
}

export function blockerStep(blocker: ClosureBlocker, state: WorkflowClosureState, status: ClosureStepStatus): ClosureStep {
  if (blocker.id === "harness-config-invalid") {
    return {
      blockerId: blocker.id,
      id: "repair-harness-config",
      kind: "human-or-model-content",
      reason: blocker.reason,
      source: blocker.source,
      status,
    }
  }
  if (blocker.id === "rules-path-unsafe") {
    return {
      blockerId: blocker.id,
      id: "repair-rules-path",
      kind: "human-or-model-content",
      reason: blocker.reason,
      source: blocker.source,
      status,
    }
  }
  if (blocker.id === "evidence-path-unsafe") {
    return {
      blockerId: blocker.id,
      id: "repair-evidence-path",
      kind: "human-or-model-content",
      reason: blocker.reason,
      source: blocker.source,
      status,
    }
  }
  if (blocker.id === "plan-not-accepted") {
    return { blockerId: blocker.id, command: state.plan === "missing" ? "npx ph plan" : "npx ph plan --accept", id: "accept-plan", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === TRUSTED_AUTHORITY_REQUIRED_BLOCKER_ID) {
    return { blockerId: blocker.id, id: blocker.id, kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
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
  if (blocker.id === "implementation-report-conflicting" || blocker.id === "implementation-report-malformed") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: "repair-implementation-report-status", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "review-report-missing") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph plan --report-filled review", id: "fill-review-report", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "review-report-conflicting" || blocker.id === "review-report-malformed") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: "repair-review-report-status", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "evidence-missing") {
    return { blockerId: blocker.id, id: "record-workflow-evidence", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "workflow-loop-state-malformed" || blocker.id === "workflow-loop-state-stale") {
    return { blockerId: blocker.id, id: "repair-workflow-loop-state", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "ralph-loop-state-malformed") {
    return { blockerId: blocker.id, id: "repair-ralph-loop-state", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "tdd-red-evidence-missing") {
    return { blockerId: blocker.id, command: "npx ph workflow test", evidenceRef: blocker.evidenceRef, id: "record-tdd-red", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "tdd-not-red-then-green") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow finish implement", evidenceRef: blocker.evidenceRef, id: "record-tdd-green", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "command-discipline-blocking") {
    return { blockerId: blocker.id, command: "npx ph bearshell <verification command>", id: "rerun-bearshell-verification", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "report-coverage-missing") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: "fill-report-coverage", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "read-coverage-missing") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: "record-read-coverage", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "profile-read-coverage-missing") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: "record-profile-read-coverage", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "java-role-read-coverage-missing") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: "record-java-role-read-coverage", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "stack-alignment-mismatch") {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: "fix-stack-alignment", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID) {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: "install-convention-toolchain", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  const convention = findConventionByBlockerId(blocker.id)
  if (convention !== undefined) {
    return { blockerId: blocker.id, commandAfterContent: "npx ph workflow check", id: convention.stepId, kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "history-backlog-mismatch" && state.currentTicket !== null) {
    return { blockerId: blocker.id, command: `npx ph workflow archive ${state.currentTicket.id}`, id: "repair-archive-state", kind: "cli-command", reason: blocker.reason, source: blocker.source, status }
  }
  if (blocker.id === "pending-ticket" && state.currentTicket !== null) {
    return { blockerId: blocker.id, commandAfterContent: `npx ph workflow archive ${state.currentTicket.id}`, id: "archive-current-ticket", kind: "human-or-model-content", reason: blocker.reason, source: blocker.source, status }
  }
  return {
    blockerId: blocker.id,
    id: UNMAPPED_BLOCKER_STEP_ID,
    kind: "human-or-model-content",
    reason: `${blocker.reason}; blocker id "${blocker.id}" has no closure step mapping. This is a PH bug or unregistered convention; escalate to Persona Harness configuration/maintainer review instead of rerunning finish/check.`,
    source: blocker.source,
    status,
  }
}
