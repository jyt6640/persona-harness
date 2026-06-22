import type { CliRunResult } from "./bearshell.js"
import { formatWorkflowStatus, readWorkflowStatus } from "./workflow-status.js"

type WorkflowOptions = {
  readonly projectDir?: string
}

type ParsedWorkflowArgs = { readonly kind: "check" } | { readonly kind: "help" } | { readonly kind: "invalid"; readonly message: string }

export function workflowUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} workflow check`,
    "",
    "Checks Persona Harness workflow artifacts before or after implementation.",
    "",
    "Scope:",
    "- report-only workflow status",
    "- no generated app quality certification",
  ].join("\n")
}

function parseWorkflowArgs(args: readonly string[]): ParsedWorkflowArgs {
  if (args.length === 0 || args[0] === "check") {
    return args.length <= 1 ? { kind: "check" } : { kind: "invalid", message: "workflow check does not accept extra arguments." }
  }
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { kind: "help" }
  }
  return { kind: "invalid", message: `Unknown workflow command: ${args[0]}` }
}

export function runWorkflowCommand(args: readonly string[], options: WorkflowOptions = {}, invocationName = "ph"): CliRunResult {
  const parsed = parseWorkflowArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${workflowUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${workflowUsage(invocationName)}\n` }
  }
  return { status: 0, stdout: `${formatWorkflowStatus(readWorkflowStatus(options.projectDir))}\n`, stderr: "" }
}
