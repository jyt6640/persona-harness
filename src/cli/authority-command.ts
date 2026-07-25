import { writeAuthorityArtifact, type AuthorityArtifact } from "./authority-artifact-store.js"
import {
  authorityEnrollmentFromReadback,
  readAuthorityEnrollment,
  readAuthorityEnrollments,
  writeAuthorityEnrollment,
  type AuthorityEnrollment,
  type AuthorityEnrollmentReadback,
  type AuthorityEnrollmentStoreOptions,
} from "./authority-enrollment.js"
import { readGithubAuthorityEnrollment } from "./authority-github-readback-worker.js"
import { fetchGithubAuthorityArtifact } from "./authority-fetch-worker.js"
import { isAuthorityGithubToken } from "./authority-github-token.js"
import {
  authorityUsage,
  blockedFetch,
  githubAuthenticationRequired,
  invalidAuthorityCommand,
  jsonStatus,
  parseEnrollmentArgs,
  parseFetchArgs,
  parseReadOnlyArgs,
  textStatus,
  type AuthorityStatus,
} from "./authority-command-surface.js"
import { readEnrolledProjectFinishAttestations } from "./authority-project-attestation.js"
import {
  inspectProjectFinishAttestationArtifact,
  type ProjectFinishAttestationVerifierAssessment,
} from "./project-finish-attestation-verifier.js"
import type { CliRunResult } from "./bearshell.js"

type AuthorityCommandOptions = AuthorityEnrollmentStoreOptions & {
  readonly artifactFetch?: (projectDir: string, enrollment: AuthorityEnrollment) => AuthorityArtifact | undefined
  readonly artifactInspector?: (
    projectDir: string,
    enrollment: AuthorityEnrollment,
    archive: Buffer,
    now: Date,
  ) => ProjectFinishAttestationVerifierAssessment
  readonly confirmEnrollment?: boolean
  readonly enrollmentReadback?: (repositorySlug: string, workflowPath: string) => AuthorityEnrollmentReadback | undefined
  readonly githubToken?: string
  readonly projectDir?: string
}

export { authorityUsage } from "./authority-command-surface.js"
export {
  authorityEnrollmentFromReadback,
  readAuthorityEnrollment,
} from "./authority-enrollment.js"
export type { AuthorityStatus } from "./authority-command-surface.js"

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
    if (parsed === undefined) return invalidAuthorityCommand(invocationName)
    const summary = readAuthorityStatus(options)
    return parsed.json ? jsonStatus(summary) : textStatus(summary, command === "explain")
  }
  if (command === "enroll") {
    return runEnrollment(args.slice(1), options, invocationName)
  }
  if (command === "fetch") {
    return runFetch(args.slice(1), options, invocationName)
  }
  return invalidAuthorityCommand(invocationName)
}

function runEnrollment(
  args: readonly string[],
  options: AuthorityCommandOptions,
  invocationName: string,
): CliRunResult {
  const parsed = parseEnrollmentArgs(args)
  if (parsed === undefined) return invalidAuthorityCommand(invocationName)
  if (options.enrollmentReadback === undefined && !isAuthorityGithubToken(options.githubToken)) {
    return githubAuthenticationRequired()
  }
  if (!options.confirmEnrollment) {
    return {
      status: 1,
      stdout: "",
      stderr: "Consumer authority enrollment requires interactive confirmation.\n",
    }
  }
  const readback = (options.enrollmentReadback ?? ((repositorySlug, workflowPath) =>
    readGithubAuthorityEnrollment(
      options.projectDir ?? process.cwd(),
      repositorySlug,
      workflowPath,
      options.githubToken,
    )))(
    parsed.repositorySlug,
    parsed.workflowPath,
  )
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
  const parsed = parseFetchArgs(args)
  if (parsed === undefined) return invalidAuthorityCommand(invocationName)
  const entries = readAuthorityEnrollments(options)
  if (entries.state !== "ready") {
    const summary = readAuthorityStatus(options)
    return parsed.json ? jsonStatus(summary) : textStatus(summary, false)
  }
  const enrollment = parsed.repositorySlug === undefined
    ? entries.value.length === 1 ? entries.value[0] : undefined
    : entries.value.find((entry) => entry.repositorySlug === parsed.repositorySlug)
  if (enrollment === undefined && entries.value.length > 1 && parsed.repositorySlug === undefined) {
    return blockedFetch(parsed.json, "selection-required")
  }
  if (enrollment === undefined) return blockedFetch(parsed.json, "missing")
  const projectDir = options.projectDir ?? process.cwd()
  if (options.artifactFetch === undefined && !isAuthorityGithubToken(options.githubToken)) {
    return blockedFetch(parsed.json, "authentication-unavailable", "github-authenticate")
  }
  const artifact = options.artifactFetch === undefined
    ? fetchGithubAuthorityArtifact(projectDir, enrollment, options.githubToken, options.now ?? new Date())
    : options.artifactFetch(projectDir, enrollment)
  if (artifact === undefined || artifact.repositoryId !== enrollment.repositoryId) {
    return blockedFetch(parsed.json, "missing")
  }
  const assessment = (options.artifactInspector ?? inspectProjectFinishAttestationArtifact)(
    projectDir,
    enrollment,
    artifact.archive,
    options.now ?? new Date(),
  )
  if (!assessment.authorityEligible || !writeAuthorityArtifact(artifact, options)) {
    return blockedFetch(parsed.json, assessment.state)
  }
  return {
    status: 0,
    stdout: parsed.json
      ? `${JSON.stringify({
        authorityEligible: true,
        consumptionState: assessment.consumptionState,
        next: "workflow-finish",
        schemaVersion: "consumer-authority-fetch.1",
        state: "trusted",
      })}\n`
      : "Fetched and verified matching original public evidence. No completion authority was consumed.\n",
    stderr: "",
  }
}

export function readAuthorityStatus(options: AuthorityCommandOptions = {}): AuthorityStatus {
  const projectDir = options.projectDir ?? process.cwd()
  const githubAuthentication = isAuthorityGithubToken(options.githubToken) ? "available" : "unavailable"
  const projectAttestations = readEnrolledProjectFinishAttestations(projectDir, options, options.now)
  if (projectAttestations.enrollmentState !== "ready") {
    return {
      authorityEligible: false,
      consumptionState: "not-applicable",
      enrollment: "unavailable",
      githubAuthentication,
      next: githubAuthentication === "available" ? "authority-enroll-github" : "github-authenticate",
      state: githubAuthentication === "available" ? "enrollment-unavailable" : "authentication-unavailable",
    }
  }
  const trusted = projectAttestations.values.find((candidate) => candidate.assessment.authorityEligible)?.assessment
  if (trusted !== undefined) {
    return {
      authorityEligible: true,
      consumptionState: trusted.consumptionState === "consumed" ? "consumed" : "unconsumed",
      enrollment: "available",
      githubAuthentication,
      next: "workflow-finish",
      state: "trusted",
    }
  }
  return {
    authorityEligible: false,
    consumptionState: "not-applicable",
    enrollment: "available",
    githubAuthentication,
    next: githubAuthentication === "available" ? "authority-fetch-github" : "github-authenticate",
    state: githubAuthentication === "available" ? "missing" : "authentication-unavailable",
  }
}
