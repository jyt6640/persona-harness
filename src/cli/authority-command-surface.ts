import { authorityEnrollmentFromReadback } from "./authority-enrollment.js"
import type { CliRunResult } from "./bearshell.js"

export type AuthorityStatus = {
  readonly authorityEligible: boolean
  readonly consumptionState: "consumed" | "not-applicable" | "unconsumed"
  readonly enrollment: "available" | "unavailable"
  readonly githubAuthentication: "available" | "unavailable"
  readonly next: "authority-enroll-github" | "authority-fetch-github" | "github-authenticate" | "workflow-finish"
  readonly state: "authentication-unavailable" | "enrollment-unavailable" | "missing" | "trusted"
}

export type AuthorityFetchArgs = {
  readonly json: boolean
  readonly repositorySlug?: string
}

export function authorityUsage(invocationName = "ph"): string {
  return [
    `Usage: ${invocationName} authority <status|explain|enroll|fetch> [args...]`,
    "",
    "Commands:",
    "  status [--json]                         Inspect non-consuming external authority readiness.",
    "  explain [--json]                        Explain the bounded next authority step.",
    "  enroll github <owner/repository> --workflow <path>",
    "                                         Interactively enroll a public GitHub workflow pin.",
    "  fetch github [owner/repository] [--json]",
    "                                         Fetch matching original public evidence without consuming it.",
  ].join("\n")
}

export function parseReadOnlyArgs(args: readonly string[]): { readonly json: boolean } | undefined {
  return args.length === 0 ? { json: false } : args.length === 1 && args[0] === "--json" ? { json: true } : undefined
}

export function parseFetchArgs(args: readonly string[]): AuthorityFetchArgs | undefined {
  if (args.length === 1 && args[0] === "github") return { json: false }
  if (args.length === 2 && args[0] === "github" && args[1] === "--json") return { json: true }
  const repositorySlug = args[1]
  if (args[0] !== "github" || !isPublicRepositorySlug(repositorySlug)) return undefined
  if (args.length === 2) return { json: false, repositorySlug }
  return args.length === 3 && args[2] === "--json" ? { json: true, repositorySlug } : undefined
}

export function parseEnrollmentArgs(args: readonly string[]): {
  readonly repositorySlug: string
  readonly workflowPath: string
} | undefined {
  if (args.length !== 4 || args[0] !== "github" || args[2] !== "--workflow") return undefined
  const repositorySlug = args[1]
  const workflowPath = args[3]
  const enrollment = authorityEnrollmentFromReadback({
    callerWorkflowPath: workflowPath,
    repositoryId: 1,
    repositorySlug: repositorySlug ?? "",
    reusableWorkflowSha: "a".repeat(40),
  })
  return enrollment === undefined || repositorySlug === undefined
    ? undefined
    : { repositorySlug, workflowPath: enrollment.callerWorkflowPath }
}

export function textStatus(summary: AuthorityStatus, explain: boolean): CliRunResult {
  const state = summary.state === "trusted" ? "TRUSTED" : "BLOCKED"
  return {
    status: summary.authorityEligible ? 0 : 1,
    stdout: [
      `Enrollment: ${summary.enrollment}`,
      `GitHub authentication: ${summary.githubAuthentication}`,
      `External authority: ${state}`,
      `Consumption: ${summary.consumptionState}`,
      `Next: ${nextText(summary.next, explain)}`,
    ].join("\n") + "\n",
    stderr: "",
  }
}

export function jsonStatus(summary: AuthorityStatus): CliRunResult {
  return {
    status: summary.authorityEligible ? 0 : 1,
    stdout: `${JSON.stringify({ schemaVersion: "consumer-authority-status.1", ...summary })}\n`,
    stderr: "",
  }
}

export function invalidAuthorityCommand(invocationName: string): CliRunResult {
  return { status: 1, stdout: "", stderr: `${authorityUsage(invocationName)}\n` }
}

export function blockedFetch(
  json: boolean,
  state: string,
  next: AuthorityStatus["next"] = "authority-fetch-github",
): CliRunResult {
  return {
    status: 1,
    stdout: json
      ? `${JSON.stringify({
        authorityEligible: false,
        consumptionState: "not-applicable",
        next,
        schemaVersion: "consumer-authority-fetch.1",
        state,
      })}\n`
      : `Consumer authority fetch: BLOCKED (${state}). No evidence was retained or consumed.\n`,
    stderr: "",
  }
}

export function githubAuthenticationRequired(): CliRunResult {
  return {
    status: 1,
    stdout: "",
    stderr: "GitHub authentication is required. Set GH_TOKEN or GITHUB_TOKEN to a credential with Actions read access for the public repository.\n",
  }
}

function nextText(next: AuthorityStatus["next"], explain: boolean): string {
  if (next === "github-authenticate") return explain
    ? "Set GH_TOKEN or GITHUB_TOKEN to a credential with Actions read access for the enrolled public repository."
    : "github-authenticate"
  if (next === "authority-enroll-github") return explain ? "Enroll a public GitHub workflow through an interactive confirmation." : "authority-enroll-github"
  if (next === "authority-fetch-github") return explain ? "Fetch matching original public evidence without consuming it." : "authority-fetch-github"
  return explain ? "Run workflow finish; only Finish may consume external authority." : "workflow-finish"
}

function isPublicRepositorySlug(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= 256
    && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(value)
    && !value.split("/").some((part) => part === "." || part === "..")
}
