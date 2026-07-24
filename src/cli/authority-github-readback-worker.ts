import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

import type { AuthorityEnrollmentReadback } from "./authority-enrollment.js"

const WORKER_PATH = fileURLToPath(new URL("../../scripts/read-consumer-authority-github.mjs", import.meta.url))
const MAX_OUTPUT_BYTES = 64 * 1024
const WORKER_TIMEOUT_MS = 20_000

export function readGithubAuthorityEnrollment(
  projectDir: string,
  repositorySlug: string,
  workflowPath: string,
): AuthorityEnrollmentReadback | undefined {
  const result = spawnSync(process.execPath, [WORKER_PATH], {
    cwd: projectDir,
    encoding: "utf8",
    env: { LANG: "C", LC_ALL: "C" },
    input: JSON.stringify({ repositorySlug, workflowPath }),
    maxBuffer: MAX_OUTPUT_BYTES,
    shell: false,
    stdio: ["pipe", "pipe", "ignore"],
    timeout: WORKER_TIMEOUT_MS,
  })
  if (result.error !== undefined || result.status !== 0 || typeof result.stdout !== "string") return undefined
  try {
    const output: unknown = JSON.parse(result.stdout)
    return isReadbackResult(output) ? output.value : undefined
  } catch {
    return undefined
  }
}

function isReadbackResult(value: unknown): value is { readonly ok: true; readonly value: AuthorityEnrollmentReadback } {
  if (!isRecord(value) || value.ok !== true || !isRecord(value.value)) return false
  const output = value.value
  return Object.keys(output).sort().join(",") === "callerWorkflowPath,repositoryId,repositorySlug,reusableWorkflowSha"
    && typeof output.callerWorkflowPath === "string"
    && typeof output.repositoryId === "number"
    && typeof output.repositorySlug === "string"
    && typeof output.reusableWorkflowSha === "string"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
