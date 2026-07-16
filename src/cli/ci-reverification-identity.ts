import { lstatSync, realpathSync, statSync } from "node:fs"
import { isAbsolute, join, relative } from "node:path"

import { parseGitStatusPorcelain, type GitStatusSnapshot } from "./ci-reverification-mutation.js"
import { runFixedGit } from "./fixed-git.js"

export type PosixPathIdentity = {
  readonly dev: string
  readonly ino: string
  readonly realpath: string
}

export type EvidenceParentIdentity = PosixPathIdentity & {
  readonly relativePath: string
}

export type GitIdentity = {
  readonly available: boolean
  readonly diagnosticCode: string
  readonly head?: string
  readonly status?: GitStatusSnapshot
}

export type ReverificationIdentitySnapshot = {
  readonly evidenceParent: EvidenceParentIdentity
  readonly git: GitIdentity
  readonly workspaceRoot: PosixPathIdentity
}

type IdentityResult<T> =
  | { readonly diagnosticCode: string; readonly status: "unavailable" }
  | { readonly status: "available"; readonly value: T }

const COMMIT_ID_PATTERN = /^[a-f0-9]{40}$/u

function pathIdentity(path: string): PosixPathIdentity {
  const realpath = realpathSync(path)
  const stat = statSync(realpath, { bigint: true })
  if (!stat.isDirectory()) {
    throw new Error("path is not a directory")
  }
  return { dev: stat.dev.toString(), ino: stat.ino.toString(), realpath }
}

function isContained(root: string, candidate: string): boolean {
  const path = relative(root, candidate)
  return path === "" || (!path.startsWith("../") && path !== ".." && !isAbsolute(path))
}

export function captureWorkspaceIdentity(projectDir: string): IdentityResult<PosixPathIdentity> {
  try {
    return { status: "available", value: pathIdentity(projectDir) }
  } catch {
    return { diagnosticCode: "workspace-root-unavailable", status: "unavailable" }
  }
}

export function captureEvidenceParentIdentity(
  workspaceRoot: PosixPathIdentity,
  relativePath = ".persona/evidence",
): IdentityResult<EvidenceParentIdentity> {
  try {
    const evidence = join(workspaceRoot.realpath, relativePath)
    const persona = join(workspaceRoot.realpath, ".persona")
    const personaStat = lstatSync(persona, { bigint: true })
    const evidenceStat = lstatSync(evidence, { bigint: true })
    if (!personaStat.isDirectory() || !evidenceStat.isDirectory()) {
      return { diagnosticCode: "evidence-parent-not-directory", status: "unavailable" }
    }
    if (personaStat.isSymbolicLink() || evidenceStat.isSymbolicLink()) {
      return { diagnosticCode: "evidence-parent-symlink", status: "unavailable" }
    }
    const personaRealpath = realpathSync(persona)
    const evidenceRealpath = realpathSync(evidence)
    if (personaRealpath !== persona || evidenceRealpath !== evidence) {
      return { diagnosticCode: "evidence-parent-symlink", status: "unavailable" }
    }
    if (!isContained(workspaceRoot.realpath, evidenceRealpath)) {
      return { diagnosticCode: "evidence-parent-outside-workspace", status: "unavailable" }
    }
    return {
      status: "available",
      value: {
        dev: evidenceStat.dev.toString(),
        ino: evidenceStat.ino.toString(),
        realpath: evidenceRealpath,
        relativePath,
      },
    }
  } catch {
    return { diagnosticCode: "evidence-parent-unavailable", status: "unavailable" }
  }
}

function runGit(projectDir: string, args: readonly string[]): { readonly status: number; readonly stdout: string } {
  const result = runFixedGit(projectDir, args)
  return { status: result.status, stdout: result.stdout }
}

export function captureGitIdentity(projectDir: string, workspaceRoot: PosixPathIdentity): GitIdentity {
  const root = runGit(projectDir, ["rev-parse", "--show-toplevel"])
  if (root.status !== 0) {
    return { available: false, diagnosticCode: "git-worktree-unavailable" }
  }
  try {
    if (realpathSync(root.stdout.trim()) !== workspaceRoot.realpath) {
      return { available: false, diagnosticCode: "git-worktree-root-mismatch" }
    }
  } catch {
    return { available: false, diagnosticCode: "git-worktree-root-unavailable" }
  }
  const head = runGit(projectDir, ["rev-parse", "--verify", "HEAD^{commit}"])
  const commitId = head.stdout.trim().toLowerCase()
  if (head.status !== 0 || !COMMIT_ID_PATTERN.test(commitId)) {
    return { available: false, diagnosticCode: "git-head-unavailable" }
  }
  const status = runGit(projectDir, ["status", "--porcelain=v1", "-z", "--untracked-files=all"])
  if (status.status !== 0) {
    return { available: false, diagnosticCode: "git-status-unavailable" }
  }
  return {
    available: true,
    diagnosticCode: "git-identity-available",
    head: commitId,
    status: parseGitStatusPorcelain(status.stdout),
  }
}

export function samePathIdentity(left: PosixPathIdentity, right: PosixPathIdentity): boolean {
  return left.realpath === right.realpath && left.dev === right.dev && left.ino === right.ino
}
