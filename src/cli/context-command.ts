import process from "node:process"

import { runContextExplainCommand } from "./context-explain.js"
import { runContextInitCommand } from "./context-init.js"
import { runContextPreviewCommand } from "./context-preview.js"
import { renderContextDoctor } from "./context-doctor.js"
import { readContextStatus, renderContextStatus } from "./context-status.js"
import type { PersonalizationStoreOptions } from "./personalization-profile-store.js"

export type ContextCommandResult = {
  readonly status: 0 | 1
  readonly stdout: string
  readonly stderr: string
}

export type ContextCommandOptions = {
  readonly personalization?: PersonalizationStoreOptions
  readonly projectDir?: string
}

export function runContextCommand(
  args: readonly string[],
  invocationName: string = "ph",
  options: ContextCommandOptions = {},
): ContextCommandResult {
  const command = args[0]

  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    return success(`${contextUsage(invocationName)}\n`)
  }

  if (command === "init") {
    return runContextInitCommand(args.slice(1), options.projectDir ?? process.cwd())
  }

  if (command === "status") {
    if (args.length !== 1) return invalidArguments(invocationName)
    return success(renderContextStatus(readContextStatus(options.projectDir ?? process.cwd())))
  }

  if (command === "doctor") {
    if (args.length !== 1) return invalidArguments(invocationName)
    return success(renderContextDoctor(readContextStatus(options.projectDir ?? process.cwd())))
  }

  if (command === "preview") {
    return runContextPreviewCommand(args.slice(1), options.projectDir ?? process.cwd(), {
      personalization: options.personalization,
    })
  }

  if (command === "explain") {
    return runContextExplainCommand(args.slice(1), options.projectDir ?? process.cwd(), {
      personalization: options.personalization,
    })
  }

  return failure(`Unknown context command.\n\n${contextUsage(invocationName)}\n`)
}

export function contextUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} context <init|status|preview|explain|doctor>`,
    "",
    "Context Personalization (Experimental, default-off)",
    "",
    "Commands:",
    "  init [--enable]              Preview initialization, or explicitly create Context config.",
    "  status                       Show the bounded local Context state.",
    "  preview <target-file> [--json] [--project <key>] [--task <key>] [--topic <topic>]",
    "  explain <target-file> [--project <key>] [--task <key>] [--topic <topic>]",
    "  doctor                       Diagnose only the local Context track.",
    "",
    "Preview and explanation are read-only; init writes only with explicit --enable.",
  ].join("\n")
}

function invalidArguments(invocationName: string): ContextCommandResult {
  return failure(`context-arguments-invalid\n\n${contextUsage(invocationName)}\n`)
}

function success(stdout: string): ContextCommandResult {
  return { status: 0, stdout, stderr: "" }
}

function failure(stderr: string): ContextCommandResult {
  return { status: 1, stdout: "", stderr }
}
