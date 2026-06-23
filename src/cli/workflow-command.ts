import { existsSync } from "node:fs"
import { join } from "node:path"

import type { CliRunResult } from "./bearshell.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"
import { runResumeCommand } from "./plan-next.js"
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
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"
import {
  pendingWorkflowTicketIds,
  runWorkflowArchive,
  runWorkflowCapture,
  runWorkflowNext,
  runWorkflowSplit,
} from "./workflow-tickets.js"

type WorkflowOptions = {
  readonly projectDir?: string
  readonly stdin?: string
}

function implementationGuardReasons(summary: ReturnType<typeof readWorkflowStatus>): readonly string[] {
  const reasons: string[] = []
  const profileState = readBackendProjectProfileState(summary.projectDir)
  if (profileState.status !== "ready") {
    reasons.push(
      [
        "Harness initialized but project profile is not ready.",
        profileState.message,
        "Fast path: run npx ph bootstrap backend.",
        "Manual path: run npx ph intake --default backend or npx ph intake --interactive.",
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

function finalGuardReasons(summary: ReturnType<typeof readWorkflowStatus>): readonly string[] {
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
    reasons.push(summary.commandDiscipline)
  }
  if (summary.readCoverageBlocking) {
    reasons.push("README ranges read must be recorded in .persona/workflow/implementation-report.md")
  }
  const pendingTicketIds = pendingWorkflowTicketIds(summary.projectDir)
  if (pendingTicketIds.length > 0) {
    reasons.push(`Pending workflow tickets remain: ${pendingTicketIds.join(", ")}. Run \`npx ph workflow next\`.`)
  }
  return reasons
}

function hasPersonaHarness(summary: ReturnType<typeof readWorkflowStatus>): boolean {
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
