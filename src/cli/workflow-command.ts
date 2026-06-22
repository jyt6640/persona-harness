import type { CliRunResult } from "./bearshell.js"
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"

type WorkflowOptions = {
  readonly projectDir?: string
}

type WorkflowGuardKind = "implement" | "final"

type ParsedWorkflowArgs =
  | { readonly kind: "check" }
  | { readonly kind: "guard"; readonly guardKind: WorkflowGuardKind }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function workflowUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} workflow <check|guard implement|guard final>`,
    "",
    "Checks or guards Persona Harness workflow artifacts before or after implementation.",
    "",
    "Scope:",
    "- workflow check is report-only",
    "- workflow guard uses strict exit codes for AI-facing workflow discipline",
    "- no generated app quality certification",
  ].join("\n")
}

function parseWorkflowArgs(args: readonly string[]): ParsedWorkflowArgs {
  if (args.length === 0 || args[0] === "check") {
    return args.length <= 1 ? { kind: "check" } : { kind: "invalid", message: "workflow check does not accept extra arguments." }
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
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { kind: "help" }
  }
  return { kind: "invalid", message: `Unknown workflow command: ${args[0]}` }
}

function failedGuardOutput(guardKind: WorkflowGuardKind, reasons: readonly string[]): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Workflow guard failed: ${guardKind}`,
      "",
      "Required fixes:",
      ...reasons.map((reason) => `- ${reason}`),
      "",
      "This is a workflow-state gate only. It does not certify generated app product quality.",
    ].join("\n") + "\n",
  }
}

function passedGuardOutput(guardKind: WorkflowGuardKind): CliRunResult {
  const nextLine =
    guardKind === "implement"
      ? "Implementation may start. Run `npx ph plan --implement`, then implement from the accepted plan."
      : "Workflow evidence is complete; final answer may be reported."
  return {
    status: 0,
    stdout: [
      `Persona Harness Workflow Guard: ${guardKind}`,
      "",
      "Guard status: PASS",
      nextLine,
      "",
      "Scope:",
      "- AI-facing workflow discipline gate",
      "- no generated app product-quality certification",
    ].join("\n") + "\n",
    stderr: "",
  }
}

function implementationGuardReasons(summary: ReturnType<typeof readWorkflowStatus>): readonly string[] {
  const reasons: string[] = []
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
  if (summary.commandDisciplineFinding !== "PASS") {
    reasons.push(summary.commandDiscipline)
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
  return { status: 0, stdout: `${formatWorkflowStatus(readWorkflowStatus(options.projectDir))}\n`, stderr: "" }
}
