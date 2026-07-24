import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import type { AuthorityArtifact } from "./authority-artifact-store.js"
import type { AuthorityEnrollment } from "./authority-enrollment.js"
import { captureGitIdentity, captureWorkspaceIdentity } from "./ci-reverification-identity.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/fetch-consumer-authority-artifact.mjs", import.meta.url))
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024
const MAX_OUTPUT_BYTES = 12 * 1024 * 1024
const WORKER_TIMEOUT_MS = 30_000

export function fetchGithubAuthorityArtifact(
  projectDir: string,
  enrollment: AuthorityEnrollment,
  now = new Date(),
): AuthorityArtifact | undefined {
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") return undefined
  const git = captureGitIdentity(projectDir, workspace.value)
  if (!git.available || git.head === undefined) return undefined
  const result = spawnSync(process.execPath, [WORKER_PATH], {
    cwd: workspace.value.realpath,
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C" },
    input: JSON.stringify({
      callerWorkflowPath: enrollment.callerWorkflowPath,
      repositoryId: enrollment.repositoryId,
      repositorySlug: enrollment.repositorySlug,
      sourceHead: git.head,
    }),
    maxBuffer: MAX_OUTPUT_BYTES,
    shell: false,
    stdio: ["pipe", "pipe", "ignore"],
    timeout: WORKER_TIMEOUT_MS,
  })
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== "string") return undefined
  const fetched = parseFetchedArtifact(result.stdout)
  return fetched === undefined
    ? undefined
    : {
        archive: fetched.archive,
        artifactDigest: fetched.artifactDigest,
        fetchedAt: now.toISOString(),
        repositoryId: enrollment.repositoryId,
        runId: fetched.runId,
        sourceHead: git.head,
      }
}

export function parseFetchedArtifact(value: string): {
  readonly archive: Buffer
  readonly artifactDigest: string
  readonly runId: string
} | undefined {
  try {
    const output: unknown = JSON.parse(value)
    if (!isRecord(output) || !exactKeys(output, ["archive", "artifactDigest", "ok", "runId"]) || output.ok !== true) {
      return undefined
    }
    if (typeof output.archive !== "string" || !isDigest(output.artifactDigest) || !isRunId(output.runId)) return undefined
    const archive = Buffer.from(output.archive, "base64")
    return archive.byteLength > 0
      && archive.byteLength <= MAX_ARCHIVE_BYTES
      && archive.toString("base64") === output.archive
      ? { archive, artifactDigest: output.artifactDigest, runId: output.runId }
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
