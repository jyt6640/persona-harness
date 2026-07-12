import type { CliRunResult } from "./bearshell.js"

export type ParsedAttach =
  | { readonly kind: "help" }
  | { readonly kind: "invalid"; readonly message: string }
  | { readonly kind: "run"; readonly repair: boolean; readonly yes: boolean }

export function attachUsage(invocation = "ph"): string {
  return [
    `Usage: ${invocation} attach [--yes]`,
    `       ${invocation} attach --repair --yes`,
    "",
    "Prepare an existing Java/Spring/Gradle project for Persona Harness.",
    "",
    "--yes accepts the inferred draft without interactive edits.",
    "--repair upgrades only a recognized weak Persona Harness installation.",
    "Attach never overwrites unrecognized user files.",
  ].join("\n")
}

export function parseAttachArgs(args: readonly string[]): ParsedAttach {
  let repair = false
  let yes = false
  for (const arg of args) {
    if (arg === "--help" || arg === "-h" || arg === "help") {
      return { kind: "help" }
    }
    if (arg === "--repair" && !repair) {
      repair = true
      continue
    }
    if (arg === "--yes" && !yes) {
      yes = true
      continue
    }
    return { kind: "invalid", message: `Unknown or duplicate option: ${arg}` }
  }
  if (repair && !yes) {
    return { kind: "invalid", message: "--repair requires --yes." }
  }
  return { kind: "run", repair, yes }
}

export function attachBlocked(reason: string, action: string, command: string): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: [
      `Persona Harness Attach cannot start: ${reason}`,
      `Next action: ${action}`,
      `Next command: ${command}`,
      "",
    ].join("\n"),
  }
}
