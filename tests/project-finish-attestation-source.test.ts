import { execFileSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { captureGitIdentity, captureWorkspaceIdentity } from "../src/cli/ci-reverification-identity.js"
import {
  bindProjectFinishAttestationInputSnapshot,
  captureProjectFinishAttestationInputSnapshot,
} from "../src/cli/project-finish-attestation-inputs.js"
import {
  captureProjectFinishAttestationSourceEntries,
  captureProjectFinishAttestationSourceIdentity,
  matchesProjectFinishAttestationSource,
} from "../src/cli/project-finish-attestation-source.js"
import { runPersonaCli } from "../src/cli/index.js"
import type { SourceIdentity } from "../src/cli/source-identity-types.js"

const temporaryRoots: string[] = []

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true })
  }
})

describe("project finish attestation source binding", () => {
  it("preserves the public bootstrap projection without a producer-only Git checkpoint", () => {
    const primary = createPublicProject()
    const producerBootstrap = run(primary, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])
    expect(producerBootstrap.status, producerBootstrap.stderr).toBe(0)
    const expected = captureBoundSourceIdentity(primary)
    const worktreeParent = track(mkdtempSync(join(tmpdir(), "persona-project-finish-source-")))
    const worktree = join(worktreeParent, "consumer")
    execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: primary })

    const consumerBootstrap = run(worktree, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])

    expect(consumerBootstrap.status, consumerBootstrap.stderr).toBe(0)
    expect(sourceEntryDifferences(primary, worktree)).toEqual([])
    expect(captureBoundSourceEntries(worktree)).toEqual(captureBoundSourceEntries(primary))
    expect(captureBoundSourceIdentity(worktree)).toEqual(expected)
    expect(matchesAt(worktree, expected)).toBe(true)
  })

  it("preserves a checkpointed source binding through the public bootstrap and workflow lifecycle", () => {
    const primary = createPublicProject()
    const bootstrap = run(primary, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])
    expect(bootstrap.status, bootstrap.stderr).toBe(0)
    commitBootstrapCheckpoint(primary)
    const expected = captureBoundSourceIdentity(primary)
    const worktreeParent = track(mkdtempSync(join(tmpdir(), "persona-project-finish-source-")))
    const worktree = join(worktreeParent, "consumer")
    execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: primary })

    expect(run(worktree, ["bootstrap", "backend", "--strict", "--no-developer-mcp"]).status).toBe(0)
    expect(run(worktree, ["bearshell", "./gradlew", "test"]).status).toBe(0)
    expect(run(worktree, ["bearshell", "./gradlew", "compileJava"]).status).toBe(0)
    expect(run(worktree, ["bearshell", "./gradlew", "clean"]).status).toBe(0)
    expect(run(worktree, ["plan", "--report-filled", "implementation", "--stdin"], implementationReport()).status).toBe(0)
    expect(run(worktree, ["plan", "--report-filled", "review", "--stdin"], reviewReport()).status).toBe(0)

    expect(matchesAt(worktree, expected)).toBe(true)
  })

  it("keeps runtime workflow and evidence state out of the signed source comparison", () => {
    const primary = createProject()
    const expected = captureBoundSourceIdentity(primary)
    const worktreeParent = track(mkdtempSync(join(tmpdir(), "persona-project-finish-source-")))
    const worktree = join(worktreeParent, "consumer")
    execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: primary })

    mkdirSync(join(worktree, ".persona", "evidence", "phase0"), { recursive: true })
    mkdirSync(join(worktree, ".persona", "workflow"), { recursive: true })
    writeFileSync(join(worktree, ".persona", "evidence", "phase0", "bearshell.json"), "evidence\n")
    writeFileSync(join(worktree, ".persona", "workflow", "implementation-report.md"), "Status: filled\n")
    mkdirSync(join(worktree, ".gradle"), { recursive: true })
    writeFileSync(join(worktree, ".gradle", "execution-cache.bin"), "cache\n")

    expect(matchesAt(worktree, expected)).toBe(true)

    writeFileSync(join(worktree, ".persona", "project-profile.jsonc"), "unsafe profile drift\n")

    expect(matchesAt(worktree, expected)).toBe(false)
  })

  it("accepts a portable signed binding in a clean worktree and blocks tracked source drift", () => {
    const primary = createProject()
    const expected = captureBoundSourceIdentity(primary)
    const worktreeParent = track(mkdtempSync(join(tmpdir(), "persona-project-finish-source-")))
    const worktree = join(worktreeParent, "consumer")
    execFileSync("git", ["worktree", "add", "--detach", worktree, "HEAD"], { cwd: primary })
    mkdirSync(join(worktree, ".persona", "evidence", "project-finish-attestation"), { recursive: true })

    expect(matchesAt(worktree, expected)).toBe(true)

    writeFileSync(join(worktree, "ignored-source.txt"), "ignored source drift\n")

    expect(matchesAt(worktree, expected)).toBe(false)

    rmSync(join(worktree, "ignored-source.txt"))
    writeFileSync(join(worktree, "README.md"), "tracked source drift\n")

    expect(matchesAt(worktree, expected)).toBe(false)
  })

  it("blocks a source matcher leaf alias without recovering authority", () => {
    const projectDir = createProject()
    const expected = captureBoundSourceIdentity(projectDir)
    const sourcePath = join(projectDir, "README.md")
    const outsidePath = join(track(mkdtempSync(join(tmpdir(), "persona-project-finish-outside-"))), "README.md")
    writeFileSync(outsidePath, "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa\n")
    rmSync(sourcePath)
    symlinkSync(outsidePath, sourcePath)

    const result = matchesAt(projectDir, expected)

    expect(result).toBe(false)
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

function createPublicProject(): string {
  const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-public-source-")))
  writeFileSync(join(projectDir, "README.md"), "# Public project fixture\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'public-fixture'\n")
  writeFileSync(
    join(projectDir, "gradlew"),
    [
      "#!/bin/sh",
      "for arg in \"$@\"; do",
      "  case \"$arg\" in",
      "    test) echo '> Task :test' ;;",
      "    compileJava) echo '> Task :compileJava' ;;",
      "    clean) echo '> Task :clean' ;;",
      "  esac",
      "done",
      "exit 0",
      "",
    ].join("\n"),
  )
  chmodSync(join(projectDir, "gradlew"), 0o755)
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "public source fixture"], { cwd: projectDir })
  return projectDir
}

function commitBootstrapCheckpoint(projectDir: string): void {
  execFileSync("git", ["add", "--all"], { cwd: projectDir })
  execFileSync("git", ["reset", "--", ".persona/evidence", ".persona/workflow"], { cwd: projectDir })
  const staticPersonaPaths = [
    ".persona/.ph-init-manifest.json",
    ".persona/conventions",
    ".persona/harness.jsonc",
    ".persona/policies",
    ".persona/project-profile.jsonc",
    ".persona/rules",
  ].filter((relativePath) => existsSync(join(projectDir, relativePath)))
  if (staticPersonaPaths.length > 0) {
    execFileSync("git", ["add", "-f", "--", ...staticPersonaPaths], { cwd: projectDir })
  }
  execFileSync("git", ["commit", "-qm", "public bootstrap checkpoint"], { cwd: projectDir })
}

function run(projectDir: string, args: readonly string[], stdin?: string) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph", stdin })
}

function implementationReport(): string {
  return [
    "Status: filled",
    "- README ranges read: all",
    "- Project profile ranges read: all",
    "- `npx ph bearshell ./gradlew test`",
    "- `npx ph bearshell ./gradlew compileJava`",
  ].join("\n")
}

function reviewReport(): string {
  return [
    "Status: filled",
    "- Manual QA reviewed the Java/Spring Gradle project.",
    "- `npx ph bearshell ./gradlew clean`",
  ].join("\n")
}

function captureBoundSourceIdentity(projectDir: string): SourceIdentity {
  return withCurrentDirectory(projectDir, () => {
    const workspace = captureWorkspaceIdentity(".")
    if (workspace.status !== "available") throw new Error("workspace identity must be available")
    const git = captureGitIdentity(".", workspace.value)
    if (!git.available) throw new Error("Git identity must be available")
    const source = captureProjectFinishAttestationSourceIdentity(".", git)
    if (source.status !== "available") throw new Error("source identity must be available")
    const inputs = captureProjectFinishAttestationInputSnapshot(".")
    if (inputs.kind !== "ready") throw new Error("project inputs must be available")
    return bindProjectFinishAttestationInputSnapshot(source.value, inputs.value)
  })
}

function captureBoundSourceEntries(projectDir: string) {
  return withCurrentDirectory(projectDir, () => {
    const workspace = captureWorkspaceIdentity(".")
    if (workspace.status !== "available") throw new Error("workspace identity must be available")
    const git = captureGitIdentity(".", workspace.value)
    if (!git.available) throw new Error("Git identity must be available")
    const source = captureProjectFinishAttestationSourceEntries(".", git)
    if (source.status !== "available") throw new Error("source entries must be available")
    return source.value
  })
}

function sourceEntryDifferences(left: string, right: string): readonly string[] {
  const leftEntries = new Map(captureBoundSourceEntries(left).map((entry) => [JSON.stringify(entry), entry.path]))
  const rightEntries = new Map(captureBoundSourceEntries(right).map((entry) => [JSON.stringify(entry), entry.path]))
  return [...new Set([
    ...[...leftEntries.entries()].filter(([entry]) => !rightEntries.has(entry)).map(([, path]) => path),
    ...[...rightEntries.entries()].filter(([entry]) => !leftEntries.has(entry)).map(([, path]) => path),
  ])].sort()
}

function matchesAt(projectDir: string, expected: SourceIdentity): boolean {
  return withCurrentDirectory(projectDir, () => matchesProjectFinishAttestationSource(".", expected))
}

function withCurrentDirectory<T>(directory: string, operation: () => T): T {
  const original = process.cwd()
  process.chdir(directory)
  try {
    return operation()
  } finally {
    process.chdir(original)
  }
}

function track(root: string): string {
  temporaryRoots.push(root)
  return root
}
