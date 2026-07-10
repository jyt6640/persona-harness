import { resolve } from "node:path"

import type { CliRunResult } from "./bearshell.js"
import { GoWorkflowConflictError } from "./go-conflict.js"
import { acquireGoCommandLock, releaseGoCommandLock } from "./go-lock.js"
import {
  goBlockedOutput,
  goExistingStateBlocker,
  goSetupBlocker,
  goWorkflowBoundaryBlocker,
} from "./go-preflight.js"
import {
  beginGoWorkflowTransaction,
  closeGoWorkflowTransaction,
  commitGoWorkflowTransaction,
  type GoWorkflowTransaction,
} from "./go-transaction.js"
import { stdinEncodingError } from "./stdin-text.js"
import { runWorkflowCommand } from "./workflow-command.js"
import {
  runWorkflowCapture,
  runWorkflowNext,
  runWorkflowSplit,
} from "./workflow-tickets.js"

export type GoStep = "capture" | "implement" | "next" | "split"

type GoCommandOptions = {
  readonly onAfterGoCommitFile?: (relativePath: string) => void
  readonly onAfterGoTransactionCopy?: () => void
  readonly onBeforeGoStep?: (step: GoStep) => void
  readonly projectDir?: string
  readonly stdin?: string
}

type ParsedGoArgs =
  | { readonly kind: "goal"; readonly source: "argument"; readonly text: string }
  | { readonly kind: "goal"; readonly source: "stdin"; readonly text: string }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function goUsage(invocationName = "ph"): string {
  return [
    `Usage: ${invocationName} go "<concrete implementation goal>"`,
    `       ${invocationName} go --stdin`,
    "",
    "Capture one concrete implementation requirement, create workflow tickets, select the current ticket, and print the existing implementation rail.",
    "",
    "This command requires an initialized harness, a ready project profile, and an accepted plan.",
    "It does not bootstrap, enable runtime hooks, or route vague product ideas; use workflow draft for idea-first requirements.",
  ].join("\n")
}

function parseGoArgs(args: readonly string[], stdin: string | undefined): ParsedGoArgs {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    return { kind: "help" }
  }
  if (args.includes("--stdin") && args.length !== 1) {
    return { kind: "invalid", message: "ph go accepts either one positional goal or --stdin, not both." }
  }
  if (args.length === 1 && args[0] === "--stdin") {
    const text = stdin ?? ""
    return text.trim().length === 0
      ? { kind: "invalid", message: "ph go --stdin requires a non-empty concrete implementation goal." }
      : { kind: "goal", source: "stdin", text }
  }
  const option = args.find((arg) => arg.startsWith("-") && !arg.startsWith("- "))
  if (option !== undefined) {
    return { kind: "invalid", message: `Unknown ph go option: ${option}` }
  }
  if (args.length !== 1 || (args[0] ?? "").trim().length === 0) {
    return { kind: "invalid", message: "ph go requires one quoted concrete implementation goal or --stdin." }
  }
  return { kind: "goal", source: "argument", text: args[0] ?? "" }
}

function runStep(
  step: GoStep,
  options: GoCommandOptions,
  operation: () => CliRunResult,
): CliRunResult {
  options.onBeforeGoStep?.(step)
  return operation()
}

function rollbackFailure(
  step: GoStep,
  result: CliRunResult,
): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Persona Harness Go failed during ${step}; pre-command workflow state restored.`,
      result.stderr.trimEnd(),
    ].filter((line) => line.length > 0).join("\n") + "\n",
  }
}

function successOutput(source: "argument" | "stdin", next: CliRunResult, implement: CliRunResult): CliRunResult {
  return {
    status: 0,
    stdout: [
      "Persona Harness Go",
      "",
      "Status: ready",
      `Goal source: ${source}`,
      "Requirements: captured",
      "Tickets: split",
      "Current ticket: selected",
      "",
      next.stdout.trimEnd(),
      "",
      implement.stdout.trimEnd(),
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function runGoCommand(
  args: readonly string[],
  options: GoCommandOptions = {},
  invocationName = "ph",
): CliRunResult {
  const parsed = parseGoArgs(args, options.stdin)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${goUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${goUsage(invocationName)}\n` }
  }
  if (parsed.source === "stdin") {
    const encodingError = stdinEncodingError(parsed.text)
    if (encodingError !== undefined) {
      return { status: 1, stdout: "", stderr: `${encodingError}\n` }
    }
  }

  const projectDir = resolve(options.projectDir ?? process.cwd())
  const blocker = goSetupBlocker(projectDir) ?? goWorkflowBoundaryBlocker(projectDir)
  if (blocker !== undefined) {
    return blocker
  }

  const lock = acquireGoCommandLock(projectDir)
  if (lock === undefined) {
    return goBlockedOutput("another ph go command is already running.", "npx ph workflow check")
  }
  try {
    const stateBlocker = goExistingStateBlocker(projectDir)
    if (stateBlocker !== undefined) {
      return stateBlocker
    }
    let transaction: GoWorkflowTransaction
    try {
      transaction = beginGoWorkflowTransaction(projectDir, {
        onAfterCopy: options.onAfterGoTransactionCopy,
      })
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      return error instanceof GoWorkflowConflictError
        ? goBlockedOutput("workflow state changed while ph go was running.", "npx ph workflow check")
        : {
            status: 1,
            stdout: "",
            stderr: "Persona Harness Go failed.\nReason: unexpected workflow or filesystem error.\n",
          }
    }
    try {
      const stagedProjectDir = transaction.stagingProjectDir
      const capture = runStep("capture", options, () => runWorkflowCapture({ projectDir: stagedProjectDir, stdin: parsed.text }))
      if (capture.status !== 0) {
        return rollbackFailure("capture", capture)
      }
      const split = runStep("split", options, () => runWorkflowSplit(undefined, { projectDir: stagedProjectDir }))
      if (split.status !== 0) {
        return rollbackFailure("split", split)
      }
      const next = runStep("next", options, () => runWorkflowNext({ projectDir: stagedProjectDir }))
      if (next.status !== 0) {
        return rollbackFailure("next", next)
      }
      const implement = runStep("implement", options, () =>
        runWorkflowCommand(["implement", "--full"], { projectDir: stagedProjectDir }, invocationName)
      )
      if (implement.status !== 0) {
        return rollbackFailure("implement", implement)
      }
      commitGoWorkflowTransaction(transaction, {
        onAfterCreateFile: options.onAfterGoCommitFile,
      })
      return successOutput(parsed.source, next, implement)
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error
      }
      if (error instanceof GoWorkflowConflictError) {
        return goBlockedOutput("workflow state changed while ph go was running.", "npx ph workflow check")
      }
      return {
        status: 1,
        stdout: "",
        stderr: [
          "Persona Harness Go failed; pre-command workflow state restored.",
          "Reason: unexpected workflow or filesystem error.",
        ].join("\n") + "\n",
      }
    } finally {
      closeGoWorkflowTransaction(transaction)
    }
  } finally {
    releaseGoCommandLock(lock)
  }
}
