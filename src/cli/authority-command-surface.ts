import { authorityEnrollmentFromReadback } from "./authority-enrollment.js"
import type { AuthorityArtifactTuple } from "./authority-artifact-binding.js"
import type { AuthorityBindingReason } from "./authority-artifact-binding.js"
import type { AuthoritySourceReason } from "./authority-artifact-binding.js"
import type { CliRunResult } from "./bearshell.js"
import type { GithubAuthorityFetchDiagnostic } from "./authority-fetch-worker.js"

export type AuthorityStatus = {
  readonly authorityEligible: boolean
  readonly consumptionState: "consumed" | "not-applicable" | "unconsumed"
  readonly enrollment: "available" | "unavailable"
  readonly githubAuthentication: "available" | "unavailable"
  readonly next: "authority-enroll-github" | "authority-fetch-github" | "github-authenticate" | "workflow-finish"
  readonly state: "authentication-unavailable" | "enrollment-unavailable" | "missing" | "trusted"
}

export type AuthorityFetchArgs = {
  readonly artifactTuple?: AuthorityArtifactTuple
  readonly json: boolean
  readonly repositorySlug?: string
}

export type AuthorityVerifyArgs = {
  readonly artifactPath: string
  readonly artifactTuple?: AuthorityArtifactTuple
  readonly json: boolean
  readonly repositorySlug?: string
}

export const AUTHORITY_VERIFY_REASONS = [
  "archive-digest-mismatch",
  "archive-invalid",
  "artifact-invalid",
  "binding-mismatch",
  "consumption-invalid",
  "crypto-invalid",
  "enrollment-unavailable",
  "package-provenance-unavailable",
  "runtime-unsupported",
  "selection-required",
  "source-mismatch",
  "stale",
  "trust-unavailable",
  "verification-unavailable",
] as const

export type AuthorityVerifyReason = typeof AUTHORITY_VERIFY_REASONS[number]

export function authorityUsage(invocationName = "ph"): string {
  return [
    `Usage: ${invocationName} authority <status|explain|enroll|fetch|verify> [args...]`,
    "",
    "Commands:",
    "  status [--json]                         Inspect non-consuming external authority readiness.",
    "  explain [--json]                        Explain the bounded next authority step.",
    "  enroll github <owner/repository> --workflow <path>",
    "                                         Interactively enroll a public GitHub workflow pin.",
    "  fetch github [owner/repository] --artifact-id <id> --run-id <id>",
    "    --source-head <sha> --artifact-digest <sha256> [--json]",
    "                                         Fetch one explicit original artifact without consuming it.",
    "  verify [owner/repository] --archive <path> --artifact-id <id> --run-id <id>",
    "    --source-head <sha> --artifact-digest <sha256> [--json]",
    "                                         Verify one supplied original archive without storing or consuming authority.",
  ].join("\n")
}

export function parseReadOnlyArgs(args: readonly string[]): { readonly json: boolean } | undefined {
  return args.length === 0 ? { json: false } : args.length === 1 && args[0] === "--json" ? { json: true } : undefined
}

export function parseFetchArgs(args: readonly string[]): AuthorityFetchArgs | undefined {
  if (args[0] !== "github") return undefined
  let cursor = 1
  const repositorySlug = args[cursor]?.startsWith("--") === false ? args[cursor++] : undefined
  if (repositorySlug !== undefined && !isPublicRepositorySlug(repositorySlug)) return undefined
  let json = false
  let artifactId: string | undefined
  let artifactDigest: string | undefined
  let runId: string | undefined
  let sourceHead: string | undefined
  while (cursor < args.length) {
    const flag = args[cursor++]
    if (flag === "--json" && !json) {
      json = true
      continue
    }
    const value = args[cursor++]
    if (value === undefined || value.startsWith("--")) return undefined
    switch (flag) {
      case "--artifact-id":
        if (artifactId !== undefined) return undefined
        artifactId = value
        break
      case "--artifact-digest":
        if (artifactDigest !== undefined) return undefined
        artifactDigest = value
        break
      case "--run-id":
        if (runId !== undefined) return undefined
        runId = value
        break
      case "--source-head":
        if (sourceHead !== undefined) return undefined
        sourceHead = value
        break
      default:
        return undefined
    }
  }
  const tuple = parseArtifactTuple(artifactId, artifactDigest, runId, sourceHead)
  return tuple === undefined
    ? { json, repositorySlug }
    : { artifactTuple: tuple, json, repositorySlug }
}

export function parseVerifyArgs(args: readonly string[]): AuthorityVerifyArgs | undefined {
  let cursor = 0
  const repositorySlug = args[cursor]?.startsWith("--") === false ? args[cursor++] : undefined
  if (repositorySlug !== undefined && !isPublicRepositorySlug(repositorySlug)) return undefined
  let artifactPath: string | undefined
  let json = false
  let artifactId: string | undefined
  let artifactDigest: string | undefined
  let runId: string | undefined
  let sourceHead: string | undefined
  while (cursor < args.length) {
    const flag = args[cursor++]
    if (flag === "--json" && !json) {
      json = true
      continue
    }
    const value = args[cursor++]
    if (value === undefined || value.startsWith("--")) return undefined
    switch (flag) {
      case "--archive":
        if (artifactPath !== undefined || !isArchivePath(value)) return undefined
        artifactPath = value
        break
      case "--artifact-id":
        if (artifactId !== undefined) return undefined
        artifactId = value
        break
      case "--artifact-digest":
        if (artifactDigest !== undefined) return undefined
        artifactDigest = value
        break
      case "--run-id":
        if (runId !== undefined) return undefined
        runId = value
        break
      case "--source-head":
        if (sourceHead !== undefined) return undefined
        sourceHead = value
        break
      default:
        return undefined
    }
  }
  if (artifactPath === undefined) return undefined
  const tuple = parseArtifactTuple(artifactId, artifactDigest, runId, sourceHead)
  return tuple === undefined
    ? { artifactPath, json, repositorySlug }
    : { artifactPath, artifactTuple: tuple, json, repositorySlug }
}

function parseArtifactTuple(
  artifactId: string | undefined,
  artifactDigest: string | undefined,
  runId: string | undefined,
  sourceHead: string | undefined,
): AuthorityArtifactTuple | undefined {
  if (artifactId === undefined && artifactDigest === undefined && runId === undefined && sourceHead === undefined) return undefined
  if (
    artifactId === undefined
    || artifactDigest === undefined
    || runId === undefined
    || sourceHead === undefined
    || !/^[1-9][0-9]{0,18}$/u.test(artifactId)
    || !/^[1-9][0-9]{0,18}$/u.test(runId)
    || !/^[a-f0-9]{40}$/iu.test(sourceHead)
    || !/^sha256:[a-f0-9]{64}$/iu.test(artifactDigest)
  ) return undefined
  const parsedArtifactId = Number(artifactId)
  return Number.isSafeInteger(parsedArtifactId)
    ? {
        artifactId: parsedArtifactId,
        artifactDigest: artifactDigest.toLowerCase(),
        runId,
        sourceHead: sourceHead.toLowerCase(),
      }
    : undefined
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
  diagnostic?: GithubAuthorityFetchDiagnostic,
  bindingReason?: AuthorityBindingReason,
  sourceReason?: AuthoritySourceReason,
): CliRunResult {
  const normalizedSourceReason = bindingReason === "source" ? sourceReason : undefined
  return {
    status: 1,
    stdout: json
      ? `${JSON.stringify({
        authorityEligible: false,
        consumptionState: "not-applicable",
        ...(diagnostic === undefined ? {} : { diagnostic }),
        ...(bindingReason === undefined ? {} : { bindingReason }),
        ...(normalizedSourceReason === undefined ? {} : { sourceReason: normalizedSourceReason }),
        next,
        schemaVersion: "consumer-authority-fetch.4",
        state,
      })}\n`
      : `Consumer authority fetch: BLOCKED (${state})${diagnostic === undefined ? "" : `; diagnostic: ${diagnostic}`}${bindingReason === undefined ? "" : `; binding reason: ${bindingReason}`}${normalizedSourceReason === undefined ? "" : `; source reason: ${normalizedSourceReason}`}. No evidence was retained or consumed.\n`,
    stderr: "",
  }
}

export function authorityVerifyResult(
  state: "blocked" | "trusted",
  reason: AuthorityVerifyReason | "none",
): CliRunResult {
  const trusted = state === "trusted"
  return {
    status: trusted ? 0 : 1,
    stdout: `${JSON.stringify({
      authorityEligible: trusted,
      consumptionState: trusted ? "unconsumed" : "not-applicable",
      reason,
      schemaVersion: "consumer-authority-verify.1",
      sourceFallback: false,
      state,
    })}\n`,
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

function isArchivePath(value: string): boolean {
  return value.length > 0 && value.length <= 4096 && !value.includes("\0")
}
