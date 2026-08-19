import {
  proposePersonalizationCandidate,
  PersonalizationStoreError,
  readPersonalizationStore,
  resolvePersonalizationCandidate,
  rollbackPersonalizationRule,
  type PersonalizationScope,
  type PersonalizationStoreOptions,
} from "./personalization-profile-store.js"
import type { CliRunResult } from "./bearshell.js"

export type PhilosophyCommandOptions = PersonalizationStoreOptions & {
  readonly stdin?: string
}

export function philosophyUsage(invocationName = "ph"): string {
  return [
    `Usage: ${invocationName} philosophy <status|init|propose|resolve|history|rollback>`,
    "",
    "Commands:",
    "  status                         Inspect starter/profile state without creating files.",
    "  init                           Inspect the same starter/profile state.",
    "  propose --stdin [--pending]   Validate one structured candidate from stdin.",
    "  resolve <id> <action>          Resolve pending candidate: retain, exception, supersede, or pending.",
    "  history                        Print bounded append-only decision history.",
    "  rollback <rule-id>             Append a rollback decision for one active rule.",
  ].join("\n")
}

export function runPhilosophyCommand(
  args: readonly string[],
  options: PhilosophyCommandOptions = {},
  invocationName = "ph",
): CliRunResult {
  const command = args[0]
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    return success(`${philosophyUsage(invocationName)}\n`)
  }
  try {
    if (command === "status" || command === "init") return runStatus(args.slice(1), options, command)
    if (command === "propose") return runPropose(args.slice(1), options)
    if (command === "resolve") return runResolve(args.slice(1), options)
    if (command === "history") return runHistory(args.slice(1), options)
    if (command === "rollback") return runRollback(args.slice(1), options)
    return failure("personalization-command-invalid")
  } catch (error: unknown) {
    if (error instanceof PersonalizationStoreError) return failure(error.code)
    return failure("personalization-store-internal")
  }
}

function runStatus(args: readonly string[], options: PhilosophyCommandOptions, command: "status" | "init"): CliRunResult {
  if (args.length !== 0) return failure("personalization-command-invalid")
  const document = readPersonalizationStore(options)
  return success(`${JSON.stringify({
    activeRules: document.profile.activeRules.length,
    command,
    pendingCandidates: document.profile.pendingCandidates.length,
    starter: true,
    store: document.profile.activeRules.length === 0 && document.profile.pendingCandidates.length === 0 ? "uninitialized" : "active",
  })}\n`)
}

function runPropose(args: readonly string[], options: PhilosophyCommandOptions): CliRunResult {
  if (args[0] !== "--stdin" && !args.includes("--stdin")) return failure("personalization-candidate-invalid")
  const extra = args.filter((arg) => arg !== "--stdin")
  if (extra.length > 1 || (extra.length === 1 && extra[0] !== "--pending")) return failure("personalization-command-invalid")
  if (options.stdin === undefined || options.stdin.trim() === "") return failure("personalization-candidate-invalid")
  let candidate: unknown
  try {
    candidate = JSON.parse(options.stdin) as unknown
  } catch {
    return failure("personalization-candidate-invalid")
  }
  const result = proposePersonalizationCandidate(candidate, options, extra[0] === "--pending")
  if (result.status === "conflict") return { status: 1, stdout: `${JSON.stringify({ status: result.status })}\n`, stderr: "personalization-candidate-conflict\n" }
  return success(`${JSON.stringify({ status: result.status })}\n`)
}

function runResolve(args: readonly string[], options: PhilosophyCommandOptions): CliRunResult {
  const candidateId = args[0]
  const action = args[1]
  if (candidateId === undefined || action === undefined || !["retain", "exception", "supersede", "pending"].includes(action)) return failure("personalization-resolution-invalid")
  const scopeArgs = args.slice(2)
  const parsed = parseScopeArgs(scopeArgs)
  if (scopeArgs.length > 0 && parsed === undefined) return failure("personalization-resolution-invalid")
  const result = resolvePersonalizationCandidate(candidateId, action as "retain" | "exception" | "supersede" | "pending", options, parsed)
  return success(`${JSON.stringify({ status: result.status })}\n`)
}

function runHistory(args: readonly string[], options: PhilosophyCommandOptions): CliRunResult {
  if (args.length !== 0) return failure("personalization-command-invalid")
  const document = readPersonalizationStore(options)
  return success(`${JSON.stringify({ events: document.history.events })}\n`)
}

function runRollback(args: readonly string[], options: PhilosophyCommandOptions): CliRunResult {
  if (args.length !== 1) return failure("personalization-rule-missing")
  const result = rollbackPersonalizationRule(args[0], options)
  return success(`${JSON.stringify({ status: result.status })}\n`)
}

function parseScopeArgs(args: readonly string[]): PersonalizationScope | undefined {
  if (args.length === 0) return undefined
  if (args.length !== 4 || args[0] !== "--scope" || args[2] !== "--scope-key") return undefined
  if (args[1] !== "project" && args[1] !== "task") return undefined
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/u.test(args[3])) return undefined
  return { kind: args[1], key: args[3] }
}

function success(stdout: string): CliRunResult {
  return { status: 0, stdout, stderr: "" }
}

function failure(code: string): CliRunResult {
  return { status: 1, stdout: "", stderr: `${code}\n` }
}
