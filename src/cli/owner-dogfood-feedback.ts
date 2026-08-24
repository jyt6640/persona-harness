import { homedir } from "node:os"
import { isAbsolute, join, resolve } from "node:path"

import {
  OWNER_DOGFOOD_FEEDBACK_CODES,
  parseOwnerDogfoodFeedbackCode,
  recordOwnerDogfoodFeedback,
} from "./owner-dogfood-feedback-store.js"
import type { OwnerDogfoodFeedbackCode } from "./owner-dogfood-feedback-store.js"
import type { CliRunResult } from "./bearshell.js"

export type OwnerDogfoodFeedbackOptions = Readonly<{
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly homeDir?: string
  readonly now?: Date
}>

export function ownerDogfoodFeedbackUsage(invocationName: string): string {
  return [
    `Usage: ${invocationName} feedback dogfood <code>`,
    "",
    "Append one bounded, diagnostic-only owner dogfooding observation.",
    "No project files, workflow authority, release authority, or external authority changes.",
    "",
    "Codes:",
    ...OWNER_DOGFOOD_FEEDBACK_CODES.map((code) => `  ${code}`),
    "",
    "State directory:",
    "  default: ~/.local/state/persona-harness/owner-dogfood-feedback",
    "  events.jsonl is appended inside that directory.",
    "  Override root only with an absolute PH_OWNER_DOGFOOD_FEEDBACK_ROOT directory.",
  ].join("\n")
}

export function runOwnerDogfoodFeedbackCommand(
  args: readonly string[],
  options: OwnerDogfoodFeedbackOptions = {},
  invocationName = "ph",
): CliRunResult {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    return { status: 0, stdout: `${ownerDogfoodFeedbackUsage(invocationName)}\n`, stderr: "" }
  }
  const code = args.length === 1 ? parseOwnerDogfoodFeedbackCode(args[0]) : undefined
  if (code === undefined) {
    return blockedResult("invalid-observation", invocationName)
  }
  const root = resolveRoot(options)
  if (root === undefined || !recordOwnerDogfoodFeedback(root, code, options.now ?? new Date())) {
    return blockedResult("state-unavailable", invocationName)
  }
  return { status: 0, stdout: "Owner dogfooding feedback recorded. Diagnostic-only.\n", stderr: "" }
}

function resolveRoot(options: OwnerDogfoodFeedbackOptions): string | undefined {
  const env = options.env ?? process.env
  const override = env.PH_OWNER_DOGFOOD_FEEDBACK_ROOT
  if (override !== undefined) {
    return isSafeAbsolutePath(override) ? resolve(override) : undefined
  }
  const home = firstNonEmpty(env.HOME) ?? firstNonEmpty(env.USERPROFILE) ?? options.homeDir ?? homedir()
  if (!isSafeAbsolutePath(home)) return undefined
  return join(resolve(home), ".local", "state", "persona-harness", "owner-dogfood-feedback")
}

function firstNonEmpty(value: string | undefined): string | undefined {
  return value !== undefined && value.trim().length > 0 ? value : undefined
}

function isSafeAbsolutePath(path: string): boolean {
  return isAbsolute(path) && path.trim() === path && path.length > 0 && !path.includes("\0")
}


function blockedResult(reason: "invalid-observation" | "state-unavailable", invocationName: string): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: `Owner dogfooding feedback was not recorded (${reason}).\n\n${ownerDogfoodFeedbackUsage(invocationName)}\n`,
  }
}
