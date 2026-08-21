import {
  reserveProjectReadBoundary,
  type ProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import {
  captureGitIdentityFromCapturedProject,
  type GitIdentity,
} from "./ci-reverification-identity.js"
import {
  bindProjectFinishAttestationInputSnapshot,
  captureProjectFinishAttestationInputSnapshot,
} from "./project-finish-attestation-inputs.js"
import { INIT_MANIFEST_RELATIVE_PATH } from "./init-manifest.js"
import {
  captureSourceIdentity,
  captureSourceIdentityEntries,
  sameSourceIdentity,
  type SourceIdentityEntry,
} from "./source-identity.js"
import type { SourceIdentity } from "./source-identity-types.js"

const PROJECT_FINISH_RUNTIME_EXCLUSIONS = [
  INIT_MANIFEST_RELATIVE_PATH,
  ".persona/instructions/conflicts.json",
  ".persona/instructions/inferred.json",
  ".persona/workflow",
] as const

export function captureProjectFinishAttestationSourceIdentity(
  projectDir: string,
  git: GitIdentity,
  projectReadBoundary?: ProjectReadBoundary,
) {
  return captureSourceIdentity(projectDir, git, ".persona/evidence", {
    additionalExcludedRoots: PROJECT_FINISH_RUNTIME_EXCLUSIONS,
    ...(projectReadBoundary === undefined ? {} : { gitRunner: currentProjectGit(projectReadBoundary) }),
    projectReadBoundary,
  })
}

export function captureProjectFinishAttestationSourceEntries(
  projectDir: string,
  git: GitIdentity,
  projectReadBoundary?: ProjectReadBoundary,
) {
  return captureSourceIdentityEntries(projectDir, git, ".persona/evidence", {
    additionalExcludedRoots: PROJECT_FINISH_RUNTIME_EXCLUSIONS,
    ...(projectReadBoundary === undefined ? {} : { gitRunner: currentProjectGit(projectReadBoundary) }),
    projectReadBoundary,
  })
}

function currentProjectGit(projectReadBoundary: ProjectReadBoundary) {
  return (args: readonly string[]) => projectReadBoundary.runFixedGit(args)
}

export function matchesProjectFinishAttestationSource(
  projectDir: string,
  expected: SourceIdentity,
  suppliedBoundary?: ProjectReadBoundary,
): boolean {
  return projectFinishAttestationSourceDriftPath(projectDir, expected, suppliedBoundary) === undefined
}

/**
 * Where the current source stopped matching the signed identity, or `undefined`
 * when it matches.
 *
 * `source-drift` alone sends a reader looking for a change that git often
 * insists is not there. The case that costs the most time: git normalizes line
 * endings, so a checkout can report `git status --porcelain
 * --untracked-files=all` with zero entries while a file's working-tree bytes
 * differ from the bytes that were committed and signed. Head matches, entry
 * counts match, the git status digest matches, and only the content digest
 * moves — with nothing in the diagnostic pointing at why.
 *
 * The tracked index digest separates that case cleanly only when there are no
 * untracked entries. With an untracked file present, its contents can change
 * while both the status and tracked-index digests remain the same, so the
 * diagnostic must stay at the content-drift level.
 *
 * Reporting only; no verdict changes. Any drift still blocks.
 */
export function projectFinishAttestationSourceDriftPath(
  projectDir: string,
  expected: SourceIdentity,
  suppliedBoundary?: ProjectReadBoundary,
): string | undefined {
  let projectReadBoundary = suppliedBoundary
  try {
    if (projectReadBoundary === undefined) projectReadBoundary = reserveProjectReadBoundary(projectDir)
    return sourceDriftPathWithinBoundary(projectReadBoundary, expected)
  } catch {
    return "source"
  } finally {
    if (suppliedBoundary === undefined) projectReadBoundary?.close()
  }
}

function sourceDriftPathWithinBoundary(
  projectReadBoundary: ProjectReadBoundary,
  expected: SourceIdentity,
): string | undefined {
  const git = captureGitIdentityFromCapturedProject(currentProjectGit(projectReadBoundary))
  if (!git.available || git.status === undefined) return "source.git"
  if (git.head !== expected.repositoryHead) return "source.repositoryHead"
  const inputs = captureProjectFinishAttestationInputSnapshot(".", projectReadBoundary)
  if (inputs.kind !== "ready") return "source.inputs"
  const source = captureProjectFinishAttestationSourceIdentity(".", git, projectReadBoundary)
  if (source.status !== "available") return "source.identity"
  const actual = bindProjectFinishAttestationInputSnapshot(source.value, inputs.value)
  return sameSourceIdentity(actual, expected) ? undefined : sourceIdentityDriftPath(actual, expected)
}

export function sourceIdentityDriftPath(actual: SourceIdentity, expected: SourceIdentity): string {
  if (actual.repositoryHead !== expected.repositoryHead) return "source.repositoryHead"
  if (
    actual.entryCount !== expected.entryCount
    || actual.trackedEntryCount !== expected.trackedEntryCount
    || actual.untrackedEntryCount !== expected.untrackedEntryCount
  ) {
    return "source.entryCount"
  }
  if (actual.gitStatusDigest !== expected.gitStatusDigest) return "source.gitStatusDigest"
  if (
    actual.untrackedEntryCount === 0
    && actual.trackedIndexDigest === expected.trackedIndexDigest
    && actual.contentDigest !== expected.contentDigest
  ) {
    // Same commit, same file set, same git status, same index — the bytes on
    // disk differ from the bytes git holds for them. Line-ending normalization
    // is the usual cause, and `git status` will not show it.
    return "source.workingTreeBytesDifferFromMatchingGitIndex"
  }
  if (actual.trackedIndexDigest !== expected.trackedIndexDigest) return "source.trackedIndexDigest"
  return actual.contentDigest === expected.contentDigest ? "source" : "source.contentDigest"
}
