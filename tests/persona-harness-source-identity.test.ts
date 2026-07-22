import { execFileSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { captureGitIdentity, captureWorkspaceIdentity } from "../src/cli/ci-reverification-identity.js"
import {
  SOURCE_IDENTITY_EXCLUSIONS,
  captureSourceIdentity,
  sameSourceIdentity,
  type SourceIdentity,
} from "../src/cli/source-identity.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects) rmSync(project, { force: true, recursive: true })
  projects.length = 0
})

describe("content-aware source identity", () => {
  it("detects tracked byte drift even when Git status remains modified", () => {
    const projectDir = createProject()
    const source = join(projectDir, "src", "App.java")
    writeFileSync(source, "class App { int first; }\n")
    const first = capture(projectDir)
    writeFileSync(source, "class App { int second; }\n")
    const second = capture(projectDir)

    expect(first.repositoryHead).toBe(second.repositoryHead)
    expect(first.gitStatusDigest).toBe(second.gitStatusDigest)
    expect(first.contentDigest).not.toBe(second.contentDigest)
    expect(sameSourceIdentity(first, second)).toBe(false)
  })

  it("binds tracked and untracked content, manifests, rename/delete/type, and mode changes", () => {
    const projectDir = createProject()
    const baseline = capture(projectDir)
    const source = join(projectDir, "src", "App.java")
    const manifest = join(projectDir, "package.json")
    const config = join(projectDir, ".persona", "harness.jsonc")
    const untracked = join(projectDir, "scratch.txt")

    writeFileSync(untracked, "first\n")
    const untrackedFirst = capture(projectDir)
    writeFileSync(untracked, "second\n")
    const untrackedSecond = capture(projectDir)
    writeFileSync(join(projectDir, "src", "AppTest.java"), "class AppTest { int changed; }\n")
    const testChanged = capture(projectDir)
    writeFileSync(manifest, '{"name":"changed"}\n')
    const manifestChanged = capture(projectDir)
    writeFileSync(config, '{"evidenceDir":".persona/evidence","mode":"changed"}\n')
    const configChanged = capture(projectDir)
    renameSync(source, join(projectDir, "src", "Renamed.java"))
    const renamed = capture(projectDir)
    unlinkSync(join(projectDir, "src", "Renamed.java"))
    mkdirSync(join(projectDir, "src", "Renamed.java"))
    const typeChanged = capture(projectDir)
    chmodSync(manifest, 0o755)
    const modeChanged = capture(projectDir)

    expect(baseline.untrackedEntryCount).toBe(0)
    expect(untrackedFirst.untrackedEntryCount).toBe(1)
    expect(untrackedFirst.gitStatusDigest).toBe(untrackedSecond.gitStatusDigest)
    expect(sameSourceIdentity(untrackedFirst, untrackedSecond)).toBe(false)
    expect(sameSourceIdentity(untrackedSecond, testChanged)).toBe(false)
    expect(sameSourceIdentity(testChanged, manifestChanged)).toBe(false)
    expect(sameSourceIdentity(manifestChanged, configChanged)).toBe(false)
    expect(sameSourceIdentity(configChanged, renamed)).toBe(false)
    expect(sameSourceIdentity(renamed, typeChanged)).toBe(false)
    expect(sameSourceIdentity(typeChanged, modeChanged)).toBe(false)
  })

  it("uses explicit exclusions without implicitly ignoring source, test, or config files", () => {
    const projectDir = createProject()
    const baseline = capture(projectDir)
    writeFileSync(join(projectDir, "build", "generated.txt"), "generated\n")
    mkdirSync(join(projectDir, ".gradle"), { recursive: true })
    writeFileSync(join(projectDir, ".gradle", "state.bin"), "state\n")
    writeFileSync(join(projectDir, ".persona", "evidence", "generated.json"), '{"ignored":"evidence"}\n')
    const excludedOnly = capture(projectDir)
    writeFileSync(join(projectDir, "src", "App.java"), "class App { int changed; }\n")
    const sourceChanged = capture(projectDir)

    expect(baseline.exclusions).toEqual(SOURCE_IDENTITY_EXCLUSIONS)
    expect(sameSourceIdentity(baseline, excludedOnly)).toBe(true)
    expect(sameSourceIdentity(excludedOnly, sourceChanged)).toBe(false)
  })

  it("fails closed for symlink, unsafe path, non-Git, and bounded capture cases", () => {
    const projectDir = createProject()
    const source = join(projectDir, "src", "App.java")
    unlinkSync(source)
    symlinkSync("../package.json", source)

    const symlink = captureSourceIdentity(projectDir, git(projectDir), ".persona/evidence")
    const unsafePath = captureSourceIdentity(projectDir, git(projectDir), "../evidence")
    const nonGit = captureSourceIdentity(projectDir, { available: false, diagnosticCode: "git-worktree-unavailable" }, ".persona/evidence")

    expect(symlink).toEqual({ diagnosticCode: "source-identity-symlink", status: "unavailable" })
    expect(unsafePath).toEqual({ diagnosticCode: "source-identity-path-invalid", status: "unavailable" })
    expect(nonGit).toEqual({ diagnosticCode: "source-identity-git-unavailable", status: "unavailable" })

    rmSync(source)
    writeFileSync(source, "class App { int bounded; }\n")
    const bounded = captureSourceIdentity(projectDir, git(projectDir), ".persona/evidence", { maxFileBytes: 1 })
    expect(bounded).toEqual({ diagnosticCode: "source-identity-file-limit", status: "unavailable" })
  })

  it("scans only the fixed caller checkout when a runner-owned producer checkout contains symlinks", () => {
    const runnerRoot = mkdtempSync(join(tmpdir(), "persona-source-identity-runner-"))
    const callerRoot = join(runnerRoot, ".project-finish-caller")
    const producerBin = join(runnerRoot, ".persona-harness-producer", "node_modules", ".bin")
    projects.push(runnerRoot)
    createProjectAt(callerRoot)
    writeFileSync(join(runnerRoot, "runner.txt"), "runner\n")
    execFileSync("git", ["init", "-q"], { cwd: runnerRoot })
    execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: runnerRoot })
    execFileSync("git", ["config", "user.name", "PH Test"], { cwd: runnerRoot })
    execFileSync("git", ["add", "runner.txt"], { cwd: runnerRoot })
    execFileSync("git", ["commit", "-qm", "runner fixture"], { cwd: runnerRoot })
    mkdirSync(producerBin, { recursive: true })
    symlinkSync("../outside", join(producerBin, "node"))

    expect(captureSourceIdentity(callerRoot, git(callerRoot), ".persona/evidence").status).toBe("available")
    expect(captureSourceIdentity(runnerRoot, git(runnerRoot), ".persona/evidence")).toEqual({
      diagnosticCode: "source-identity-symlink",
      status: "unavailable",
    })
  })

  it("accepts the explicit Git worktree metadata link file without accepting caller source symlinks", () => {
    const primary = createProject()
    const worktreeParent = mkdtempSync(join(tmpdir(), "persona-source-identity-worktree-"))
    const worktree = join(worktreeParent, "caller")
    projects.push(worktreeParent)
    execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: primary })

    expect(captureSourceIdentity(worktree, git(worktree), ".persona/evidence").status).toBe("available")
    unlinkSync(join(worktree, "src", "App.java"))
    symlinkSync("../package.json", join(worktree, "src", "App.java"))
    expect(captureSourceIdentity(worktree, git(worktree), ".persona/evidence")).toEqual({
      diagnosticCode: "source-identity-symlink",
      status: "unavailable",
    })
  })
})

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-source-identity-"))
  projects.push(projectDir)
  createProjectAt(projectDir)
  return projectDir
}

function createProjectAt(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
  mkdirSync(join(projectDir, "src"), { recursive: true })
  mkdirSync(join(projectDir, "build"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), '{"evidenceDir":".persona/evidence"}\n')
  writeFileSync(join(projectDir, "package.json"), '{"name":"fixture"}\n')
  writeFileSync(join(projectDir, "src", "App.java"), "class App {}\n")
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "source identity fixture"], { cwd: projectDir })
}

function capture(projectDir: string): SourceIdentity {
  const result = captureSourceIdentity(projectDir, git(projectDir), ".persona/evidence")
  if (result.status !== "available") {
    throw new Error(`expected source identity, received ${result.diagnosticCode}`)
  }
  return result.value
}

function git(projectDir: string) {
  const root = captureWorkspaceIdentity(projectDir)
  if (root.status !== "available") {
    throw new Error(`expected workspace identity, received ${root.diagnosticCode}`)
  }
  const result = captureGitIdentity(projectDir, root.value)
  if (!result.available) {
    throw new Error(`expected Git identity, received ${result.diagnosticCode}`)
  }
  return result
}
