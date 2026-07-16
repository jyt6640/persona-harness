import { createHash } from "node:crypto"
import { accessSync, constants, existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs"
import { join } from "node:path"

import { readBackendProjectProfileState } from "../config/project-profile.js"
import { isRecord } from "../config/jsonc.js"
import type { BoundedProcessResult } from "./bounded-process.js"
import type { CiReverificationArtifact, CiReverificationCommandRecord } from "./ci-reverification-artifact.js"
import type { EvidenceParentIdentity, GitIdentity, PosixPathIdentity } from "./ci-reverification-identity.js"
import { discoverJUnitResults, type JunitResultDiscovery } from "./junit-result-discovery.js"
import { classifyObservedMutations, parseGitStatusPorcelain } from "./ci-reverification-mutation.js"
import {
  createMutationSnapshot,
  createOverflowMutationSnapshot,
  type MutationSnapshot,
} from "./ci-reverification-mutation-snapshot.js"
import { readProfileIntent } from "./stack-alignment-profile.js"
import type { SourceIdentity } from "./source-identity.js"

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

export function createCommandRecord(
  projectDir: string,
  ordinal: number,
  fixedArgvId: CiReverificationCommandRecord["fixedArgvId"],
  startedAt: number,
  endedAt: number,
  result: BoundedProcessResult,
  junitDiscovery = discoverJUnitResults(projectDir, {
    minimumMtimeMs: startedAt,
  }),
): CiReverificationCommandRecord {
  const stdout = Buffer.from(result.stdout)
  const stderr = Buffer.from(result.stderr)
  return {
    durationMs: Math.max(0, endedAt - startedAt),
    exitCode: result.status,
    fixedArgvId,
    junitRefs: junitDiscovery.files.map((file) => file.ref),
    ordinal,
    outcome: junitDiscovery.safe
      ? result.outcome === "timeout" || result.timedOut ? "timeout" : result.status === 0 ? "passed" : "failed"
      : "failed",
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
  preSourceIdentity: SourceIdentity,
  postSourceIdentity: SourceIdentity | undefined,
): MutationSnapshot {
  const preStatus = preGit.status ?? EMPTY_STATUS
  const postStatus = postGit.status ?? EMPTY_STATUS
  const classified = classifyObservedMutations(preStatus, postStatus, mode)
  return createMutationSnapshot({
    classified,
    postGit,
    postParent,
    postRoot,
    postSourceIdentity,
    postStatus,
    preGit,
    preParent,
    preRoot,
    preSourceIdentity,
    preStatus,
  })
}

export function overflowArtifact(artifact: CiReverificationArtifact): CiReverificationArtifact {
  const mutationSource = JSON.stringify(artifact.mutationSnapshot)
  const post = artifact.mutationSnapshot.kind === "complete"
    ? artifact.mutationSnapshot.post
    : undefined
  const entryCount = isRecord(post) && typeof post.entryCount === "number" ? post.entryCount : 0
  return {
    ...artifact,
    diagnosticCodes: [...artifact.diagnosticCodes, "artifact-size-exceeded"],
    finalStatus: "artifact-invalid",
    mutationSnapshot: createOverflowMutationSnapshot(mutationSource, entryCount),
  }
}

export function profileSha256(projectDir: string): string {
  const path = join(projectDir, ".persona", "project-profile.jsonc")
  return existsSync(path) ? sha256(readFileSync(path)) : sha256("")
}
