import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import {
  captureGitIdentity,
  captureWorkspaceIdentity,
} from "./ci-reverification-identity.js"
import { captureProjectFinishAttestationInputSnapshot } from "./project-finish-attestation-inputs.js"
import {
  captureSourceIdentity,
  captureSourceIdentityEntries,
  type SourceIdentityEntry,
} from "./source-identity.js"
import type { SourceIdentity } from "./source-identity-types.js"
import { runFixedGit } from "./fixed-git.js"
import type { MutationEntry } from "./ci-reverification-mutation.js"

const DIAGNOSTIC_ROOTS = [".persona/evidence", ".persona/workflow"] as const

export function matchesProjectFinishAttestationSource(
  projectDir: string,
  expected: SourceIdentity,
): boolean {
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") return false
  const git = captureGitIdentity(projectDir, workspace.value)
  if (
    !git.available
    || git.head !== expected.repositoryHead
    || git.status === undefined
    || git.status.entries.some((entry) => !isDiagnosticMutation(entry))
  ) {
    return false
  }
  if (captureProjectFinishAttestationInputSnapshot(projectDir).kind !== "ready") return false
  const currentEntries = captureSourceIdentityEntries(projectDir, git, ".persona/evidence")
  if (currentEntries.status !== "available") return false

  const tempRoot = mkdtempSync(join(tmpdir(), "persona-harness-project-source-"))
  const cleanRoot = join(tempRoot, "source")
  const added = runFixedGit(projectDir, ["worktree", "add", "--detach", cleanRoot, expected.repositoryHead])
  if (added.status !== 0) {
    rmSync(tempRoot, { force: true, recursive: true })
    return false
  }
  try {
    const cleanWorkspace = captureWorkspaceIdentity(cleanRoot)
    if (cleanWorkspace.status !== "available") return false
    const cleanGit = captureGitIdentity(cleanRoot, cleanWorkspace.value)
    const cleanSource = captureSourceIdentity(cleanRoot, cleanGit, ".persona/evidence")
    const cleanEntries = captureSourceIdentityEntries(cleanRoot, cleanGit, ".persona/evidence")
    return cleanSource.status === "available"
      && cleanEntries.status === "available"
      && sameProjectFinishAttestationSourceEntries(currentEntries.value, cleanEntries.value)
      && matchesPortableProjectFinishAttestationSourceIdentity(cleanSource.value, expected)
  } finally {
    runFixedGit(projectDir, ["worktree", "remove", "--force", cleanRoot])
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
  return DIAGNOSTIC_ROOTS.some((root) => entry.path === root || entry.path.startsWith(`${root}/`))
}
