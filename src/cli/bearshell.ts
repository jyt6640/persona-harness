import process from "node:process"

import { writeBearshellExecutionEvidence } from "../runtime/execution-evidence.js"
import { runBoundedProcess, type BoundedProcessResult } from "./bounded-process.js"

export type CliRunResult = {
  readonly status: number
  readonly stdout: string
  readonly stderr: string
}

type BearshellOptions = {
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
}

type ParsedBearshellArgs =
  | {
      readonly kind: "help"
      readonly json: boolean
    }
  | {
      readonly kind: "invalid"
      readonly json: boolean
      readonly message: string
    }
  | {
      readonly kind: "exec"
      readonly json: boolean
      readonly shell: false
      readonly budget: number
      readonly timeoutMs: number
      readonly command: string
      readonly args: readonly string[]
    }
  | {
      readonly kind: "exec"
      readonly json: boolean
      readonly shell: true
      readonly budget: number
      readonly timeoutMs: number
      readonly command: string
      readonly args: readonly []
    }

const DEFAULT_BUDGET = 20_000
const DEFAULT_TIMEOUT_MS = 30_000
const MIN_BUDGET = 80
const MIN_TIMEOUT_MS = 1

export function bearshellUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} bearshell <command> [args...]`,
    `   or: ${invocation} bearshell [--json] [--budget <chars>] <command> [args...]`,
    `   or: ${invocation} bearshell --shell '<shell command>'`,
    "",
    "Runs a bounded shell-native command helper for Persona Harness.",
    "Shell metacharacters are interpreted only with explicit --shell opt-in.",
    "",
    "Windows PowerShell pipelines: prefer no `--shell`.",
    "- Pass PowerShell as the command so pipes stay inside PowerShell.",
    '- `npx ph bearshell powershell -NoProfile -Command "Select-String -Path README.md -Pattern TODO"`',
    "- Avoid project-root or `.persona` root recursive search; it can traverse node_modules or package/vendor files.",
    "- Do not wrap Windows PowerShell pipelines in Unix-style single quotes.",
    "",
    "Environment:",
    "- PH_BEARSHELL_CONDENSE=0 disables output condensation.",
    "- PH_BEARSHELL_CONDENSE_BUDGET overrides the default condensation budget.",
    "- PH_BEARSHELL_TIMEOUT_MS overrides the default 30000ms command timeout.",
    "- PH_BEARSHELL_SPARK=0 is accepted for OMO compatibility; this MVP uses deterministic condensation only.",
  ].join("\n")
}

export function runBearshell(args: readonly string[], options: BearshellOptions = {}, invocationName = "ph"): CliRunResult {
  const env = options.env ?? {}
  const parsed = parseBearshellArgs(args, env)

  if (parsed.kind === "help") {
    return formatResult({ status: 0, stdout: `${bearshellUsage(invocationName)}\n`, stderr: "" }, parsed.json)
  }

  if (parsed.kind === "invalid") {
    return formatResult({ status: 1, stdout: "", stderr: `${parsed.message}\n\n${bearshellUsage(invocationName)}\n` }, parsed.json)
  }

  const childEnv = env
  const startedMs = Date.now()
  const invocation = parsed.shell
    ? shellInvocation(parsed.command)
    : { args: parsed.args, command: parsed.command }
  const spawned = runBoundedProcess({
    args: invocation.args,
    command: invocation.command,
    cwd: options.cwd,
    env: childEnv,
    graceMs: 5_000,
    timeoutMs: parsed.timeoutMs,
  })

  const status = spawned.status
  const endedMs = Date.now()
  const stdout = maybeCondense(toOutputString(spawned.stdout), parsed.budget, env)
  const stderr = maybeCondense(
    processErrorMessage(parsed.command, spawned, parsed.timeoutMs) ?? toOutputString(spawned.stderr),
    parsed.budget,
    env,
  )
  writeBearshellExecutionEvidence(options.cwd ?? process.cwd(), {
    command: commandText(parsed),
    durationMs: Math.max(0, endedMs - startedMs),
    endedAt: new Date(endedMs).toISOString(),
    status,
    stderr,
    stdout,
  })

  return formatResult({ status, stdout, stderr }, parsed.json)
}

function commandText(parsed: Extract<ParsedBearshellArgs, { readonly kind: "exec" }>): string {
  const command = parsed.shell ? parsed.command : [parsed.command, ...parsed.args].join(" ")
  return boundedDiagnosticText(command)
}

function shellInvocation(command: string): { readonly args: readonly string[]; readonly command: string } {
  if (process.platform === "win32") {
    return {
      args: ["/d", "/s", "/c", command],
      command: process.env.ComSpec ?? "cmd.exe",
    }
  }
  return {
    args: ["-c", command],
    command: process.env.SHELL ?? "/bin/sh",
  }
}

function parseBearshellArgs(args: readonly string[], env: Readonly<Record<string, string | undefined>>): ParsedBearshellArgs {
  let json = false
  let shell = false
  let budget = readBudget(env["PH_BEARSHELL_CONDENSE_BUDGET"]) ?? DEFAULT_BUDGET
  const timeoutMs = readTimeoutMs(env["PH_BEARSHELL_TIMEOUT_MS"])
  if (timeoutMs === null) {
    return { kind: "invalid", json, message: "PH_BEARSHELL_TIMEOUT_MS requires a positive integer" }
  }
  const positional: string[] = []

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === undefined) {
      continue
    }
    if (arg === "--help" || arg === "-h") {
      return { kind: "help", json }
    }
    if (arg === "--json") {
      json = true
      continue
    }
    if (arg === "--shell") {
      shell = true
      const command = args[index + 1]
      if (command === undefined || command.length === 0) {
        return { kind: "invalid", json, message: "--shell requires a command string" }
      }
      return { kind: "exec", json, shell: true, budget, timeoutMs, command, args: [] }
    }
    if (arg === "--budget") {
      const value = args[index + 1]
      if (value === undefined) {
        return { kind: "invalid", json, message: "--budget requires a positive integer" }
      }
      const parsedBudget = readBudget(value)
      if (parsedBudget === null) {
        return { kind: "invalid", json, message: "--budget requires a positive integer" }
      }
      budget = parsedBudget
      index += 1
      continue
    }
    positional.push(arg)
  }

  if (positional.length === 0) {
    return { kind: "help", json }
  }

  const command = positional[0]
  if (command === undefined) {
    return { kind: "help", json }
  }

  return { kind: "exec", json, shell: false, budget, timeoutMs, command, args: positional.slice(1) }
}

function readBudget(value: string | undefined): number | null {
  if (value === undefined || value.trim().length === 0) {
    return DEFAULT_BUDGET
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) {
    return null
  }
  return Math.max(parsed, MIN_BUDGET)
}

function readTimeoutMs(value: string | undefined): number | null {
  if (value === undefined || value.trim().length === 0) {
    return DEFAULT_TIMEOUT_MS
  }
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < MIN_TIMEOUT_MS) {
    return null
  }
  return parsed
}

function maybeCondense(output: string, budget: number, env: Readonly<Record<string, string | undefined>>): string {
  if (env["PH_BEARSHELL_CONDENSE"] === "0") {
    return output
  }
  if (output.length <= budget) {
    return output
  }

  const markerBudget = 96
  const contentBudget = Math.max(MIN_BUDGET, budget - markerBudget)
  const headLength = Math.floor(contentBudget * 0.6)
  const tailLength = contentBudget - headLength
  const head = output.slice(0, headLength).trimEnd()
  const tail = output.slice(output.length - tailLength).trimStart()
  const omitted = output.length - head.length - tail.length

  return [
    head,
    `[bearshell condensed] original chars: ${output.length}; budget: ${budget}; omitted: ${omitted}`,
    tail,
  ].join("\n")
}

function formatResult(result: CliRunResult, json: boolean): CliRunResult {
  if (!json) {
    return result
  }

  return {
    status: result.status,
    stdout: `${JSON.stringify(result)}\n`,
    stderr: "",
  }
}

function toOutputString(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function processErrorMessage(command: string, result: BoundedProcessResult, timeoutMs: number): string | undefined {
  const displayCommand = boundedDiagnosticText(command)
  switch (result.outcome) {
    case "output-limit":
      return `[bearshell] command output exceeded the bounded capture limit\n`
    case "signal":
      return `[bearshell] command terminated by ${result.signal ?? "signal"}: ${displayCommand}\n`
    case "spawn-failure":
      return `[bearshell] failed to launch ${displayCommand}: ${boundedDiagnosticText(result.stderr)}\n`
    case "timeout":
      return `[bearshell] command timed out after ${timeoutMs}ms: ${displayCommand}\n`
    case "failed":
    case "passed":
      return undefined
    default:
      return assertNever(result.outcome)
  }
}

function boundedDiagnosticText(value: string): string {
  const maxChars = 512
  if (value.length <= maxChars) {
    return value
  }
  const headChars = Math.floor(maxChars * 0.6)
  const tailChars = maxChars - headChars
  return `${value.slice(0, headChars)}...[truncated]...${value.slice(-tailChars)}`
}

function assertNever(value: never): never {
  throw new TypeError(`Unknown bounded process outcome: ${String(value)}`)
}
