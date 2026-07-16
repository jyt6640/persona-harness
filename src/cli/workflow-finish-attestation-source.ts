import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import type { MutationEntry } from "./ci-reverification-mutation.js"
import {
  captureGitIdentity,
  captureWorkspaceIdentity,
} from "./ci-reverification-identity.js"
import { captureSourceIdentity, sameSourceIdentity } from "./source-identity.js"
import type { SourceIdentity } from "./source-identity-types.js"
import type { FinishAttestationDiagnostic } from "./workflow-finish-attestation-types.js"

const DIAGNOSTIC_ROOTS = [".persona/evidence", ".persona/workflow"] as const

export function compareCurrentSource(
  projectDir: string,
  expected: SourceIdentity,
): FinishAttestationDiagnostic | undefined {
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") {
    return { code: "source-drift", message: "Current workspace identity is unavailable.", path: "workspace" }
  }
  const git = captureGitIdentity(projectDir, workspace.value)
  if (!git.available || git.head !== expected.repositoryHead || git.status === undefined) {
    return { code: "source-drift", message: "Current Git HEAD or status identity does not match the signed source.", path: "source" }
  }
  if (git.status.entries.some((entry) => !isDiagnosticMutation(entry))) {
    return { code: "source-drift", message: "Tracked source or non-diagnostic files are dirty.", path: "source" }
  }

  const tempRoot = mkdtempSync(join(tmpdir(), "persona-harness-source-"))
  const cleanRoot = join(tempRoot, "source")
  const added = spawnSync("git", ["worktree", "add", "--detach", cleanRoot, expected.repositoryHead], {
    cwd: projectDir,
    encoding: "utf8",
    shell: false,
    timeout: 10_000,
  })
  if (added.status !== 0) {
    rmSync(tempRoot, { force: true, recursive: true })
    return { code: "source-drift", message: "A clean source snapshot could not be materialized.", path: "source" }
  }
  try {
    const cleanWorkspace = captureWorkspaceIdentity(cleanRoot)
    if (cleanWorkspace.status !== "available") {
      return { code: "source-drift", message: "The clean source snapshot identity is unavailable.", path: "source" }
    }
    const cleanGit = captureGitIdentity(cleanRoot, cleanWorkspace.value)
    const cleanSource = captureSourceIdentity(cleanRoot, cleanGit, ".persona/evidence")
    if (cleanSource.status !== "available" || !sameSourceIdentity(cleanSource.value, expected)) {
      return { code: "source-drift", message: "Current source identity does not match the signed canonical-main snapshot.", path: "source" }
    }
    return undefined
  } finally {
    spawnSync("git", ["worktree", "remove", "--force", cleanRoot], {
      cwd: projectDir,
      encoding: "utf8",
      shell: false,
      timeout: 10_000,
    })
    rmSync(tempRoot, { force: true, recursive: true })
  }
}

function isDiagnosticMutation(entry: MutationEntry): boolean {
  if (entry.kind !== "untracked") return false
  return DIAGNOSTIC_ROOTS.some((root) => entry.path === root || entry.path.startsWith(`${root}/`))
}
