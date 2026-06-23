import { existsSync } from "node:fs"
import { join } from "node:path"

import type { CliRunResult } from "./bearshell.js"
import { readBackendProjectProfileState } from "../phase0/project-profile.js"
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
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"
import { runWorkflowArchive, runWorkflowNext, runWorkflowSplit, workflowTicketUsage } from "./workflow-tickets.js"

type WorkflowOptions = {
  readonly projectDir?: string
}

type ParsedWorkflowArgs =
  | { readonly kind: "check" }
  | { readonly kind: "implement" }
  | { readonly kind: "continue" }
  | { readonly kind: "guard"; readonly guardKind: WorkflowGuardKind }
  | { readonly kind: "start"; readonly runnerKind: WorkflowRunnerKind }
  | { readonly kind: "finish"; readonly runnerKind: WorkflowRunnerKind }
  | { readonly kind: "split"; readonly sourceFile: string }
  | { readonly kind: "next" }
  | { readonly kind: "archive"; readonly ticketId: string }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function workflowUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} workflow <check|implement|continue|split|next|archive|start implement|finish implement|guard implement|guard final>`,
    "",
    "Checks or guards Persona Harness workflow artifacts before or after implementation.",
    "",
    "Scope:",
    "- workflow check is report-only",
    "- workflow implement prints a single AI-facing implementation rail",
    "- workflow continue prints the accepted-plan continuation prompt",
    "- workflow start/finish are AI-facing workflow rails",
    "- workflow split/next/archive manage README-derived task tickets",
    "- workflow guard uses strict exit codes for AI-facing workflow discipline",
    "- no generated app quality certification",
    "",
    "Ticket commands:",
    workflowTicketUsage(invocation),
  ].join("\n")
}

function parseWorkflowArgs(args: readonly string[]): ParsedWorkflowArgs {
  if (args.length === 0 || args[0] === "check") {
    return args.length <= 1 ? { kind: "check" } : { kind: "invalid", message: "workflow check does not accept extra arguments." }
  }
  if (args[0] === "implement") {
    return args.length === 1 ? { kind: "implement" } : { kind: "invalid", message: "workflow implement does not accept extra arguments." }
  }
  if (args[0] === "continue") {
    return args.length === 1 ? { kind: "continue" } : { kind: "invalid", message: "workflow continue does not accept extra arguments." }
  }
  if (args[0] === "split") {
    if (args.length !== 2) {
      return { kind: "invalid", message: "workflow split requires a source markdown file." }
    }
    return { kind: "split", sourceFile: args[1] ?? "" }
  }
  if (args[0] === "next") {
    return args.length === 1 ? { kind: "next" } : { kind: "invalid", message: "workflow next does not accept extra arguments." }
  }
  if (args[0] === "archive") {
    if (args.length !== 2) {
      return { kind: "invalid", message: "workflow archive requires a ticket id." }
    }
    return { kind: "archive", ticketId: args[1] ?? "" }
  }
  if (args[0] === "guard") {
    if (args.length !== 2) {
      return { kind: "invalid", message: "workflow guard requires implement or final." }
    }
    if (args[1] === "implement" || args[1] === "final") {
      return { kind: "guard", guardKind: args[1] }
    }
    return { kind: "invalid", message: `Unknown workflow guard: ${args[1]}` }
  }
  if (args[0] === "start") {
    if (args.length !== 2) {
      return { kind: "invalid", message: "workflow start requires implement." }
    }
    if (args[1] === "implement") {
      return { kind: "start", runnerKind: args[1] }
    }
    return { kind: "invalid", message: `Unknown workflow start: ${args[1]}` }
  }
  if (args[0] === "finish") {
    if (args.length !== 2) {
      return { kind: "invalid", message: "workflow finish requires implement." }
    }
    if (args[1] === "implement") {
      return { kind: "finish", runnerKind: args[1] }
    }
    return { kind: "invalid", message: `Unknown workflow finish: ${args[1]}` }
  }
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { kind: "help" }
  }
  return { kind: "invalid", message: `Unknown workflow command: ${args[0]}` }
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
