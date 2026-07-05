import { existsSync } from "node:fs"
import { join } from "node:path"

import type { CliRunResult } from "./bearshell.js"
import { readBackendProjectProfileState } from "../config/project-profile.js"
import { runResumeCommand } from "./plan-next.js"
import { workflowClosureFinishReasons } from "./workflow-closure-finish.js"
import { readWorkflowClosurePayload, runWorkflowClosureCommand } from "./workflow-closure.js"
import { isStructuredWorkflowRequiredFix, type WorkflowRequiredFix } from "./workflow-required-fix.js"
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
import { runWorkflowRelayCommand } from "./workflow-relay.js"
import { runWorkflowLoopCommand } from "./workflow-loop.js"
import { runWorkflowRalphLoopCommand } from "./workflow-ralph-loop.js"
import { runWorkflowRoleBoundaryCommand } from "./workflow-role-boundary.js"
import { runWorkflowRolesCommand } from "./workflow-roles.js"
import { cachedWorkflowRailOutput } from "./workflow-rail-cache.js"
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"
import { stdinEncodingError } from "./stdin-text.js"
import { runWorkflowTddStatus } from "./workflow-tdd-status.js"
import { recordTddGreenForCurrentTicket, runWorkflowTddTest } from "./workflow-tdd.js"
import type { WorkflowStateWriteOptions } from "./workflow-state-conflict.js"
import {
  runWorkflowArchive,
  runWorkflowApproveRequirements,
  runWorkflowCapture,
  runWorkflowDraft,
  runWorkflowNext,
  runWorkflowSplit,
} from "./workflow-tickets.js"

type WorkflowOptions = WorkflowStateWriteOptions & {
  readonly full?: boolean
  readonly projectDir?: string
  readonly stdin?: string
}

type WorkflowStatus = ReturnType<typeof readWorkflowStatus>

function implementationGuardReasons(summary: WorkflowStatus): readonly string[] {
  const reasons: string[] = []
  const profileState = readBackendProjectProfileState(summary.projectDir)
  if (profileState.status !== "ready") {
    reasons.push(
      [
        "Harness initialized but project profile is not ready.",
        ".persona exists but the backend project profile is not ready.",
        ".persona/project-profile.jsonc is required before implementation.",
        "Do not enter implementation rail until profile/bootstrap is ready.",
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

function finalGuardReasons(projectDir: string): readonly WorkflowRequiredFix[] {
  return workflowClosureFinishReasons(readWorkflowClosurePayload("next", projectDir, { recordTddGreenEvidence: true }), projectDir)
}

function requiredFixDetails(fixes: readonly WorkflowRequiredFix[]): readonly string[] {
  return fixes.map((fix) => isStructuredWorkflowRequiredFix(fix) ? fix.detail : fix)
}

function hasPersonaHarness(summary: WorkflowStatus): boolean {
  return existsSync(join(summary.projectDir, ".persona"))
}

function stdinEncodingFailure(options: WorkflowOptions): CliRunResult | undefined {
  const stdin = options.stdin
  if (stdin === undefined) {
    return undefined
  }
  const message = stdinEncodingError(stdin)
  return message === undefined ? undefined : { status: 1, stdout: "", stderr: `${message}\n` }
}

function runWorkflowGuard(guardKind: WorkflowGuardKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = guardKind === "implement" ? implementationGuardReasons(summary) : requiredFixDetails(finalGuardReasons(summary.projectDir))
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
  return passedStartOutput(runnerKind, summary.projectDir)
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
  return passedImplementOutput(summary.projectDir, { full: options.full })
}

function runWorkflowFinish(runnerKind: WorkflowRunnerKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (!hasPersonaHarness(summary)) {
    return uninitializedHarnessOutput()
  }
  const reasons = finalGuardReasons(summary.projectDir)
  if (reasons.length > 0) {
    return failedRunnerOutput("finish", runnerKind, reasons)
  }
  return passedFinishOutput(runnerKind)
}

function runWorkflowCheck(options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  if (hasPersonaHarness(summary)) {
    recordTddGreenForCurrentTicket(summary.projectDir)
  }
  const nextSummary = readWorkflowStatus(options.projectDir)
  const fullText = `${formatWorkflowStatus(nextSummary)}\n`
  if (!hasPersonaHarness(nextSummary)) {
    return { status: 0, stdout: fullText, stderr: "" }
  }
  return { status: 0, stdout: cachedWorkflowCheckOutput(nextSummary, options.full ?? false), stderr: "" }
}

function cachedWorkflowCheckOutput(summary: WorkflowStatus, full: boolean): string {
  const fullLines = formatWorkflowStatus(summary).split("\n")
  const artifactsIndex = fullLines.findIndex((line) => line === "Artifacts:")
  if (artifactsIndex === -1) {
    return `${fullLines.join("\n")}\n`
  }
  const nextIndex = fullLines.findIndex((line) => line.startsWith("Next: "))
  const scopeIndex = fullLines.findIndex((line) => line === "Scope:")
  const detailEnd = nextIndex !== -1 ? Math.max(artifactsIndex, nextIndex - 1) : scopeIndex !== -1 ? Math.max(artifactsIndex, scopeIndex - 1) : fullLines.length
  const uniqueLines = [
    ...fullLines.slice(0, artifactsIndex),
    ...(nextIndex === -1 ? [] : ["", fullLines[nextIndex] ?? ""]),
    ...(scopeIndex === -1 ? [] : ["", ...fullLines.slice(scopeIndex)]),
  ]
  return cachedWorkflowRailOutput({
    full,
    fullLines,
    projectDir: summary.projectDir,
    railBodyLines: fullLines.slice(artifactsIndex, detailEnd),
    surface: "workflow-check",
    uniqueLines,
  })
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
    return runWorkflowImplement({ ...options, full: parsed.full })
  }
  if (parsed.kind === "test") {
    return runWorkflowTddTest(options)
  }
  if (parsed.kind === "tdd") {
    return runWorkflowTddStatus(options)
  }
  if (parsed.kind === "continue") {
    return runResumeCommand({ ...options, full: parsed.full })
  }
  if (parsed.kind === "loop") {
    return runWorkflowLoopCommand({
      dryRun: parsed.dryRun,
      graceMs: parsed.graceMs,
      json: parsed.json,
      maxIterations: parsed.maxIterations,
      opencodeCommand: parsed.opencodeCommand,
      projectDir: options.projectDir,
      timeoutMs: parsed.timeoutMs,
    })
  }
  if (parsed.kind === "ralph-loop") {
    return runWorkflowRalphLoopCommand({ json: parsed.json, projectDir: options.projectDir })
  }
  if (parsed.kind === "role-boundary") {
    return runWorkflowRoleBoundaryCommand({ json: parsed.json, projectDir: options.projectDir })
  }
  if (parsed.kind === "closure") {
    return runWorkflowClosureCommand(parsed.closureAction, options)
  }
  if (parsed.kind === "relay") {
    return runWorkflowRelayCommand(parsed.relayArgs, { projectDir: options.projectDir }, invocationName)
  }
  if (parsed.kind === "roles") {
    return runWorkflowRolesCommand(options)
  }
  if (parsed.kind === "draft") {
    const encodingFailure = stdinEncodingFailure(options)
    if (encodingFailure !== undefined) {
      return encodingFailure
    }
    return runWorkflowDraft(options)
  }
  if (parsed.kind === "approve-requirements") {
    return runWorkflowApproveRequirements(options)
  }
  if (parsed.kind === "capture") {
    const encodingFailure = stdinEncodingFailure(options)
    if (encodingFailure !== undefined) {
      return encodingFailure
    }
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
  return runWorkflowCheck({ ...options, full: parsed.full })
}
