#!/usr/bin/env node
import process from "node:process"
import { fileURLToPath } from "node:url"

import { runInitCommand } from "./init.js"
import { type CliRunResult, runBearshell } from "./bearshell.js"
import { runHistoryCommand } from "./history.js"
import { runIntakeCommand } from "./intake.js"
import { runPlanCommand } from "./plan.js"

type PersonaCliOptions = {
  readonly cwd?: string
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly invocationName?: string
  readonly packageRoot?: string
}

export function runPersonaCli(args: readonly string[], options: PersonaCliOptions = {}): CliRunResult {
  const command = args[0]
  const invocationName = options.invocationName ?? "ph"

  if (command === "init") {
    return runInitCommand({ projectDir: options.cwd, packageRoot: options.packageRoot })
  }

  if (command === "intake") {
    return runIntakeCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === "plan") {
    return runPlanCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === "history") {
    return runHistoryCommand(args.slice(1), { projectDir: options.cwd }, invocationName)
  }

  if (command === "bearshell") {
    return runBearshell(args.slice(1), { cwd: options.cwd, env: options.env })
  }

  if (command === undefined || command === "--help" || command === "-h") {
    return { status: 0, stdout: `${personaCliUsage(invocationName)}\n`, stderr: "" }
  }

  return {
    status: 1,
    stdout: "",
    stderr: `Unknown command: ${command}\n\n${personaCliUsage(invocationName)}\n`,
  }
}

function personaCliUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} <command> [args...]`,
    "",
    "Commands:",
    "  init                         Install Persona Harness config into the current project.",
    "  intake                       Create a draft backend project profile for planning.",
    "  plan                         Create a blackbear architecture plan draft before implementation.",
    "  history                      Archive completed workflow artifacts into local history.",
    "  bearshell <command> [args...] Run a bounded command helper for repo inspection and smoke tests.",
    "",
    "Examples:",
    `  ${invocationName} init`,
    `  ${invocationName} intake`,
    `  ${invocationName} plan`,
    `  ${invocationName} history --id run-001`,
    `  ${invocationName} bearshell npm test`,
    `  ${invocationName} bearshell --shell 'git status --short && npm test'`,
  ].join("\n")
}

function writeResult(result: CliRunResult): void {
  if (result.stdout.length > 0) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr)
  }
  process.exitCode = result.status
}

function isCliEntrypoint(): boolean {
  const entrypoint = process.argv[1]
  if (entrypoint === undefined) {
    return false
  }
  const normalized = entrypoint.replace(/\\/g, "/")
  return entrypoint === fileURLToPath(import.meta.url) || normalized.endsWith("/persona-harness") || normalized.endsWith("/ph")
}

if (isCliEntrypoint()) {
  writeResult(
    runPersonaCli(process.argv.slice(2), {
      cwd: process.cwd(),
      env: process.env,
      invocationName: process.argv[1]?.endsWith("/persona-harness") ? "persona-harness" : "ph",
    }),
  )
}
