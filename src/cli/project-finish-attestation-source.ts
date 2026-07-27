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
import {
  captureSourceIdentity,
  captureSourceIdentityEntries,
  sameSourceIdentity,
  type SourceIdentityEntry,
} from "./source-identity.js"
import type { SourceIdentity } from "./source-identity-types.js"

const PROJECT_FINISH_WORKFLOW_ROOT = ".persona/workflow"

export function captureProjectFinishAttestationSourceIdentity(
  projectDir: string,
  git: GitIdentity,
  projectReadBoundary?: ProjectReadBoundary,
) {
  return captureSourceIdentity(projectDir, git, ".persona/evidence", {
    additionalExcludedRoots: [PROJECT_FINISH_WORKFLOW_ROOT],
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
    additionalExcludedRoots: [PROJECT_FINISH_WORKFLOW_ROOT],
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
): boolean {
  let projectReadBoundary: ProjectReadBoundary | undefined
  try {
    projectReadBoundary = reserveProjectReadBoundary(projectDir)
    return matchesProjectFinishAttestationSourceWithinBoundary(projectReadBoundary, expected)
  } catch {
    return false
  } finally {
    projectReadBoundary?.close()
  }
}

function matchesProjectFinishAttestationSourceWithinBoundary(
  projectReadBoundary: ProjectReadBoundary,
  expected: SourceIdentity,
): boolean {
  const git = captureGitIdentityFromCapturedProject(currentProjectGit(projectReadBoundary))
  if (
    !git.available
    || git.head !== expected.repositoryHead
    || git.status === undefined
  ) {
    return false
  }
  const inputs = captureProjectFinishAttestationInputSnapshot(".", projectReadBoundary)
  if (inputs.kind !== "ready") return false
  const source = captureProjectFinishAttestationSourceIdentity(".", git, projectReadBoundary)
  return source.status === "available"
    && sameSourceIdentity(bindProjectFinishAttestationInputSnapshot(source.value, inputs.value), expected)
}
