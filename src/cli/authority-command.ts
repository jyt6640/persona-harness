import { inspectProjectFinishAttestation } from "./project-finish-attestation-verifier.js"
import {
  authorityEnrollmentFromReadback,
  readAuthorityEnrollment,
  readAuthorityEnrollments,
  writeAuthorityEnrollment,
  type AuthorityEnrollment,
  type AuthorityEnrollmentReadback,
  type AuthorityEnrollmentStoreOptions,
} from "./authority-enrollment.js"
import type { CliRunResult } from "./bearshell.js"

type AuthorityCommandOptions = AuthorityEnrollmentStoreOptions & {
  readonly confirmEnrollment?: boolean
  readonly enrollmentReadback?: (repositorySlug: string, workflowPath: string) => AuthorityEnrollmentReadback | undefined
  readonly projectDir?: string
}

type AuthorityStatus = {
  readonly authorityEligible: boolean
  readonly consumptionState: "consumed" | "not-applicable" | "unconsumed"
  readonly enrollment: "available" | "unavailable"
  readonly next: "authority-enroll-github" | "authority-fetch-github" | "workflow-finish"
  readonly state: "enrollment-unavailable" | "missing" | "trusted"
}

export {
  authorityEnrollmentFromReadback,
  readAuthorityEnrollment,
} from "./authority-enrollment.js"

export function authorityUsage(invocationName = "ph"): string {
  return [
    `Usage: ${invocationName} authority <status|explain|enroll|fetch> [args...]`,
    "",
    "Commands:",
    `  status [--json]                         Inspect non-consuming external authority readiness.`,
    `  explain [--json]                        Explain the bounded next authority step.`,
    `  enroll github <owner/repository> --workflow <path>`,
    "                                         Interactively enroll a public GitHub workflow pin.",
    "  fetch github [--json]                   Fetch matching original public evidence without consuming it.",
  ].join("\n")
}

export function runAuthorityCommand(
  args: readonly string[],
  options: AuthorityCommandOptions = {},
  invocationName = "ph",
): CliRunResult {
  const command = args[0]
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    return { status: 0, stdout: `${authorityUsage(invocationName)}\n`, stderr: "" }
  }
  if (command === "status" || command === "explain") {
    const parsed = parseReadOnlyArgs(args.slice(1))
    if (parsed === undefined) return invalid(invocationName)
    const summary = readAuthorityStatus(options)
    return parsed.json ? jsonStatus(summary) : textStatus(summary, command === "explain")
  }
  if (command === "enroll") {
    return runEnrollment(args.slice(1), options, invocationName)
  }
  if (command === "fetch") {
    return runFetch(args.slice(1), options, invocationName)
  }
  return invalid(invocationName)
}

function runEnrollment(
  args: readonly string[],
  options: AuthorityCommandOptions,
  invocationName: string,
): CliRunResult {
  const parsed = parseEnrollmentArgs(args)
  if (parsed === undefined) return invalid(invocationName)
  if (!options.confirmEnrollment) {
    return {
      status: 1,
      stdout: "",
      stderr: "Consumer authority enrollment requires interactive confirmation.\n",
    }
  }
  const readback = options.enrollmentReadback?.(parsed.repositorySlug, parsed.workflowPath)
  const enrollment = readback === undefined ? undefined : authorityEnrollmentFromReadback(readback, options.now)
  if (enrollment === undefined || enrollment.repositorySlug !== parsed.repositorySlug || enrollment.callerWorkflowPath !== parsed.workflowPath) {
    return { status: 1, stdout: "", stderr: "Consumer authority enrollment could not verify the fixed public GitHub policy.\n" }
  }
  if (!writeAuthorityEnrollment(enrollment, options)) {
    return { status: 1, stdout: "", stderr: "Consumer authority enrollment could not be stored safely.\n" }
  }
  return {
    status: 0,
    stdout: "Consumer authority enrollment recorded. No completion authority was consumed.\n",
    stderr: "",
  }
}

function runFetch(args: readonly string[], options: AuthorityCommandOptions, invocationName: string): CliRunResult {
  const parsed = parseReadOnlyArgs(args)
  if (parsed === undefined) return invalid(invocationName)
  const summary = readAuthorityStatus(options)
  if (summary.enrollment === "unavailable") {
    return parsed.json ? jsonStatus(summary) : textStatus(summary, false)
  }
  return {
    status: 1,
    stdout: parsed.json
      ? `${JSON.stringify({ ...summary, state: "fetch-unavailable" })}\n`
      : "Consumer authority fetch is unavailable until the fixed original-artifact transport is present.\n",
    stderr: "",
  }
}

function readAuthorityStatus(options: AuthorityCommandOptions): AuthorityStatus {
  const projectDir = options.projectDir ?? process.cwd()
  const entries = readAuthorityEnrollments(options)
  if (entries.state !== "ready" || entries.value.length === 0) {
    return {
      authorityEligible: false,
      consumptionState: "not-applicable",
      enrollment: "unavailable",
      next: "authority-enroll-github",
      state: "enrollment-unavailable",
    }
  }
  const assessments = entries.value.map((entry) => inspectProjectFinishAttestation(projectDir, entry, options.now))
  const trusted = assessments.find((assessment) => assessment.authorityEligible)
  if (trusted !== undefined) {
    return {
      authorityEligible: true,
      consumptionState: trusted.consumptionState === "consumed" ? "consumed" : "unconsumed",
      enrollment: "available",
      next: "workflow-finish",
      state: "trusted",
    }
  }
  return {
    authorityEligible: false,
    consumptionState: "not-applicable",
    enrollment: "available",
    next: "authority-fetch-github",
    state: "missing",
  }
}

function parseReadOnlyArgs(args: readonly string[]): { readonly json: boolean } | undefined {
  return args.length === 0 ? { json: false } : args.length === 1 && args[0] === "--json" ? { json: true } : undefined
}

function parseEnrollmentArgs(args: readonly string[]): { readonly repositorySlug: string; readonly workflowPath: string } | undefined {
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

function textStatus(summary: AuthorityStatus, explain: boolean): CliRunResult {
  const state = summary.state === "trusted" ? "TRUSTED" : "BLOCKED"
  return {
    status: summary.authorityEligible ? 0 : 1,
    stdout: [
      `Enrollment: ${summary.enrollment}`,
      `External authority: ${state}`,
      `Consumption: ${summary.consumptionState}`,
      `Next: ${nextText(summary.next, explain)}`,
    ].join("\n") + "\n",
    stderr: "",
  }
}

function jsonStatus(summary: AuthorityStatus): CliRunResult {
  return {
    status: summary.authorityEligible ? 0 : 1,
    stdout: `${JSON.stringify({ schemaVersion: "consumer-authority-status.1", ...summary })}\n`,
    stderr: "",
  }
}

function nextText(next: AuthorityStatus["next"], explain: boolean): string {
  if (next === "authority-enroll-github") return explain ? "Enroll a public GitHub workflow through an interactive confirmation." : "authority-enroll-github"
  if (next === "authority-fetch-github") return explain ? "Fetch matching original public evidence without consuming it." : "authority-fetch-github"
  return explain ? "Run workflow finish; only Finish may consume external authority." : "workflow-finish"
}

function invalid(invocationName: string): CliRunResult {
  return { status: 1, stdout: "", stderr: `${authorityUsage(invocationName)}\n` }
}
