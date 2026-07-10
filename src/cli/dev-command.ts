import type { CliRunResult } from "./bearshell.js"
import { runBearshell } from "./bearshell.js"
import { runEvidenceCommand } from "./evidence-summary.js"
import { runFeedbackCommand } from "./feedback.js"
import { runObserveCommand } from "./observe.js"
import { runReviewCommand } from "./review.js"
import { runSmokeCommand } from "./smoke.js"
import { runWorkflowCommand } from "./workflow-command.js"

type DevOptions = {
  readonly env?: Readonly<Record<string, string | undefined>>
  readonly projectDir?: string
}

export function devUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} dev <evidence|smoke|feedback|ralph-loop|observe|bearshell|review> [args...]`,
    "",
    "Discover developer and measurement commands without changing their direct command paths.",
    "",
    "Commands:",
    `  evidence ...                 Alias for ${invocation} evidence ...`,
    `  smoke                        Alias for ${invocation} smoke`,
    `  feedback                     Alias for ${invocation} feedback`,
    `  ralph-loop [--dry-run] [--json] Alias for ${invocation} workflow ralph-loop`,
    `  observe [--json] <path>      Alias for ${invocation} observe`,
    `  bearshell <command> [args...] Alias for ${invocation} bearshell`,
    `  review backend-shape         Alias for ${invocation} review backend-shape`,
    "",
    "Existing direct command paths remain supported.",
  ].join("\n")
}

export function runDevCommand(args: readonly string[], options: DevOptions = {}, invocationName = "ph"): CliRunResult {
  const devInvocation = `${invocationName} dev`
  const command = args[0]
  if (command === undefined || command === "--help" || command === "-h" || command === "help") {
    return { status: 0, stdout: `${devUsage(invocationName)}\n`, stderr: "" }
  }
  if (command === "evidence") {
    return runEvidenceCommand(args.slice(1), options, devInvocation)
  }
  if (command === "smoke") {
    return runSmokeCommand(args.slice(1), options, devInvocation)
  }
  if (command === "feedback") {
    return runFeedbackCommand(args.slice(1), options, devInvocation)
  }
  if (command === "ralph-loop") {
    return runWorkflowCommand(["ralph-loop", ...args.slice(1)], options, devInvocation)
  }
  if (command === "observe") {
    return runObserveCommand(args.slice(1), options, devInvocation)
  }
  if (command === "bearshell") {
    return runBearshell(args.slice(1), { cwd: options.projectDir, env: options.env }, devInvocation)
  }
  if (command === "review") {
    return runReviewCommand(args.slice(1), options, devInvocation)
  }
  return {
    status: 1,
    stdout: "",
    stderr: `Unknown dev command: ${command}\n\n${devUsage(invocationName)}\n`,
  }
}
