import { existsSync } from "node:fs"
import { join } from "node:path"

import type { CliRunResult } from "./bearshell.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"
import { runResumeCommand } from "./plan-next.js"
import { javaRoleReadCoverageReason, stackAlignmentReason } from "./workflow-finish-reasons.js"
import {
  failedGuardOutput,
  failedRunnerOutput,
  passedFinishOutput,
  passedGuardOutput,
  passedImplementOutput,
  passedStartOutput,
  type WorkflowGuardKind,
  type WorkflowRunnerKind,
  uninitializedHarnessOutput,
} from "./workflow-output.js"
import { parseWorkflowArgs, workflowUsage } from "./workflow-args.js"
import { runWorkflowRolesCommand } from "./workflow-roles.js"
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"
import { PENDING_TICKETS_COMPLETION_GUIDANCE, pendingWorkflowTickets } from "./workflow-ticket-summary.js"
import {
  runWorkflowArchive,
  runWorkflowApproveRequirements,
  runWorkflowCapture,
  runWorkflowDraft,
  runWorkflowNext,
  runWorkflowSplit,
} from "./workflow-tickets.js"

type WorkflowOptions = {
  readonly projectDir?: string
  readonly stdin?: string
}

type WorkflowStatus = ReturnType<typeof readWorkflowStatus>

type PendingTicketSummary = ReturnType<typeof pendingWorkflowTickets>[number]

function implementationGuardReasons(summary: WorkflowStatus): readonly string[] {
  const reasons: string[] = []
  const profileState = readBackendProjectProfileState(summary.projectDir)
  if (profileState.status !== "ready") {
    reasons.push(
      [
        "Harness initialized but project profile is not ready.",
        ".persona exists but the backend project profile is not ready.",
        profileState.message,
        "Interactive intake: run `npx ph intake --interactive`.",
        "AI/non-TTY fast path: run `npx ph bootstrap backend`.",
      ].join(" "),
    )
  }
  if (summary.plan === "missing") {
    reasons.push(".persona/workflow/plan.md is missing. Run npx ph bootstrap backend or npx ph plan --auto-accept.")
  } else if (summary.plan !== "accepted") {
    reasons.push(".persona/workflow/plan.md must be accepted")
  }
  if (summary.implementation === "missing") {
    reasons.push(".persona/workflow/implementation-report.md must exist")
  }
  if (summary.review === "missing") {
    reasons.push(".persona/workflow/review-report.md must exist")
  }
  return reasons
}

function ticketLooksTechnicalConstraints(ticket: PendingTicketSummary): boolean {
  return /technical constraints|constraints|기술|제약/i.test(`${ticket.ticket} ${ticket.title} ${ticket.path}`)
}

function satisfiedTechnicalConstraintSignals(summary: WorkflowStatus): readonly string[] {
  const signals = [
    ...(summary.implementation === "filled" && summary.review === "filled" ? ["workflow reports filled"] : []),
    ...(summary.readCoverageFinding === "PASS" ? ["README/read coverage PASS"] : []),
    ...(summary.profileReadCoverageFinding === "PASS" ? ["project profile read coverage PASS"] : []),
    ...(summary.stackAlignmentFinding === "PASS" ? ["Java/Spring Gradle stack alignment PASS"] : []),
    ...(summary.commandDisciplineFinding === "PASS" ? ["bearshell command discipline PASS"] : []),
    ...(summary.evidence === "present" ? ["workflow evidence present"] : []),
  ]
  return signals
}

function pendingTicketReason(summary: WorkflowStatus): string | undefined {
  const pendingTickets = pendingWorkflowTickets(summary.projectDir)
  if (pendingTickets.length === 0) {
    return undefined
  }

  const ticketLines = pendingTickets.flatMap((ticket) => {
    const technicalSignals = ticketLooksTechnicalConstraints(ticket) ? satisfiedTechnicalConstraintSignals(summary) : []
    return [
      `  Ticket: ${ticket.ticket}`,
      `  Title: ${ticket.title}`,
      `  Path: ${ticket.path}`,
      "  Next command: `npx ph workflow next`",
      `  If this ticket is complete: \`npx ph workflow archive ${ticket.ticket}\``,
      ...(technicalSignals.length > 0
        ? [
            `  Technical constraints note: may already be satisfied by ${technicalSignals.join(", ")}.`,
            `  Archive only after review: \`npx ph workflow archive ${ticket.ticket}\``,
          ]
        : []),
    ]
  })
  return [
    `Pending workflow tickets remain: ${pendingTickets.map((ticket) => ticket.ticket).join(", ")}.`,
    "Run `npx ph workflow next` to resume the next ticket.",
    PENDING_TICKETS_COMPLETION_GUIDANCE,
    ...ticketLines,
  ].join("\n")
}

function finalGuardReasons(summary: WorkflowStatus): readonly string[] {
  const reasons: string[] = []
  if (summary.plan !== "accepted") {
    reasons.push(".persona/workflow/plan.md must be accepted")
  }
  if (summary.implementation !== "filled") {
    reasons.push(".persona/workflow/implementation-report.md must be filled")
  }
  if (summary.review !== "filled") {
    reasons.push(".persona/workflow/review-report.md must be filled")
  }
  if (summary.evidence !== "present") {
    reasons.push(".persona/evidence must contain at least one evidence file")
  }
  if (summary.commandDisciplineBlocking) {
    reasons.push(`Command discipline blocking: ${summary.commandDiscipline}. Rerun final verification through \`npx ph bearshell\`.`)
  }
  if (summary.readCoverageBlocking) {
    reasons.push("README ranges read must be recorded in .persona/workflow/implementation-report.md before finish.")
  }
  if (summary.profileReadCoverageBlocking) {
    reasons.push(
      "Profile read coverage missing: project profile read coverage must be recorded in .persona/workflow/implementation-report.md. Record project profile read method/ranges before finish.",
    )
  }
  const javaRoleReason = javaRoleReadCoverageReason(summary)
  if (javaRoleReason !== undefined) {
    reasons.push(javaRoleReason)
  }
  if (summary.stackAlignmentBlocking) {
    reasons.push(`Stack alignment blocking: ${summary.stackAlignment}. Keep the Java/Spring backend MVP stack aligned before finish.`)
  }
  const stackReason = stackAlignmentReason(summary)
  if (stackReason !== undefined) {
    reasons.push(stackReason)
  }
  const pendingReason = pendingTicketReason(summary)
  if (pendingReason !== undefined) {
    reasons.push(pendingReason)
  }
  return reasons
}

function hasPersonaHarness(summary: WorkflowStatus): boolean {
  return existsSync(join(summary.projectDir, ".persona"))
}

function runWorkflowGuard(guardKind: WorkflowGuardKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = guardKind === "implement" ? implementationGuardReasons(summary) : finalGuardReasons(summary)
  if (reasons.length > 0) {
    return failedGuardOutput(guardKind, reasons)
  }
  return passedGuardOutput(guardKind)
}

function runWorkflowStart(runnerKind: WorkflowRunnerKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = implementationGuardReasons(summary)
  if (reasons.length > 0) {
    return failedRunnerOutput("start", runnerKind, reasons)
  }
  return passedStartOutput(runnerKind)
}

function runWorkflowImplement(options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = implementationGuardReasons(summary)
  if (reasons.length > 0) {
    return failedRunnerOutput("implement", "implement", reasons)
  }
  return passedImplementOutput()
}

function runWorkflowFinish(runnerKind: WorkflowRunnerKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = finalGuardReasons(summary)
  if (reasons.length > 0) {
    return failedRunnerOutput("finish", runnerKind, reasons)
  }
  return passedFinishOutput(runnerKind)
}

export function runWorkflowCommand(args: readonly string[], options: WorkflowOptions = {}, invocationName = "ph"): CliRunResult {
  const parsed = parseWorkflowArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${workflowUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${workflowUsage(invocationName)}\n` }
  }
  if (parsed.kind === "guard") {
    return runWorkflowGuard(parsed.guardKind, options)
  }
  if (parsed.kind === "implement") {
    return runWorkflowImplement(options)
  }
  if (parsed.kind === "continue") {
    return runResumeCommand(options)
  }
  if (parsed.kind === "roles") {
    return runWorkflowRolesCommand(options)
  }
  if (parsed.kind === "draft") {
    return runWorkflowDraft(options)
  }
  if (parsed.kind === "approve-requirements") {
    return runWorkflowApproveRequirements(options)
  }
  if (parsed.kind === "capture") {
    return runWorkflowCapture(options)
  }
  if (parsed.kind === "split") {
    return runWorkflowSplit(parsed.sourceFile, options)
  }
  if (parsed.kind === "next") {
    return runWorkflowNext(options)
  }
  if (parsed.kind === "archive") {
    return runWorkflowArchive(parsed.ticketId, options)
  }
  if (parsed.kind === "start") {
    return runWorkflowStart(parsed.runnerKind, options)
  }
  if (parsed.kind === "finish") {
    return runWorkflowFinish(parsed.runnerKind, options)
  }
  return { status: 0, stdout: `${formatWorkflowStatus(readWorkflowStatus(options.projectDir))}\n`, stderr: "" }
}
