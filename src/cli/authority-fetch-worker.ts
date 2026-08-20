import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import { createAuthorityFetchChildEnvironment as createBoundedAuthorityFetchChildEnvironment } from "../../scripts/authority-fetch-child-environment.mjs"
import type { AuthorityArtifactTuple } from "./authority-artifact-binding.js"
import type { AuthorityArtifact } from "./authority-artifact-store.js"
import type { AuthorityEnrollment } from "./authority-enrollment.js"
import { isAuthorityGithubToken } from "./authority-github-token.js"
import { captureGitIdentity, captureWorkspaceIdentity } from "./ci-reverification-identity.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/fetch-consumer-authority-artifact.mjs", import.meta.url))
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024
const WORKER_TIMEOUT_MS = 30_000

export type GithubAuthorityFetchDiagnostic =
  | "authority-fetch-evidence"
  | "authority-fetch-invalid"
  | "authority-fetch-network"
  | "authority-fetch-policy"

export type GithubAuthorityFetchResult =
  | { readonly diagnostic?: GithubAuthorityFetchDiagnostic; readonly kind: "blocked" }
  | { readonly artifact: AuthorityArtifact; readonly kind: "ready" }

export type AuthorityFetchChildInput = {
  readonly callerWorkflowPath: string
  readonly expected: AuthorityArtifactTuple
  readonly repositoryId: number
  readonly repositorySlug: string
  readonly sourceHead: string
}

export function createAuthorityFetchChildInput(
  enrollment: Pick<AuthorityEnrollment, "callerWorkflowPath" | "repositoryId" | "repositorySlug">,
  sourceHead: string,
  expected: AuthorityArtifactTuple,
): AuthorityFetchChildInput {
  return {
    callerWorkflowPath: enrollment.callerWorkflowPath,
    expected,
    repositoryId: enrollment.repositoryId,
    repositorySlug: enrollment.repositorySlug,
    sourceHead,
  }
}

export function fetchGithubAuthorityArtifact(
  projectDir: string,
  enrollment: AuthorityEnrollment,
  expected: AuthorityArtifactTuple,
  githubToken: string | undefined,
  now = new Date(),
): GithubAuthorityFetchResult {
  if (!isAuthorityGithubToken(githubToken)) return { kind: "blocked" }
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") return { kind: "blocked" }
  const git = captureGitIdentity(projectDir, workspace.value)
  if (!git.available || git.head === undefined) return { kind: "blocked" }
  if (git.head.toLowerCase() !== expected.sourceHead) return { kind: "blocked" }
  const childEnvironment = createAuthorityFetchChildEnvironment(githubToken)
  if (childEnvironment === undefined) return { kind: "blocked" }
  const result = spawnSync(process.execPath, [WORKER_PATH], {
    cwd: workspace.value.realpath,
    encoding: "utf8",
    env: childEnvironment,
    input: JSON.stringify(createAuthorityFetchChildInput(enrollment, git.head, expected)),
    maxBuffer: MAX_OUTPUT_BYTES,
    shell: false,
    stdio: ["pipe", "pipe", "ignore"],
    timeout: WORKER_TIMEOUT_MS,
  })
  const diagnostic = result.error === undefined && result.status === 1 && typeof result.stdout === "string"
    ? parseGithubAuthorityFetchDiagnostic(result.stdout)
    : undefined
  if (diagnostic !== undefined) return { diagnostic, kind: "blocked" }
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== "string") return { kind: "blocked" }
  const fetched = parseFetchedArtifact(result.stdout)
  return fetched === undefined
    ? { kind: "blocked" }
    : {
        artifact: {
          archive: fetched.archive,
          artifactId: fetched.artifactId,
          artifactDigest: fetched.artifactDigest,
          fetchedAt: now.toISOString(),
          repositoryId: enrollment.repositoryId,
          runId: fetched.runId,
          sourceHead: expected.sourceHead,
        },
        kind: "ready",
      }
}

export function parseFetchedArtifact(value: string): {
  readonly archive: Buffer
  readonly artifactId: number
  readonly artifactDigest: string
  readonly runId: string
} | undefined {
  try {
    const output: unknown = JSON.parse(value)
    if (!isRecord(output) || !exactKeys(output, ["archive", "artifactDigest", "artifactId", "ok", "runId"]) || output.ok !== true) {
      return undefined
    }
    if (typeof output.archive !== "string" || !isPositiveInteger(output.artifactId) || !isDigest(output.artifactDigest) || !isRunId(output.runId)) return undefined
    const archive = Buffer.from(output.archive, "base64")
    return archive.byteLength > 0
      && archive.byteLength <= MAX_ARCHIVE_BYTES
      && archive.toString("base64") === output.archive
      ? { archive, artifactId: output.artifactId, artifactDigest: output.artifactDigest, runId: output.runId }
      : undefined
  } catch {
    return undefined
  }
}

export function createAuthorityFetchChildEnvironment(
  githubToken: string,
  platform = process.platform,
  darwinTextEncoding = process.env["__CF_USER_TEXT_ENCODING"],
): Readonly<Record<string, string>> | undefined {
  return createBoundedAuthorityFetchChildEnvironment(githubToken, platform, darwinTextEncoding)
}

export function parseGithubAuthorityFetchDiagnostic(value: string): GithubAuthorityFetchDiagnostic | undefined {
  try {
    const output: unknown = JSON.parse(value)
    return isRecord(output)
      && exactKeys(output, ["code", "ok"])
      && output.ok === false
      && isGithubAuthorityFetchDiagnostic(output.code)
      ? output.code
      : undefined
  } catch {
    return undefined
  }
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === keys[index])
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/iu.test(value)
}

function isRunId(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]{0,18}$/u.test(value)
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

function isGithubAuthorityFetchDiagnostic(value: unknown): value is GithubAuthorityFetchDiagnostic {
  switch (value) {
    case "authority-fetch-evidence":
    case "authority-fetch-invalid":
    case "authority-fetch-network":
    case "authority-fetch-policy":
      return true
    default:
      return false
  }
}
