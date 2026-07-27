import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  createRealCooperativeGradleFixture,
  hasRealJUnitResult,
  type RealCooperativeGradleFixture,
} from "./helpers/cooperative-real-gradle-fixture.js"
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
import type { SourceIdentity } from "../src/cli/source-identity-types.js"

const fixtures: RealCooperativeGradleFixture[] = []
const consumerWorktrees: Array<{ readonly parent: string; readonly projectDir: string; readonly repositoryDir: string }> = []

afterEach(() => {
  for (const consumer of consumerWorktrees.splice(0)) {
    if (existsSync(consumer.projectDir)) {
      execFileSync("git", ["worktree", "remove", "--force", consumer.projectDir], { cwd: consumer.repositoryDir })
    }
    rmSync(consumer.parent, { force: true, recursive: true })
  }
  for (const fixture of fixtures.splice(0)) {
    fixture.cleanup()
  }
})

describe.sequential("real Java/Spring Gradle cooperative Finish", () => {
  it("passes a fresh project through the public source CLI without disk authority", () => {
    // Given: a fresh Git-backed Java/Spring project with a genuine Gradle wrapper.
    const fixture = track(createRealCooperativeGradleFixture())

    // When: the public source CLI runs explicit cooperative Finish.
    const profileRead = run(fixture.projectDir, ["evidence", "read", ".persona/project-profile.jsonc"])
    const roleRead = run(fixture.projectDir, ["evidence", "read", "src/main/java/example/cooperative/GreetingService.java"])
    const defaultFinish = run(fixture.projectDir, ["workflow", "finish", "implement"])
    const cooperativeFinish = run(fixture.projectDir, ["workflow", "finish", "implement", "--assurance", "cooperative"])
    const closure = run(fixture.projectDir, ["workflow", "closure", "next", "--json"])

    // Then: real JUnit exists, cooperative Finish passes, and later closure stays external-blocked.
    expect(profileRead.status, profileRead.stderr).toBe(0)
    expect(roleRead.status, roleRead.stderr).toBe(0)
    expect(defaultFinish.status).toBe(1)
    expect(cooperativeFinish.status, cooperativeFinish.stderr).toBe(0)
    expect(cooperativeFinish.stdout).toContain("Finish status: PASS")
    expect(hasRealJUnitResult(fixture.projectDir)).toBe(true)
    expect(readFileSync(join(fixture.projectDir, "build", "test-results", "test", "TEST-example.cooperative.CooperativeApplicationTest.xml"), "utf8"))
      .toContain("<testcase")
    expect(JSON.parse(closure.stdout)).toMatchObject({ state: { finish: "blocked" } })
    expect(closure.stdout).toContain("trusted-authority-required")
    expect(existsSync(join(fixture.projectDir, ".persona", "custom-evidence", "verification-receipts"))).toBe(false)
    expect(existsSync(join(fixture.projectDir, ".persona", "custom-evidence", "verification-attempts"))).toBe(false)
    expect(existsSync(join(fixture.projectDir, ".persona", "custom-evidence", "finish-attestation"))).toBe(false)
  }, 300_000)

  it("drives a fresh Java/Spring Gradle project through public bootstrap, reports, and cooperative Finish", () => {
    // Given: a Git-backed Spring/Gradle project without pre-seeded Persona records.
    const fixture = track(createRealCooperativeGradleFixture())
    resetToFreshProject(fixture.projectDir)
    expect(run(fixture.projectDir, ["bootstrap", "backend", "--strict", "--no-developer-mcp"]).status).toBe(0)
    commitBootstrapCheckpoint(fixture.projectDir)
    const expected = captureBoundSourceIdentity(fixture.projectDir)
    const consumerParent = mkdtempSync(join(tmpdir(), "persona-real-cooperative-consumer-"))
    const consumer = join(consumerParent, "project")
    execFileSync("git", ["worktree", "add", "--detach", consumer, "HEAD"], { cwd: fixture.projectDir })
    consumerWorktrees.push({ parent: consumerParent, projectDir: consumer, repositoryDir: fixture.projectDir })

    // When: the public CLI creates and completes the normal workflow before Finish.
    const bootstrap = run(consumer, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])
    const test = run(consumer, ["bearshell", "./gradlew", "test"])
    const compile = run(consumer, ["bearshell", "./gradlew", "compileJava"])
    const clean = run(consumer, ["bearshell", "./gradlew", "clean"])
    const readmeRead = run(consumer, ["evidence", "read", "README.md"])
    const profileRead = run(consumer, ["evidence", "read", ".persona/project-profile.jsonc"])
    const roleRead = run(consumer, ["evidence", "read", "src/main/java/example/cooperative/GreetingService.java"])
    const implementation = run(
      consumer,
      ["plan", "--report-filled", "implementation", "--stdin"],
      publicImplementationReport(),
    )
    const review = run(
      consumer,
      ["plan", "--report-filled", "review", "--stdin"],
      publicReviewReport(),
    )
    const defaultFinish = run(consumer, ["workflow", "finish", "implement"])
    const cooperativeFinish = run(consumer, ["workflow", "finish", "implement", "--assurance", "cooperative"])
    const closure = run(consumer, ["workflow", "closure", "next", "--json"])

    // Then: only explicit same-invocation cooperative Finish may pass.
    expect(bootstrap.status, bootstrap.stderr).toBe(0)
    expect(unexpectedSourceMutations(consumer)).toEqual([])
    expect(matchesAt(consumer, expected), sourceBindingDiagnostic(consumer, expected, fixture.projectDir)).toBe(true)
    expect(test.status, test.stderr).toBe(0)
    expect(compile.status, compile.stderr).toBe(0)
    expect(clean.status, clean.stderr).toBe(0)
    expect(readmeRead.status, readmeRead.stderr).toBe(0)
    expect(profileRead.status, profileRead.stderr).toBe(0)
    expect(roleRead.status, roleRead.stderr).toBe(0)
    expect(matchesAt(consumer, expected)).toBe(true)
    expect(implementation.status, implementation.stderr).toBe(0)
    expect(review.status, review.stderr).toBe(0)
    expect(matchesAt(consumer, expected)).toBe(true)
    expect(defaultFinish.status).toBe(1)
    expect(defaultFinish.stderr).toContain("trusted-authority-required")
    expect(defaultFinish.stderr).not.toContain("evidence-missing")
    expect(defaultFinish.stderr).not.toContain("report-coverage-missing")
    expect(defaultFinish.stderr).not.toContain("profile-read-coverage-missing")
    expect(defaultFinish.stderr).not.toContain("java-role-read-coverage-missing")
    expect(matchesAt(consumer, expected)).toBe(true)
    expect(cooperativeFinish.status, cooperativeFinish.stderr).toBe(0)
    expect(cooperativeFinish.stdout).toContain("Finish status: PASS")
    expect(matchesAt(consumer, expected)).toBe(true)
    expect(JSON.parse(closure.stdout)).toMatchObject({ state: { finish: "blocked" } })
    expect(closure.stdout).toContain("trusted-authority-required")
  }, 300_000)
})

function run(projectDir: string, args: readonly string[], stdin?: string) {
  return withCurrentDirectory(projectDir, () => runPersonaCli(args, { cwd: ".", env: {}, invocationName: "ph", stdin }))
}

function track(fixture: RealCooperativeGradleFixture): RealCooperativeGradleFixture {
  fixtures.push(fixture)
  return fixture
}

function resetToFreshProject(projectDir: string): void {
  rmSync(join(projectDir, ".persona"), { force: true, recursive: true })
  execFileSync("git", ["add", "--all"], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "remove pre-seeded Persona records"], { cwd: projectDir })
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

function matchesAt(projectDir: string, expected: SourceIdentity): boolean {
  return withCurrentDirectory(projectDir, () => matchesProjectFinishAttestationSource(".", expected))
}

function unexpectedSourceMutations(projectDir: string): readonly string[] {
  return execFileSync("git", ["status", "--porcelain"], { cwd: projectDir, encoding: "utf8" })
    .split("\n")
    .filter((line) => line.length > 3)
    .map((line) => line.slice(3))
    .filter((path) => ![
      ".gradle/",
      "build/",
      "node_modules/",
      ".persona/evidence/",
      ".persona/workflow/",
    ].some((root) => path.startsWith(root)))
}

function sourceBindingDiagnostic(projectDir: string, expected: SourceIdentity, producerDir: string): string {
  return withCurrentDirectory(projectDir, () => {
    const workspace = captureWorkspaceIdentity(".")
    if (workspace.status !== "available") return "workspace unavailable"
    const git = captureGitIdentity(".", workspace.value)
    const source = captureProjectFinishAttestationSourceIdentity(".", git)
    const entries = captureProjectFinishAttestationSourceEntries(".", git)
    const producerGit = withCurrentDirectory(producerDir, () => {
      const producerWorkspace = captureWorkspaceIdentity(".")
      return producerWorkspace.status === "available"
        ? captureGitIdentity(".", producerWorkspace.value)
        : undefined
    })
    const summary = source.status === "available"
      ? {
        counts: [source.value.entryCount, source.value.trackedEntryCount, source.value.untrackedEntryCount],
        expectedCounts: [expected.entryCount, expected.trackedEntryCount, expected.untrackedEntryCount],
        headMatches: source.value.repositoryHead === expected.repositoryHead,
        statusMatches: source.value.gitStatusDigest === expected.gitStatusDigest,
        trackedIndexMatches: source.value.trackedIndexDigest === expected.trackedIndexDigest,
      }
      : { source: source.diagnosticCode }
    return JSON.stringify({
      entryCount: entries.status === "available" ? entries.value.length : entries.diagnosticCode,
      producerStatus: producerGit?.available ? summarizeStatus(producerGit.status?.entries ?? []) : "unavailable",
      status: git.available ? summarizeStatus(git.status?.entries ?? []) : "unavailable",
      summary,
    })
  })
}

function withCurrentDirectory<T>(projectDir: string, operation: () => T): T {
  const original = process.cwd()
  process.chdir(projectDir)
  try {
    return operation()
  } finally {
    process.chdir(original)
  }
}

function summarizeStatus(entries: readonly { readonly kind: string; readonly path?: string }[]): Readonly<Record<string, number>> {
  const summary: Record<string, number> = {}
  for (const entry of entries) {
    const path = entry.path ?? ""
    const root = path.startsWith(".gradle/") ? "gradle"
      : path.startsWith("build/") ? "build"
        : path.startsWith("node_modules/") ? "node-modules"
          : path.startsWith(".persona/evidence/") ? "evidence"
            : path.startsWith(".persona/workflow/") ? "workflow"
              : "other"
    const key = `${entry.kind}:${root}`
    summary[key] = (summary[key] ?? 0) + 1
  }
  return summary
}

function publicImplementationReport(): string {
  return [
    "Status: filled",
    "- README ranges read: all",
    "- Project profile ranges read: all",
    "- `npx ph bearshell ./gradlew test`",
    "- `npx ph bearshell ./gradlew compileJava`",
  ].join("\n")
}

function publicReviewReport(): string {
  return [
    "Status: filled",
    "- Manual QA reviewed the Java/Spring Gradle project.",
    "- `npx ph bearshell ./gradlew clean`",
  ].join("\n")
}
