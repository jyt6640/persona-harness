import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  reserveProjectReadBoundary,
  type ProjectReadBoundary,
} from "../io/bootstrap-write-boundary.js"
import {
  captureGitIdentityFromCapturedProject,
  captureWorkspaceIdentity,
  type GitIdentity,
} from "./ci-reverification-identity.js"
import { captureProjectFinishAttestationInputSnapshot } from "./project-finish-attestation-inputs.js"
import {
  captureSourceIdentity,
  captureSourceIdentityEntries,
  type SourceIdentityEntry,
} from "./source-identity.js"
import type { SourceIdentity } from "./source-identity-types.js"
import { runFixedGitFromCurrentDirectory } from "./fixed-git.js"
import type { MutationEntry } from "./ci-reverification-mutation.js"

const PROJECT_FINISH_PERMITTED_MUTATION_ROOTS = [
  ".gradle",
  "build",
  "node_modules",
  ".persona/evidence",
  ".persona/workflow",
] as const
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
  return (args: readonly string[]) => projectReadBoundary.withCapturedProject(() => runFixedGitFromCurrentDirectory(args))
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
  const workspace = projectReadBoundary.withCapturedProject(() => captureWorkspaceIdentity("."))
  if (workspace.status !== "available") return false
  const git = captureGitIdentityFromCapturedProject(currentProjectGit(projectReadBoundary))
  if (
    !git.available
    || git.head !== expected.repositoryHead
    || git.status === undefined
    || git.status.entries.some((entry) => !isDiagnosticMutation(entry))
  ) {
    return false
  }
  if (captureProjectFinishAttestationInputSnapshot(".", projectReadBoundary).kind !== "ready") return false
  const currentEntries = captureProjectFinishAttestationSourceEntries(".", git, projectReadBoundary)
  if (currentEntries.status !== "available") return false

  const tempRoot = mkdtempSync(join(tmpdir(), "persona-harness-project-source-"))
  const cleanRoot = join(tempRoot, "source")
  const added = projectReadBoundary.withCapturedProject(() => runFixedGitFromCurrentDirectory([
    "worktree",
    "add",
    "--detach",
    cleanRoot,
    expected.repositoryHead,
  ]))
  if (added.status !== 0) {
    rmSync(tempRoot, { force: true, recursive: true })
    return false
  }

  let cleanReadBoundary: ProjectReadBoundary | undefined
  try {
    cleanReadBoundary = reserveProjectReadBoundary(cleanRoot)
    const cleanWorkspace = cleanReadBoundary.withCapturedProject(() => captureWorkspaceIdentity("."))
    if (cleanWorkspace.status !== "available") return false
    const cleanGit = captureGitIdentityFromCapturedProject(currentProjectGit(cleanReadBoundary))
    const cleanSource = captureProjectFinishAttestationSourceIdentity(".", cleanGit, cleanReadBoundary)
    const cleanEntries = captureProjectFinishAttestationSourceEntries(".", cleanGit, cleanReadBoundary)
    return cleanSource.status === "available"
      && cleanEntries.status === "available"
      && sameProjectFinishAttestationSourceEntries(currentEntries.value, cleanEntries.value)
      && matchesPortableProjectFinishAttestationSourceIdentity(cleanSource.value, expected)
  } finally {
    cleanReadBoundary?.close()
    projectReadBoundary.withCapturedProject(() => runFixedGitFromCurrentDirectory([
      "worktree",
      "remove",
      "--force",
      cleanRoot,
    ]))
    rmSync(tempRoot, { force: true, recursive: true })
  }
}

function sameProjectFinishAttestationSourceEntries(
  current: readonly SourceIdentityEntry[],
  clean: readonly SourceIdentityEntry[],
): boolean {
  return JSON.stringify(withoutEvidenceOnlyPersonaDirectory(current))
    === JSON.stringify(withoutEvidenceOnlyPersonaDirectory(clean))
}

function withoutEvidenceOnlyPersonaDirectory(
  entries: readonly SourceIdentityEntry[],
): readonly SourceIdentityEntry[] {
  const hasPersonaContent = entries.some((entry) => entry.path.startsWith(".persona/"))
  return hasPersonaContent ? entries : entries.filter((entry) => entry.path !== ".persona")
}

function matchesPortableProjectFinishAttestationSourceIdentity(
  actual: SourceIdentity,
  expected: SourceIdentity,
): boolean {
  return actual.schemaVersion === expected.schemaVersion
    && actual.repositoryHead === expected.repositoryHead
    && actual.gitStatusDigest === expected.gitStatusDigest
    && actual.trackedIndexDigest === expected.trackedIndexDigest
    && actual.entryCount === expected.entryCount
    && actual.trackedEntryCount === expected.trackedEntryCount
    && actual.untrackedEntryCount === expected.untrackedEntryCount
    && actual.exclusions.every((entry, index) => entry === expected.exclusions[index])
}

function isDiagnosticMutation(entry: MutationEntry): boolean {
  if (entry.kind !== "untracked") return false
  return PROJECT_FINISH_PERMITTED_MUTATION_ROOTS.some((root) => entry.path === root || entry.path.startsWith(`${root}/`))
}
