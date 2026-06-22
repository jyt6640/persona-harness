import type { CliRunResult } from "./bearshell.js"
import { readBackendProjectProfileState } from "../phase0/project-profile.js"
import {
  failedGuardOutput,
  failedRunnerOutput,
  passedFinishOutput,
  passedGuardOutput,
  passedImplementOutput,
  passedStartOutput,
  type WorkflowGuardKind,
  type WorkflowRunnerKind,
} from "./workflow-output.js"
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"

type WorkflowOptions = {
  readonly projectDir?: string
}

type ParsedWorkflowArgs =
  | { readonly kind: "check" }
  | { readonly kind: "implement" }
  | { readonly kind: "guard"; readonly guardKind: WorkflowGuardKind }
  | { readonly kind: "start"; readonly runnerKind: WorkflowRunnerKind }
  | { readonly kind: "finish"; readonly runnerKind: WorkflowRunnerKind }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function workflowUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} workflow <check|implement|start implement|finish implement|guard implement|guard final>`,
    "",
    "Checks or guards Persona Harness workflow artifacts before or after implementation.",
    "",
    "Scope:",
    "- workflow check is report-only",
    "- workflow implement prints a single AI-facing implementation rail",
    "- workflow start/finish are AI-facing workflow rails",
    "- workflow guard uses strict exit codes for AI-facing workflow discipline",
    "- no generated app quality certification",
  ].join("\n")
}

function parseWorkflowArgs(args: readonly string[]): ParsedWorkflowArgs {
  if (args.length === 0 || args[0] === "check") {
    return args.length <= 1 ? { kind: "check" } : { kind: "invalid", message: "workflow check does not accept extra arguments." }
  }
  if (args[0] === "implement") {
    return args.length === 1 ? { kind: "implement" } : { kind: "invalid", message: "workflow implement does not accept extra arguments." }
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
    reasons.push(profileState.message)
  }
  if (summary.plan !== "accepted") {
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

function runWorkflowGuard(guardKind: WorkflowGuardKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  const reasons = guardKind === "implement" ? implementationGuardReasons(summary) : finalGuardReasons(summary)
  if (reasons.length > 0) {
    return failedGuardOutput(guardKind, reasons)
  }
  return passedGuardOutput(guardKind)
}

function runWorkflowStart(runnerKind: WorkflowRunnerKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  const reasons = implementationGuardReasons(summary)
  if (reasons.length > 0) {
    return failedRunnerOutput("start", runnerKind, reasons)
  }
  return passedStartOutput(runnerKind)
}

function runWorkflowImplement(options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
  const reasons = implementationGuardReasons(summary)
  if (reasons.length > 0) {
    return failedRunnerOutput("implement", "implement", reasons)
  }
  return passedImplementOutput()
}

function runWorkflowFinish(runnerKind: WorkflowRunnerKind, options: WorkflowOptions): CliRunResult {
  const summary = readWorkflowStatus(options.projectDir)
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
  if (parsed.kind === "start") {
    return runWorkflowStart(parsed.runnerKind, options)
  }
  if (parsed.kind === "finish") {
    return runWorkflowFinish(parsed.runnerKind, options)
  }
  return { status: 0, stdout: `${formatWorkflowStatus(readWorkflowStatus(options.projectDir))}\n`, stderr: "" }
}
