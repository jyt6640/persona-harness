import type { CliRunResult } from "./bearshell.js"
import { runBackendShapeReview } from "./backend-shape.js"

type ReviewOptions = {
  readonly projectDir?: string
}

type ParsedReviewArgs =
  | { readonly kind: "backend-shape" }
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }

export function reviewUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} review backend-shape`,
    "",
    "Writes report-only observations about generated Java/Spring backend shape.",
    "",
    "Scope:",
    "- report-only backend Clean Code shape observation",
    "- no product-quality certification",
    "- no rule enforcement",
  ].join("\n")
}

function parseReviewArgs(args: readonly string[]): ParsedReviewArgs {
  if (args.length === 1 && args[0] === "backend-shape") {
    return { kind: "backend-shape" }
  }
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    return { kind: "help" }
  }
  return { kind: "invalid", message: args.length === 0 ? "Missing review command." : `Unknown review command: ${args.join(" ")}` }
}

export function runReviewCommand(args: readonly string[], options: ReviewOptions = {}, invocationName = "ph"): CliRunResult {
  const parsed = parseReviewArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${reviewUsage(invocationName)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${parsed.message}\n\n${reviewUsage(invocationName)}\n` }
  }
  return runBackendShapeReview(options)
}
