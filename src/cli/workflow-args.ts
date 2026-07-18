import type { WorkflowGuardKind, WorkflowRunnerKind } from "./workflow-output.js"
import { workflowTicketUsage } from "./workflow-tickets.js"
import type { FinishAssuranceRequirement } from "./workflow-verification-decision.js"

export type ParsedWorkflowArgs =
  | { readonly full: boolean; readonly kind: "check" }
  | { readonly full: boolean; readonly kind: "implement" }
  | { readonly kind: "test" }
  | { readonly kind: "tdd" }
  | { readonly full: boolean; readonly kind: "continue" }
  | {
      readonly dryRun: boolean
      readonly graceMs: number
      readonly json: boolean
      readonly kind: "loop"
      readonly maxIterations: number
      readonly opencodeCommand: string
      readonly timeoutMs: number
    }
  | { readonly json: boolean; readonly kind: "ralph-loop" }
  | { readonly json: boolean; readonly kind: "role-boundary" }
  | { readonly closureAction: "next" | "status"; readonly kind: "closure" }
  | { readonly kind: "relay"; readonly relayArgs: readonly string[] }
  | { readonly kind: "guard"; readonly guardKind: WorkflowGuardKind }
  | { readonly kind: "start"; readonly runnerKind: WorkflowRunnerKind }
  | {
      readonly assurance: FinishAssuranceRequirement
      readonly ci: boolean
      readonly kind: "finish"
      readonly reverify: boolean
      readonly runnerKind: WorkflowRunnerKind
    }
  | { readonly kind: "draft" }
  | { readonly kind: "approve-requirements" }
  | { readonly kind: "capture" }
  | { readonly kind: "split"; readonly sourceFile?: string }
  | { readonly kind: "next" }
  | { readonly kind: "archive"; readonly ticketId: string }
  | { readonly kind: "roles" }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function workflowUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} workflow <check|implement|test|tdd|continue|loop|ralph-loop|role-boundary|closure|relay|roles|draft|approve|capture|split|next|archive|start implement|finish implement|guard implement|guard final>`,
    "",
    "Checks or guards Persona Harness workflow artifacts before or after implementation.",
    "",
    "Scope:",
    "- workflow check is report-only except opt-in TDD green evidence capture when enforce.tdd is enabled",
    "- workflow implement prints a single AI-facing implementation rail",
    "- workflow test records opt-in TDD red evidence from PH-run strict Gradle/JUnit verification",
    "- workflow tdd prints read-only TDD red→green status and next action",
    "- workflow continue prints the accepted-plan continuation prompt",
    "- workflow check/implement/continue accept --full to bypass same-workspace rail body cache",
    "- workflow loop runs an explicit capped fresh-session blocker loop using PH finish/closure gates",
    "- workflow ralph-loop [--dry-run] [--json] previews default-off blocker-driven continuation eligibility",
    "- workflow role-boundary [--json] reports likely relay role-boundary issues without blocking writes",
    "- workflow closure status/next --json prints read-only closure state and next steps",
    "- workflow relay status/next/validate --json prints the read-only Role Checklist Relay preview",
    "- workflow roles writes and prints non-autonomous role boundaries",
    "- workflow start/finish are AI-facing workflow rails",
    "- workflow finish implement --reverify [--ci] runs fresh POSIX Java/Spring/Gradle-wrapper verification before the existing finish gate",
    "- workflow finish implement requires a trusted Persona Harness or external authority receipt; unsigned project-local evidence is diagnostic-only",
    "- workflow draft/approve/capture/split/next/archive manage requirement-derived task tickets",
    "- workflow guard uses strict exit codes for AI-facing workflow discipline",
    "- no generated app quality certification",
    "",
    "Ticket commands:",
    workflowTicketUsage(invocation),
  ].join("\n")
}

export function parseWorkflowArgs(args: readonly string[]): ParsedWorkflowArgs {
  if (args.length === 0 || args[0] === "check") {
    return parseFullOnlyArgs(args.slice(args[0] === "check" ? 1 : 0), "check")
  }
  if (args[0] === "implement") {
    return parseFullOnlyArgs(args.slice(1), "implement")
  }
  if (args[0] === "test") {
    return args.length === 1 ? { kind: "test" } : { kind: "invalid", message: "workflow test does not accept extra arguments." }
  }
  if (args[0] === "tdd") {
    return args.length === 1 ? { kind: "tdd" } : { kind: "invalid", message: "workflow tdd does not accept extra arguments." }
  }
  if (args[0] === "continue") {
    return parseFullOnlyArgs(args.slice(1), "continue")
  }
  if (args[0] === "loop") {
    return parseWorkflowLoopArgs(args.slice(1))
  }
  if (args[0] === "ralph-loop") {
    const flags = args.slice(1)
    if (!flags.every((flag) => flag === "--dry-run" || flag === "--json")) {
      return { kind: "invalid", message: "workflow ralph-loop accepts only --dry-run and --json." }
    }
    return { json: flags.includes("--json"), kind: "ralph-loop" }
  }
  if (args[0] === "role-boundary") {
    const flags = args.slice(1)
    if (!flags.every((flag) => flag === "--json")) {
      return { kind: "invalid", message: "workflow role-boundary accepts only --json." }
    }
    return { json: flags.includes("--json"), kind: "role-boundary" }
  }
  if (args[0] === "closure") {
    if ((args[1] === "status" || args[1] === "next") && args.length === 3 && args[2] === "--json") {
      return { closureAction: args[1], kind: "closure" }
    }
    return { kind: "invalid", message: "workflow closure requires status --json or next --json." }
  }
  if (args[0] === "relay") {
    return { kind: "relay", relayArgs: args.slice(1) }
  }
  if (args[0] === "roles") {
    return args.length === 1 ? { kind: "roles" } : { kind: "invalid", message: "workflow roles does not accept extra arguments." }
  }
  if (args[0] === "draft") {
    if (args.length !== 2 || args[1] !== "--stdin") {
      return { kind: "invalid", message: "workflow draft requires --stdin." }
    }
    return { kind: "draft" }
  }
  if (args[0] === "approve") {
    if (args.length !== 2 || args[1] !== "requirements") {
      return { kind: "invalid", message: "workflow approve requires requirements." }
    }
    return { kind: "approve-requirements" }
  }
  if (args[0] === "capture") {
    if (args.length !== 2 || args[1] !== "--stdin") {
      return { kind: "invalid", message: "workflow capture requires --stdin." }
    }
    return { kind: "capture" }
  }
  if (args[0] === "split") {
    if (args.length > 2) {
      return { kind: "invalid", message: "workflow split accepts at most one source markdown file." }
    }
    return args[1] === undefined ? { kind: "split" } : { kind: "split", sourceFile: args[1] }
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
    return parseWorkflowFinishArgs(args.slice(1))
  }
  if (args[0] === "--help" || args[0] === "-h" || args[0] === "help") {
    return { kind: "help" }
  }
  return { kind: "invalid", message: `Unknown workflow command: ${args[0]}` }
}

function parseWorkflowFinishArgs(args: readonly string[]): ParsedWorkflowArgs {
  if (args[0] !== "implement") {
    return args.length === 0
      ? { kind: "invalid", message: "workflow finish requires implement." }
      : { kind: "invalid", message: `Unknown workflow finish: ${args[0]}` }
  }
  let assurance: FinishAssuranceRequirement = "external"
  let ci = false
  let reverify = false
  for (let index = 1; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--reverify") {
      if (reverify) return { kind: "invalid", message: "workflow finish implement does not accept duplicate flags." }
      reverify = true
      continue
    }
    if (arg === "--ci") {
      if (ci) return { kind: "invalid", message: "workflow finish implement does not accept duplicate flags." }
      ci = true
      continue
    }
    if (arg === "--assurance") {
      if (assurance === "cooperative" || args[index + 1] !== "cooperative") {
        return { kind: "invalid", message: "workflow finish implement accepts only --assurance cooperative." }
      }
      assurance = "cooperative"
      index += 1
      continue
    }
    return { kind: "invalid", message: "workflow finish implement accepts only --reverify, --ci, and --assurance cooperative." }
  }
  if (assurance === "cooperative" && (reverify || ci)) {
    return { kind: "invalid", message: "workflow finish implement --assurance cooperative does not accept --reverify or --ci." }
  }
  if (ci && !reverify) {
    return { kind: "invalid", message: "workflow finish --ci requires --reverify." }
  }
  return { assurance, ci, kind: "finish", reverify, runnerKind: "implement" }
}

function parseFullOnlyArgs(args: readonly string[], kind: "check" | "continue" | "implement"): ParsedWorkflowArgs {
  if (args.length === 0) {
    return { full: false, kind }
  }
  if (args.length === 1 && args[0] === "--full") {
    return { full: true, kind }
  }
  return { kind: "invalid", message: `workflow ${kind} accepts only --full.` }
}

function parseWorkflowLoopArgs(args: readonly string[]): ParsedWorkflowArgs {
  let dryRun = false
  let json = false
  let maxIterations = 3
  let timeoutMs = 600_000
  let graceMs = 5_000
  let opencodeCommand = "opencode"
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === "--dry-run") {
      dryRun = true
      continue
    }
    if (arg === "--json") {
      json = true
      continue
    }
    if (arg === "--max-iterations") {
      const parsed = readPositiveIntegerArg(args[index + 1])
      if (parsed === null) {
        return { kind: "invalid", message: "--max-iterations requires a positive integer." }
      }
      maxIterations = parsed
      index += 1
      continue
    }
    if (arg === "--timeout-ms") {
      const parsed = readPositiveIntegerArg(args[index + 1])
      if (parsed === null) {
        return { kind: "invalid", message: "--timeout-ms requires a positive integer." }
      }
      timeoutMs = parsed
      index += 1
      continue
    }
    if (arg === "--grace-ms") {
      const parsed = readNonNegativeIntegerArg(args[index + 1])
      if (parsed === null) {
        return { kind: "invalid", message: "--grace-ms requires a non-negative integer." }
      }
      graceMs = parsed
      index += 1
      continue
    }
    if (arg === "--opencode-command") {
      const value = args[index + 1]
      if (value === undefined || value.trim().length === 0) {
        return { kind: "invalid", message: "--opencode-command requires a command path." }
      }
      opencodeCommand = value
      index += 1
      continue
    }
    return { kind: "invalid", message: `Unknown workflow loop option: ${arg}` }
  }
  return { dryRun, graceMs, json, kind: "loop", maxIterations, opencodeCommand, timeoutMs }
}

function readPositiveIntegerArg(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function readNonNegativeIntegerArg(value: string | undefined): number | null {
  if (value === undefined) {
    return null
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}
