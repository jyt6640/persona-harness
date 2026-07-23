import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { captureGitIdentity, captureWorkspaceIdentity } from "../src/cli/ci-reverification-identity.js"
import {
  bindProjectFinishAttestationInputSnapshot,
  captureProjectFinishAttestationInputSnapshot,
} from "../src/cli/project-finish-attestation-inputs.js"
import { matchesProjectFinishAttestationSource } from "../src/cli/project-finish-attestation-source.js"
import { captureSourceIdentity } from "../src/cli/source-identity.js"
import type { SourceIdentity } from "../src/cli/source-identity-types.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("project finish attestation source binding", () => {
  it("accepts a portable signed binding in a clean worktree and blocks tracked source drift", () => {
    const primary = createProject()
    const expected = captureBoundSourceIdentity(primary)
    const worktreeParent = track(mkdtempSync(join(tmpdir(), "persona-project-finish-source-")))
    const worktree = join(worktreeParent, "consumer")
    execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: primary })
    mkdirSync(join(worktree, ".persona", "evidence", "project-finish-attestation"), { recursive: true })

    expect(matchesProjectFinishAttestationSource(worktree, expected)).toBe(true)

    writeFileSync(join(worktree, "ignored-source.txt"), "ignored source drift\n")

    expect(matchesProjectFinishAttestationSource(worktree, expected)).toBe(false)

    rmSync(join(worktree, "ignored-source.txt"))
    writeFileSync(join(worktree, "README.md"), "tracked source drift\n")

    expect(matchesProjectFinishAttestationSource(worktree, expected)).toBe(false)
  })
})

function createProject(): string {
  const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-source-")))
  mkdirSync(join(projectDir, ".github", "workflows"), { recursive: true })
  writeFileSync(join(projectDir, ".github", "workflows", "project.yml"), "name: project\n")
  writeFileSync(join(projectDir, ".gitignore"), "ignored-source.txt\n")
  writeFileSync(join(projectDir, "README.md"), "source binding fixture\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'fixture'\n")
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "project source fixture"], { cwd: projectDir })
  return projectDir
}

function captureBoundSourceIdentity(projectDir: string): SourceIdentity {
  const workspace = captureWorkspaceIdentity(projectDir)
  if (workspace.status !== "available") throw new Error("workspace identity must be available")
  const git = captureGitIdentity(projectDir, workspace.value)
  if (!git.available) throw new Error("Git identity must be available")
  const source = captureSourceIdentity(projectDir, git, ".persona/evidence")
  if (source.status !== "available") throw new Error("source identity must be available")
  const inputs = captureProjectFinishAttestationInputSnapshot(projectDir)
  if (inputs.kind !== "ready") throw new Error("project inputs must be available")
  return bindProjectFinishAttestationInputSnapshot(source.value, inputs.value)
}

function track(root: string): string {
  temporaryRoots.push(root)
  return root
}
