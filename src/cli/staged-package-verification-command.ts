import type { CliRunResult } from "./bearshell.js"
import { runStagedPackageVerification } from "./staged-package-verification-runner.js"

const REQUIRED_FLAGS = ["--plan", "--preflight", "--registry-facts", "--tarball"] as const

type RequiredFlag = (typeof REQUIRED_FLAGS)[number]

type ParsedArgs =
  | {
      readonly json: boolean
      readonly kind: "run"
      readonly planPath: string
      readonly preflightPath: string
      readonly registryFactsPath: string
      readonly tarballPath: string
    }
  | { readonly kind: "help" }
  | { readonly kind: "invalid" }

function isRequiredFlag(value: string): value is RequiredFlag {
  return value === "--plan"
    || value === "--preflight"
    || value === "--registry-facts"
    || value === "--tarball"
}

function parseArgs(args: readonly string[]): ParsedArgs {
  if (args.length === 1 && (args[0] === "--help" || args[0] === "-h" || args[0] === "help")) {
    return { kind: "help" }
  }

  const values = new Map<RequiredFlag, string>()
  let json = false
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index]
    if (argument === "--json") {
      if (json) return { kind: "invalid" }
      json = true
      continue
    }
    if (!isRequiredFlag(argument)) return { kind: "invalid" }
    const value = args[index + 1]
    if (value === undefined || value.startsWith("--") || values.has(argument)) return { kind: "invalid" }
    values.set(argument, value)
    index += 1
  }

  const planPath = values.get("--plan")
  const preflightPath = values.get("--preflight")
  const registryFactsPath = values.get("--registry-facts")
  const tarballPath = values.get("--tarball")
  return planPath === undefined || preflightPath === undefined || registryFactsPath === undefined || tarballPath === undefined
    ? { kind: "invalid" }
    : { json, kind: "run", planPath, preflightPath, registryFactsPath, tarballPath }
}

export function stagedPackageVerificationUsage(invocation = "ph dev staged-package"): string {
  return [
    `Usage: ${invocation} --plan <path> --preflight <path> --registry-facts <path> --tarball <path> [--json]`,
    "",
    "Reads bounded release facts and verifies a fresh exact-version package install.",
    "It never publishes, tags, moves a dist-tag, or authorizes channel promotion.",
  ].join("\n")
}

function formatResult(result: ReturnType<typeof runStagedPackageVerification>): string {
  return [
    `Staged package verification: ${result.verificationStatus.toUpperCase()}`,
    `Promotion decision: ${result.promotionDecision.toUpperCase()}`,
    "Registry mutation: NOT PERFORMED",
    "Durable sanitized evidence: REQUIRED BEFORE CLOSURE",
    ...(result.diagnostics.length === 0 ? ["Diagnostics: none"] : [`Diagnostics: ${result.diagnostics.join(", ")}`]),
  ].join("\n")
}

export function runStagedPackageVerificationCommand(
  args: readonly string[],
  invocation = "ph dev staged-package",
): CliRunResult {
  const parsed = parseArgs(args)
  if (parsed.kind === "help") {
    return { status: 0, stdout: `${stagedPackageVerificationUsage(invocation)}\n`, stderr: "" }
  }
  if (parsed.kind === "invalid") {
    return { status: 1, stdout: "", stderr: `${stagedPackageVerificationUsage(invocation)}\n` }
  }

  const result = runStagedPackageVerification(parsed)
  return {
    status: result.verificationStatus === "verified" ? 0 : 1,
    stdout: parsed.json ? `${JSON.stringify(result, null, 2)}\n` : `${formatResult(result)}\n`,
    stderr: "",
  }
}
