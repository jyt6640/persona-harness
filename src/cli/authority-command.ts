import { createHash } from "node:crypto"
import { dirname, join, resolve } from "node:path"

import { writeAuthorityArtifact, type AuthorityArtifact } from "./authority-artifact-store.js"
import {
  classifyAuthorityBindingReason,
  classifyAuthoritySourceReason,
  classifyAuthorityArtifactTupleReason,
  matchesAuthorityArtifactTuple,
  matchesAuthorityArtifactBinding,
  type AuthorityArtifactTuple,
} from "./authority-artifact-binding.js"
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
  authorityVerifyResult,
  blockedFetch,
  githubAuthenticationRequired,
  invalidAuthorityCommand,
  jsonStatus,
  parseEnrollmentArgs,
  parseFetchArgs,
  parseReadOnlyArgs,
  parseVerifyArgs,
  type AuthorityVerifyReason,
  textStatus,
  type AuthorityStatus,
} from "./authority-command-surface.js"
import { readEnrolledProjectFinishAttestations } from "./authority-project-attestation.js"
import { captureGitIdentity, captureWorkspaceIdentity } from "./ci-reverification-identity.js"
import {
  inspectProjectFinishAttestationArtifact,
  type ProjectFinishAttestationVerifierAssessment,
} from "./project-finish-attestation-verifier.js"
import type { CliRunResult } from "./bearshell.js"
import {
  captureNoFollowDirectory,
  readNoFollowRegularFile,
  sameNoFollowPathIdentity,
  type NoFollowPathIdentity,
} from "../io/no-follow-file.js"
import { personaHarnessVersion } from "./version.js"

type AuthorityCommandOptions = AuthorityEnrollmentStoreOptions & {
  readonly artifactFetch?: (projectDir: string, enrollment: AuthorityEnrollment, expected: AuthorityArtifactTuple) => AuthorityArtifact | undefined
  readonly artifactInspector?: (
    projectDir: string,
    enrollment: AuthorityEnrollment,
    archive: Buffer,
    now: Date,
  ) => ProjectFinishAttestationVerifierAssessment
  readonly confirmEnrollment?: boolean
  readonly enrollmentReadback?: (repositorySlug: string, workflowPath: string) => AuthorityEnrollmentReadback | undefined
  readonly githubToken?: string
  readonly packageRoot?: string
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
  if (command === "verify") {
    return runVerify(args.slice(1), options)
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
  if (parsed.artifactTuple === undefined) return blockedFetch(parsed.json, "selection-required")
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
  const fetched = options.artifactFetch === undefined
    ? fetchGithubAuthorityArtifact(projectDir, enrollment, parsed.artifactTuple, options.githubToken, options.now ?? new Date())
    : { artifact: options.artifactFetch(projectDir, enrollment, parsed.artifactTuple), kind: "ready" as const }
  if (fetched.kind === "blocked") {
    return blockedFetch(parsed.json, "missing", "authority-fetch-github", fetched.diagnostic)
  }
  const artifact = fetched.artifact
  if (artifact === undefined || artifact.repositoryId !== enrollment.repositoryId) {
    return blockedFetch(parsed.json, "missing")
  }
  if (!matchesAuthorityArtifactTuple(artifact, parsed.artifactTuple)) {
    return blockedFetch(
      parsed.json,
      "binding-mismatch",
      "authority-fetch-github",
      undefined,
      classifyAuthorityArtifactTupleReason(artifact, parsed.artifactTuple),
    )
  }
  const assessment = (options.artifactInspector ?? inspectProjectFinishAttestationArtifact)(
    projectDir,
    enrollment,
    artifact.archive,
    options.now ?? new Date(),
  )
  if (!matchesAuthorityArtifactBinding(artifact, enrollment, assessment)) {
    const bindingReason = classifyAuthorityBindingReason(artifact, enrollment, assessment)
    return blockedFetch(
      parsed.json,
      "binding-mismatch",
      "authority-fetch-github",
      undefined,
      bindingReason,
      bindingReason === "source" ? classifyAuthoritySourceReason(artifact, assessment) : undefined,
    )
  }
  if (!writeAuthorityArtifact(artifact, options)) {
    return blockedFetch(parsed.json, "binding-mismatch")
  }
  return {
    status: 0,
    stdout: parsed.json
      ? `${JSON.stringify({
        authorityEligible: true,
        artifact: {
          digest: artifact.artifactDigest,
          id: artifact.artifactId,
          runId: artifact.runId,
          sourceHead: artifact.sourceHead,
        },
        consumptionState: assessment.consumptionState,
        next: "workflow-finish",
        schemaVersion: "consumer-authority-fetch.4",
        state: "trusted",
      })}\n`
      : "Fetched and verified matching original public evidence. Artifact identity was retained. No completion authority was consumed.\n",
    stderr: "",
  }
}

function runVerify(args: readonly string[], options: AuthorityCommandOptions): CliRunResult {
  const parsed = parseVerifyArgs(args)
  if (parsed === undefined || parsed.artifactTuple === undefined) {
    return authorityVerifyResult("blocked", "selection-required")
  }
  if (!hasInstalledPackageProvenance(options.packageRoot)) {
    return authorityVerifyResult("blocked", "package-provenance-unavailable")
  }
  const archive = readExplicitArchive(parsed.artifactPath)
  if (archive === undefined) return authorityVerifyResult("blocked", "archive-invalid")
  const actualDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`
  if (actualDigest !== parsed.artifactTuple.artifactDigest) {
    return authorityVerifyResult("blocked", "archive-digest-mismatch")
  }

  const entries = readAuthorityEnrollments(options)
  if (entries.state !== "ready") return authorityVerifyResult("blocked", "enrollment-unavailable")
  const enrollment = parsed.repositorySlug === undefined
    ? entries.value.length === 1 ? entries.value[0] : undefined
    : entries.value.find((entry) => entry.repositorySlug === parsed.repositorySlug)
  if (enrollment === undefined) {
    return authorityVerifyResult(
      "blocked",
      entries.value.length > 1 && parsed.repositorySlug === undefined
        ? "selection-required"
        : "enrollment-unavailable",
    )
  }

  const projectDir = options.projectDir ?? process.cwd()
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") return authorityVerifyResult("blocked", "source-mismatch")
  const git = captureGitIdentity(projectDir, workspace.value)
  if (!git.available || git.head !== parsed.artifactTuple.sourceHead) {
    return authorityVerifyResult("blocked", "source-mismatch")
  }
  const now = options.now ?? new Date()
  const artifact: AuthorityArtifact = {
    archive,
    artifactId: parsed.artifactTuple.artifactId,
    artifactDigest: parsed.artifactTuple.artifactDigest,
    fetchedAt: now.toISOString(),
    repositoryId: enrollment.repositoryId,
    runId: parsed.artifactTuple.runId,
    sourceHead: parsed.artifactTuple.sourceHead,
  }
  let assessment: ProjectFinishAttestationVerifierAssessment
  try {
    assessment = (options.artifactInspector ?? inspectProjectFinishAttestationArtifact)(
      projectDir,
      enrollment,
      archive,
      now,
    )
  } catch {
    return authorityVerifyResult("blocked", "verification-unavailable")
  }
  const reason = authorityVerifyReason(assessment)
  if (reason !== undefined) return authorityVerifyResult("blocked", reason)
  if (assessment.consumptionState !== "unconsumed") {
    return authorityVerifyResult("blocked", "consumption-invalid")
  }
  if (!matchesAuthorityArtifactBinding(artifact, enrollment, assessment)) {
    return authorityVerifyResult("blocked", "binding-mismatch")
  }
  return authorityVerifyResult("trusted", "none")
}

function authorityVerifyReason(
  assessment: ProjectFinishAttestationVerifierAssessment,
): AuthorityVerifyReason | undefined {
  switch (assessment.state) {
    case "trusted":
      return assessment.authorityEligible ? undefined : "verification-unavailable"
    case "dns-unavailable":
    case "network-unavailable":
    case "trust-root-unavailable":
    case "verification-timeout":
      return "trust-unavailable"
    case "runtime-unsupported":
      return "runtime-unsupported"
    case "source-drift":
      return "source-mismatch"
    case "stale":
      return "stale"
    case "replayed":
      return "consumption-invalid"
    case "binding-mismatch":
    case "wrong-policy":
      return "binding-mismatch"
    case "certificate-invalid":
    case "crypto-failed":
    case "signature-invalid":
    case "transparency-invalid":
      return "crypto-invalid"
    case "malformed":
    case "malformed-bundle":
    case "missing":
      return "artifact-invalid"
    default:
      return "verification-unavailable"
  }
}

function hasInstalledPackageProvenance(packageRoot: string | undefined): boolean {
  if (packageRoot === undefined) return false
  const root = resolve(packageRoot)
  if (captureNoFollowDirectory(root).kind !== "ready") return false
  const dist = captureNoFollowDirectory(join(root, "dist"))
  const cli = captureNoFollowDirectory(join(root, "dist", "cli"))
  if (dist.kind !== "ready" || cli.kind !== "ready") return false
  const manifest = readNoFollowRegularFile(join(root, "package.json"), 256 * 1024, root)
  const entrypoint = readNoFollowRegularFile(join(root, "dist", "cli", "index.js"), 4 * 1024 * 1024, join(root, "dist", "cli"))
  if (manifest.kind !== "ready" || entrypoint.kind !== "ready") return false
  if (captureNoFollowDirectory(join(root, "src")).kind !== "absent") return false
  if (captureNoFollowDirectory(join(root, ".git")).kind !== "absent") return false
  try {
    const value: unknown = JSON.parse(manifest.value.bytes.toString("utf8"))
    if (!isRecord(value) || value.version !== personaHarnessVersion()) return false
    const bin = value.bin
    return isRecord(bin)
      && bin.ph === "dist/cli/index.js"
      && bin["persona-harness"] === "dist/cli/index.js"
  } catch {
    return false
  }
}

function readExplicitArchive(path: string): Buffer | undefined {
  const absolutePath = resolve(path)
  const parentPath = dirname(absolutePath)
  const chain = captureDirectoryChain(parentPath)
  if (chain === undefined) return undefined
  const source = readNoFollowRegularFile(absolutePath, 8 * 1024 * 1024, parentPath)
  if (source.kind !== "ready") return undefined
  for (const entry of chain) {
    const current = captureNoFollowDirectory(entry.path)
    if (current.kind !== "ready" || !sameNoFollowPathIdentity(entry.identity, current.value)) return undefined
  }
  return source.value.bytes
}

function captureDirectoryChain(path: string): readonly { readonly identity: NoFollowPathIdentity; readonly path: string }[] | undefined {
  const chain: Array<{ readonly identity: NoFollowPathIdentity; readonly path: string }> = []
  let currentPath = resolve(path)
  while (true) {
    const directory = captureNoFollowDirectory(currentPath)
    if (directory.kind !== "ready") return undefined
    chain.unshift({ identity: directory.value, path: currentPath })
    const parentPath = dirname(currentPath)
    if (parentPath === currentPath) return chain
    currentPath = parentPath
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
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
