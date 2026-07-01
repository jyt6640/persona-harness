import type { WorkflowGuardKind, WorkflowRunnerKind } from "./workflow-output.js"
import { workflowTicketUsage } from "./workflow-tickets.js"

export type ParsedWorkflowArgs =
  | { readonly kind: "check" }
  | { readonly kind: "implement" }
  | { readonly kind: "test" }
  | { readonly kind: "continue" }
  | { readonly closureAction: "next" | "status"; readonly kind: "closure" }
  | { readonly kind: "relay"; readonly relayArgs: readonly string[] }
  | { readonly kind: "guard"; readonly guardKind: WorkflowGuardKind }
  | { readonly kind: "start"; readonly runnerKind: WorkflowRunnerKind }
  | { readonly kind: "finish"; readonly runnerKind: WorkflowRunnerKind }
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
    `Usage: ${invocation} workflow <check|implement|test|continue|closure|relay|roles|draft|approve|capture|split|next|archive|start implement|finish implement|guard implement|guard final>`,
    "",
    "Checks or guards Persona Harness workflow artifacts before or after implementation.",
    "",
    "Scope:",
    "- workflow check is report-only except opt-in TDD green evidence capture when enforce.tdd is enabled",
    "- workflow implement prints a single AI-facing implementation rail",
    "- workflow test records opt-in TDD red evidence from PH-run strict Gradle/JUnit verification",
    "- workflow continue prints the accepted-plan continuation prompt",
    "- workflow closure status/next --json prints read-only closure state and next steps",
    "- workflow relay status/next/validate --json prints the read-only multi-agent relay preview",
    "- workflow roles writes and prints non-autonomous role boundaries",
    "- workflow start/finish are AI-facing workflow rails",
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
    return args.length <= 1 ? { kind: "check" } : { kind: "invalid", message: "workflow check does not accept extra arguments." }
  }
  if (args[0] === "implement") {
    return args.length === 1 ? { kind: "implement" } : { kind: "invalid", message: "workflow implement does not accept extra arguments." }
  }
  if (args[0] === "test") {
    return args.length === 1 ? { kind: "test" } : { kind: "invalid", message: "workflow test does not accept extra arguments." }
  }
  if (args[0] === "continue") {
    return args.length === 1 ? { kind: "continue" } : { kind: "invalid", message: "workflow continue does not accept extra arguments." }
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
