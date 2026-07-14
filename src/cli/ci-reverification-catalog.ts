import { createHash } from "node:crypto"
import { accessSync, constants, existsSync, lstatSync, readFileSync, realpathSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"

import { readBackendProjectProfileState } from "../config/project-profile.js"
import { isRecord } from "../config/jsonc.js"
import type { BoundedProcessResult } from "./bounded-process.js"
import type { CiReverificationArtifact, CiReverificationCommandRecord } from "./ci-reverification-artifact.js"
import { samePathIdentity, type EvidenceParentIdentity, type GitIdentity, type PosixPathIdentity } from "./ci-reverification-identity.js"
import { classifyObservedMutations, parseGitStatusPorcelain } from "./ci-reverification-mutation.js"
import { readProfileIntent } from "./stack-alignment-profile.js"

export const REVERIFICATION_COMMAND_CATALOG_ID = "java-spring-gradle-wrapper.1" as const
export const REVERIFICATION_COMMANDS = [
  { fixedArgvId: "gradle-wrapper-test.1", task: "test" },
  { fixedArgvId: "gradle-wrapper-build.1", task: "build" },
] as const
const EMPTY_STATUS = parseGitStatusPorcelain("")

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex")
}

export function commandPlanSha256(): string {
  return sha256(JSON.stringify(REVERIFICATION_COMMANDS))
}

export function safeGradleWrapper(projectDir: string): string | undefined {
  const path = join(projectDir, "gradlew")
  try {
    const expectedPath = join(realpathSync(projectDir), "gradlew")
    if (!existsSync(path) || lstatSync(path).isSymbolicLink() || !statSync(path).isFile() || realpathSync(path) !== expectedPath) {
      return undefined
    }
    accessSync(path, constants.X_OK)
    return expectedPath
  } catch {
    return undefined
  }
}

function collectJUnitRefs(projectDir: string, startedAt: number): readonly string[] {
  const root = join(projectDir, "build", "test-results")
  const refs: string[] = []
  function visit(path: string): void {
    if (!existsSync(path)) return
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const child = join(path, entry.name)
      if (entry.isDirectory()) visit(child)
      else if (entry.isFile() && entry.name.endsWith(".xml") && statSync(child).mtimeMs >= startedAt) {
        refs.push(relative(projectDir, child).replace(/\\/gu, "/"))
      }
    }
  }
  visit(root)
  return refs.sort()
}

export function createCommandRecord(
  projectDir: string,
  ordinal: number,
  fixedArgvId: CiReverificationCommandRecord["fixedArgvId"],
  startedAt: number,
  endedAt: number,
  result: BoundedProcessResult,
): CiReverificationCommandRecord {
  const stdout = Buffer.from(result.stdout)
  const stderr = Buffer.from(result.stderr)
  return {
    durationMs: Math.max(0, endedAt - startedAt),
    exitCode: result.status,
    fixedArgvId,
    junitRefs: collectJUnitRefs(projectDir, startedAt),
    ordinal,
    outcome: result.outcome === "timeout" || result.timedOut ? "timeout" : result.status === 0 ? "passed" : "failed",
    stderrBytes: stderr.byteLength,
    stderrSha256: sha256(stderr),
    stdoutBytes: stdout.byteLength,
    stdoutSha256: sha256(stdout),
  }
}

export function preflightDiagnostic(
  projectDir: string,
  mode: "ci" | "local",
  platform: NodeJS.Platform,
): string | undefined {
  if (platform === "win32") return "platform-windows-unavailable"
  let profileState: ReturnType<typeof readBackendProjectProfileState>
  let intent: ReturnType<typeof readProfileIntent>
  try {
    profileState = readBackendProjectProfileState(projectDir)
    intent = readProfileIntent(projectDir)
  } catch {
    return "profile-unready"
  }
  if (profileState.status !== "ready" || intent === undefined) return "profile-unready"
  if (intent.language !== "java" || intent.framework !== "spring" || intent.buildTool !== "gradle") {
    return "profile-catalog-unavailable"
  }
  return safeGradleWrapper(projectDir) === undefined ? "gradle-wrapper-unavailable" : undefined
}

export function mutationSnapshotData(
  mode: "ci" | "local",
  preRoot: PosixPathIdentity,
  postRoot: PosixPathIdentity | undefined,
  preParent: EvidenceParentIdentity,
  postParent: EvidenceParentIdentity | undefined,
  preGit: GitIdentity,
  postGit: GitIdentity,
): Readonly<Record<string, unknown>> {
  const preStatus = preGit.status ?? EMPTY_STATUS
  const postStatus = postGit.status ?? EMPTY_STATUS
  const classified = classifyObservedMutations(preStatus, postStatus, mode)
  return {
    allowlist: { allowedTracked: classified.allowedTracked, id: REVERIFICATION_COMMAND_CATALOG_ID, roots: ["build/**", ".gradle/**"] },
    artifactParent: {
      equal: postParent !== undefined && samePathIdentity(preParent, postParent),
      post: postParent,
      pre: preParent,
      relativePath: preParent.relativePath,
    },
    decision: preGit.available ? classified.decision : "snapshot-unavailable",
    disallowedTracked: classified.disallowedTracked,
    git: {
      available: preGit.available && postGit.available,
      diagnosticCode: postGit.available ? preGit.diagnosticCode : postGit.diagnosticCode,
      headEqual: preGit.head !== undefined && preGit.head === postGit.head,
      postHead: postGit.head,
      preHead: preGit.head,
    },
    observed: classified.observed,
    post: { entryCount: postStatus.entryCount, normalizedPorcelainNameStatusNulSha256: postStatus.digest },
    pre: { entryCount: preStatus.entryCount, normalizedPorcelainNameStatusNulSha256: preStatus.digest },
    schemaVersion: "mutationSnapshot.1",
    untracked: classified.untracked,
    workspaceRoot: { equal: postRoot !== undefined && samePathIdentity(preRoot, postRoot), post: postRoot, pre: preRoot },
  }
}

export function overflowArtifact(artifact: CiReverificationArtifact): CiReverificationArtifact {
  const mutationSource = JSON.stringify(artifact.mutationSnapshot)
  const post = artifact.mutationSnapshot.post
  const entryCount = isRecord(post) && typeof post.entryCount === "number" ? post.entryCount : 0
  return {
    ...artifact,
    diagnosticCodes: [...artifact.diagnosticCodes, "artifact-size-exceeded"],
    finalStatus: "artifact-invalid",
    mutationSnapshot: {
      overflowSummary: { byteCount: Buffer.byteLength(mutationSource), entryCount, entryDigest: sha256(mutationSource) },
      schemaVersion: "mutationSnapshot.1",
    },
  }
}

export function profileSha256(projectDir: string): string {
  const path = join(projectDir, ".persona", "project-profile.jsonc")
  return existsSync(path) ? sha256(readFileSync(path)) : sha256("")
}
