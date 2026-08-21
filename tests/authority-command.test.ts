import { createHash } from "node:crypto"
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  authorityEnrollmentFromReadback,
  readAuthorityEnrollment,
  runAuthorityCommand,
} from "../src/cli/authority-command.js"
import { readAuthorityArtifact } from "../src/cli/authority-artifact-store.js"
import { selectAuthorityGithubToken } from "../src/cli/authority-github-token.js"
import {
  writeAuthorityEnrollment,
  type AuthorityEnrollment,
} from "../src/cli/authority-enrollment.js"
import { runPersonaCli } from "../src/cli/index.js"
import { parseProjectFinishAttestationStatement } from "../src/cli/project-finish-attestation-parser.js"
import { projectFinishAttestationReusableCertificateSan } from "../src/cli/project-finish-attestation-workflow-identity.js"
import { personaHarnessVersion } from "../src/cli/version.js"
import { createValidProjectFinishAttestationStatement } from "./helpers/project-finish-attestation-fixture.js"

const projects: string[] = []

afterEach(() => {
  vi.unstubAllEnvs()
  for (const project of projects.splice(0)) rmSync(project, { force: true, recursive: true })
})

describe("consumer authority command boundary", () => {
  it("selects only a bounded standard GitHub transport credential", () => {
    expect(selectAuthorityGithubToken({
      GITHUB_TOKEN: "fallback-test-credential",
      GH_TOKEN: "preferred-test-credential",
    })).toBe("preferred-test-credential")
    expect(selectAuthorityGithubToken({
      GH_TOKEN: "unsafe\ncredential",
    })).toBeUndefined()
  })

  it("keeps noninteractive content from enrolling a repository", () => {
    const projectDir = project()

    const result = runAuthorityCommand([
      "enroll",
      "github",
      "example/public-gradle-app",
      "--workflow",
      ".github/workflows/persona-harness.yml",
    ], {
      githubToken: "github-test-credential",
      projectDir,
      storeRoot: join(projectDir, "user-store"),
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("requires interactive confirmation")
    expect(readAuthorityEnrollment(projectDir, { storeRoot: join(projectDir, "user-store") }).state).toBe("missing")
  })

  it("accepts only a fixed public GitHub readback shape as enrollment policy", () => {
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "a".repeat(40),
    })

    expect(enrollment).toMatchObject({
      callerWorkflowPath: "persona-harness.yml",
      event: "push",
      ref: "refs/heads/main",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
    })
    expect(authorityEnrollmentFromReadback({
      callerWorkflowPath: "unsafe?ref=other.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "a".repeat(40),
    })).toBeUndefined()
  })

  it("keeps status non-consuming and bounded when no enrollment exists", () => {
    const projectDir = project()

    const plain = runAuthorityCommand(["status"], {
      projectDir,
      storeRoot: join(projectDir, "user-store"),
    })
    const json = runAuthorityCommand(["status", "--json"], {
      projectDir,
      storeRoot: join(projectDir, "user-store"),
    })

    expect(plain.status).toBe(1)
    expect(plain.stdout).toContain("Enrollment: unavailable")
    expect(json.status).toBe(1)
    expect(JSON.parse(json.stdout)).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      enrollment: "unavailable",
      githubAuthentication: "unavailable",
      next: "github-authenticate",
      state: "authentication-unavailable",
    })
    expect(`${plain.stdout}${plain.stderr}${json.stdout}${json.stderr}`).not.toContain(projectDir)
  })

  it("exposes the non-consuming authority status through the public root command", () => {
    const projectDir = project()
    const home = project()
    vi.stubEnv("HOME", home)
    const result = runPersonaCli(["authority", "status"], {
      cwd: projectDir,
      env: { GH_TOKEN: "github-test-credential" },
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Enrollment: unavailable")
    expect(result.stdout).not.toContain(projectDir)
    expect(result.stdout).not.toContain(home)
  })

  it("requires GitHub authentication only as transport authority before fixed readback", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")

    const result = runAuthorityCommand([
      "enroll",
      "github",
      "example/public-gradle-app",
      "--workflow",
      "persona-harness.yml",
    ], {
      confirmEnrollment: true,
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("GH_TOKEN or GITHUB_TOKEN")
    expect(`${result.stdout}${result.stderr}`).not.toContain(projectDir)
    expect(readAuthorityEnrollment(projectDir, { storeRoot }).state).toBe("missing")
  })

  it("keeps a host transport credential out of the persisted enrollment and command output", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    const credential = "ghp_host_transport_probe"

    const result = runAuthorityCommand([
      "enroll",
      "github",
      "example/public-gradle-app",
      "--workflow",
      "persona-harness.yml",
    ], {
      confirmEnrollment: true,
      enrollmentReadback: () => ({
        callerWorkflowPath: "persona-harness.yml",
        repositoryId: 987654321,
        repositorySlug: "example/public-gradle-app",
        reusableWorkflowSha: "a".repeat(40),
      }),
      githubToken: credential,
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(0)
    expect(`${result.stdout}${result.stderr}`).not.toContain(credential)
    expect(readFileSync(join(storeRoot, "consumer-authority-v1.json"), "utf8")).not.toContain(credential)
  })

  it("fetches only a product-owned original archive into the user store without creating workspace authority", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined) throw new Error("fixture enrollment must parse")
    expect(writeAuthorityEnrollment(enrollment, { storeRoot })).toBe(true)
    const archive = artifactArchive()
    const artifactDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`

    const result = runAuthorityCommand([
      "fetch",
      "github",
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      artifactDigest,
      "--json",
    ], {
      artifactFetch: () => ({
        archive,
        artifactId: 11,
        artifactDigest,
        fetchedAt: "2026-07-24T00:00:00.000Z",
        repositoryId: 987654321,
        runId: "1001",
        sourceHead: "a".repeat(40),
      }),
      artifactInspector: () => ({
        authorityEligible: true,
        consumptionState: "unconsumed",
        decision: "trusted",
        diagnostics: [],
        receipt: trustedReceiptFor(enrollment, "1001"),
        state: "trusted",
        summary: "trusted",
      }),
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toEqual({
      artifact: {
        digest: artifactDigest,
        id: 11,
        runId: "1001",
        sourceHead: "a".repeat(40),
      },
      authorityEligible: true,
      consumptionState: "unconsumed",
      next: "workflow-finish",
      schemaVersion: "consumer-authority-fetch.4",
      state: "trusted",
    })
    expect(readAuthorityArtifact(987654321, { storeRoot }).state).toBe("ready")
    expect(existsSync(join(projectDir, ".persona", "evidence", "project-finish-attestation", "bundle.json"))).toBe(false)
    expect(`${result.stdout}${result.stderr}`).not.toContain(projectDir)
  })

  it.each([
    ["repository head", "source.repositoryHead", "head"],
    ["input snapshot", "source.inputs", "inputs"],
    ["source identity", "source.identity", "identity"],
    ["git identity", "source.git", "identity"],
    ["git status", "source.gitStatusDigest", "status"],
    ["tracked index", "source.trackedIndexDigest", "index"],
    ["content", "source.contentDigest", "content"],
    ["working tree", "source.workingTreeBytesDifferFromMatchingGitIndex", "working-tree"],
    ["workspace", "workspace", "workspace"],
    ["unknown path", "source.future", "unknown"],
    ["missing path", undefined, "unknown"],
  ] as const)("retains only a bounded source reason for %s", (_label, path, expectedReason) => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const artifactDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`
    const result = runAuthorityCommand([
      "fetch",
      "github",
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      artifactDigest,
      "--json",
    ], {
      artifactFetch: () => ({
        archive,
        artifactId: 11,
        artifactDigest,
        fetchedAt: "2026-07-24T00:00:00.000Z",
        repositoryId: enrollment.repositoryId,
        runId: "1001",
        sourceHead: "a".repeat(40),
      }),
      artifactInspector: () => ({
        authorityEligible: false,
        consumptionState: "not-applicable" as const,
        decision: "blocked" as const,
        diagnostics: path === undefined ? [] : [{ code: "source-drift" as const, path }],
        state: "source-drift" as const,
        summary: "source binding blocked",
      }),
      projectDir,
      storeRoot,
    })

    const output = JSON.parse(result.stdout) as Record<string, unknown>
    expect(result.status).toBe(1)
    expect(output).toMatchObject({
      authorityEligible: false,
      bindingReason: "source",
      consumptionState: "not-applicable",
      sourceReason: expectedReason,
      state: "binding-mismatch",
    })
    expect(output).not.toHaveProperty("diagnostics")
    expect(output).not.toHaveProperty("receipt")
    expect(output).not.toHaveProperty("sourceHead")
    expect(JSON.stringify(output)).not.toContain("source.future")
    expect(readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state).toBe("missing")
  })

  it("does not add a source reason to a non-source binding result", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const artifactDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`
    const result = runAuthorityCommand([
      "fetch",
      "github",
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      artifactDigest,
      "--json",
    ], {
      artifactFetch: () => ({
        archive,
        artifactId: 11,
        artifactDigest,
        fetchedAt: "2026-07-24T00:00:00.000Z",
        repositoryId: enrollment.repositoryId,
        runId: "1001",
        sourceHead: "a".repeat(40),
      }),
      artifactInspector: () => ({
        authorityEligible: false,
        consumptionState: "not-applicable" as const,
        decision: "blocked" as const,
        diagnostics: [{ code: "binding-mismatch" as const, path: "predicate.receipt.phVersion" }],
        state: "binding-mismatch" as const,
        summary: "package binding blocked",
      }),
      projectDir,
      storeRoot,
    })

    const output = JSON.parse(result.stdout) as Record<string, unknown>
    expect(result.status).toBe(1)
    expect(output).toMatchObject({ bindingReason: "package-version", state: "binding-mismatch" })
    expect(output).not.toHaveProperty("sourceReason")
  })

  it("blocks repo-only authority selection before fetching or retaining an artifact", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const artifactFetch = vi.fn(() => undefined)

    const result = runAuthorityCommand(["fetch", "github", "--json"], {
      artifactFetch,
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      consumptionState: "not-applicable",
      state: "selection-required",
    })
    expect(artifactFetch).not.toHaveBeenCalled()
    expect(readAuthorityArtifact(987654321, { storeRoot }).state).toBe("missing")
  })

  it.each([
    ["partial tuple", ["fetch", "github", "--artifact-id", "11", "--json"]],
    ["zero artifact id", ["fetch", "github", "--artifact-id", "0", "--run-id", "1001", "--source-head", "a".repeat(40), "--artifact-digest", `sha256:${"a".repeat(64)}`, "--json"]],
    ["malformed digest", ["fetch", "github", "--artifact-id", "11", "--run-id", "1001", "--source-head", "a".repeat(40), "--artifact-digest", "sha256:invalid", "--json"]],
    ["malformed source head", ["fetch", "github", "--artifact-id", "11", "--run-id", "1001", "--source-head", "not-a-commit", "--artifact-digest", `sha256:${"a".repeat(64)}`, "--json"]],
  ] as const)("blocks a %s selector before enrollment or fetching", (_label, args) => {
    const projectDir = project()
    const artifactFetch = vi.fn(() => undefined)

    const result = runAuthorityCommand(args, {
      artifactFetch,
      projectDir,
      storeRoot: join(projectDir, "user-store"),
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      consumptionState: "not-applicable",
      state: "selection-required",
    })
    expect(artifactFetch).not.toHaveBeenCalled()
  })

  it.each([
    ["artifactId", { artifactId: 12, artifactDigest: undefined, runId: undefined, sourceHead: undefined }, "artifact"],
    ["runId", { artifactId: undefined, artifactDigest: undefined, runId: "1002", sourceHead: undefined }, "run"],
    ["sourceHead", { artifactId: undefined, artifactDigest: undefined, runId: undefined, sourceHead: "b".repeat(40) }, "source"],
    ["artifactDigest", { artifactId: undefined, artifactDigest: `sha256:${"0".repeat(64)}`, runId: undefined, sourceHead: undefined }, "artifact"],
  ] as const)("blocks a returned artifact when its %s differs from the explicit tuple", (_field, change, expectedReason) => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const artifactDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`
    const expected = {
      artifactId: 11,
      artifactDigest,
      runId: "1001",
      sourceHead: "a".repeat(40),
    }
    const returned = {
      archive,
      artifactId: change.artifactId ?? expected.artifactId,
      artifactDigest: change.artifactDigest ?? expected.artifactDigest,
      fetchedAt: "2026-07-24T00:00:00.000Z",
      repositoryId: enrollment.repositoryId,
      runId: change.runId ?? expected.runId,
      sourceHead: change.sourceHead ?? expected.sourceHead,
    }
    const artifactInspector = vi.fn(() => ({
      authorityEligible: true as const,
      consumptionState: "unconsumed" as const,
      decision: "trusted" as const,
      diagnostics: [],
      receipt: trustedReceiptFor(enrollment, expected.runId),
      state: "trusted" as const,
      summary: "trusted",
    }))

    const result = runAuthorityCommand([
      "fetch",
      "github",
      "--artifact-id",
      String(expected.artifactId),
      "--run-id",
      expected.runId,
      "--source-head",
      expected.sourceHead,
      "--artifact-digest",
      expected.artifactDigest,
      "--json",
    ], {
      artifactFetch: () => returned,
      artifactInspector,
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      bindingReason: expectedReason,
      consumptionState: "not-applicable",
      state: "binding-mismatch",
    })
    expect(artifactInspector).not.toHaveBeenCalled()
    expect(readAuthorityArtifact(987654321, { storeRoot }).state).toBe("missing")
  })

  it("does not retain a verified-shaped archive when fetched run identity differs from the signed receipt", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const artifactDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`

    const result = runAuthorityCommand([
      "fetch",
      "github",
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      artifactDigest,
      "--json",
    ], {
      artifactFetch: () => ({
        archive,
        artifactId: 11,
        artifactDigest,
        fetchedAt: "2026-07-24T00:00:00.000Z",
        repositoryId: 987654321,
        runId: "10",
        sourceHead: "a".repeat(40),
      }),
      artifactInspector: () => ({
        authorityEligible: true,
        consumptionState: "unconsumed",
        decision: "trusted",
        diagnostics: [],
        receipt: trustedReceiptFor(enrollment, "1001"),
        state: "trusted",
        summary: "trusted",
      }),
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({ state: "binding-mismatch" })
    expect(readAuthorityArtifact(987654321, { storeRoot }).state).toBe("missing")
  })

  it("selects one explicit enrolled repository when the user store contains multiple entries", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    for (const [repositoryId, repositorySlug] of [
      [987654321, "example/public-gradle-app"],
      [987654322, "example/second-gradle-app"],
    ] as const) {
      const enrollment = authorityEnrollmentFromReadback({
        callerWorkflowPath: "project-finish.yml",
        repositoryId,
        repositorySlug,
        reusableWorkflowSha: "b".repeat(40),
      }, new Date("2026-07-24T00:00:00.000Z"))
      if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
        throw new Error("fixture enrollment must persist")
      }
    }
    const archive = artifactArchive()
    const artifactFetch = vi.fn((_candidateProjectDir: string, enrollment: AuthorityEnrollment) => ({
      archive,
      artifactId: 11,
      artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      fetchedAt: "2026-07-24T00:00:00.000Z",
      repositoryId: enrollment.repositoryId,
      runId: "10",
      sourceHead: "a".repeat(40),
    }))
    const artifactInspector = (_candidateProjectDir: string, enrollment: AuthorityEnrollment) => ({
      authorityEligible: true as const,
      consumptionState: "unconsumed" as const,
      decision: "trusted" as const,
      diagnostics: [],
      receipt: trustedReceiptFor(enrollment, "10"),
      state: "trusted" as const,
      summary: "trusted",
    })

    const ambiguous = runAuthorityCommand(["fetch", "github", "--json"], {
      artifactFetch,
      artifactInspector,
      projectDir,
      storeRoot,
    })
    expect(ambiguous.status).toBe(1)
    expect(JSON.parse(ambiguous.stdout)).toMatchObject({
      next: "authority-fetch-github",
      state: "selection-required",
    })
    expect(artifactFetch).not.toHaveBeenCalled()

    const selected = runAuthorityCommand([
      "fetch",
      "github",
      "example/second-gradle-app",
      "--artifact-id",
      "11",
      "--run-id",
      "10",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      "--json",
    ], {
      artifactFetch,
      artifactInspector,
      projectDir,
      storeRoot,
    })
    expect(selected.status).toBe(0)
    expect(artifactFetch).toHaveBeenCalledOnce()
    expect(artifactFetch.mock.calls[0]?.[1]).toMatchObject({
      repositoryId: 987654322,
      repositorySlug: "example/second-gradle-app",
    })
  })

  it("verifies one explicit original archive without storing or consuming authority", () => {
    const gitProject = gitBackedProject()
    const projectDir = gitProject.path
    const sourceHead = gitProject.head
    const packageRoot = installedPackageRoot()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(archivePath, archive)
    const artifactDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`
    const result = runAuthorityCommand([
      "verify",
      "example/public-gradle-app",
      "--archive",
      realpathSync(archivePath),
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      sourceHead,
      "--artifact-digest",
      artifactDigest,
      "--json",
    ], {
      artifactInspector: () => ({
        authorityEligible: true,
        consumptionState: "unconsumed",
        decision: "trusted",
        diagnostics: [],
        receipt: trustedReceiptFor(enrollment, "1001", sourceHead),
        state: "trusted",
        summary: "trusted",
      }),
      packageRoot,
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({
      authorityEligible: true,
      consumptionState: "unconsumed",
      reason: "none",
      schemaVersion: "consumer-authority-verify.2",
      sourceFallback: false,
      state: "trusted",
    })
    expect(readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state).toBe("missing")
    expect(`${result.stdout}${result.stderr}`).not.toContain(archivePath)
  })

  it.each([
    "dns-unavailable",
    "network-unavailable",
    "trust-root-unavailable",
    "verification-timeout",
  ] as const)("maps %s to a blocked nonreflective result", (state) => {
    const gitProject = gitBackedProject()
    const projectDir = gitProject.path
    const sourceHead = gitProject.head
    const packageRoot = installedPackageRoot()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(archivePath, archive)
    const artifactDigest = `sha256:${createHash("sha256").update(archive).digest("hex")}`
    const result = runAuthorityCommand([
      "verify",
      "example/public-gradle-app",
      "--archive",
      realpathSync(archivePath),
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      sourceHead,
      "--artifact-digest",
      artifactDigest,
      "--json",
    ], {
      artifactInspector: () => ({
        authorityEligible: false,
        consumptionState: "not-applicable" as const,
        decision: "blocked" as const,
        diagnostics: [],
        state,
        summary: "trust root unavailable",
      }),
      packageRoot,
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      authorityEligible: false,
      consumptionState: "not-applicable",
      reason: "trust-unavailable",
      schemaVersion: "consumer-authority-verify.2",
      sourceFallback: false,
      state: "blocked",
    })
    expect(readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state).toBe("missing")
  })

  it.each([
    ["partial tuple", ["--artifact-id", "11"], "selection-required"],
    ["digest mismatch", ["--artifact-id", "11", "--run-id", "1001", "--source-head", "a".repeat(40), "--artifact-digest", `sha256:${"a".repeat(64)}`], "archive-digest-mismatch"],
  ] as const)("blocks a %s before verifier or store", (_label, tupleArgs, expectedReason) => {
    const projectDir = project()
    const packageRoot = installedPackageRoot()
    const artifactInspector = vi.fn(() => ({
      authorityEligible: true as const,
      consumptionState: "unconsumed" as const,
      decision: "trusted" as const,
      diagnostics: [],
      state: "trusted" as const,
      summary: "trusted",
    }))
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(archivePath, artifactArchive())
    const result = runAuthorityCommand([
      "verify",
      "--archive",
      realpathSync(archivePath),
      ...tupleArgs,
      "--json",
    ], { artifactInspector, packageRoot, projectDir, storeRoot: join(projectDir, "user-store") })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      authorityEligible: false,
      reason: expectedReason,
      schemaVersion: "consumer-authority-verify.2",
      sourceFallback: false,
      state: "blocked",
    })
    expect(artifactInspector).not.toHaveBeenCalled()
  })

  it.each([
    ["crypto", "crypto-failed", "crypto-invalid", undefined],
    ["source", "source-drift", "source-mismatch", "unknown"],
    ["stale", "stale", "stale", undefined],
    ["runtime", "runtime-unsupported", "runtime-unsupported", undefined],
    ["malformed", "malformed", "artifact-invalid", undefined],
    ["binding", "binding-mismatch", "binding-mismatch", undefined],
    ["replayed", "replayed", "consumption-invalid", undefined],
  ] as const)("normalizes %s verifier outcomes without persistence", (_label, state, expectedReason, expectedSourceReason) => {
    const gitProject = gitBackedProject()
    const projectDir = gitProject.path
    const packageRoot = installedPackageRoot()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(archivePath, archive)
    const artifactInspector = vi.fn(() => ({
      authorityEligible: false as const,
      consumptionState: "not-applicable" as const,
      decision: "blocked" as const,
      diagnostics: [],
      state,
      summary: "blocked",
    }))
    const result = runAuthorityCommand([
      "verify",
      enrollment.repositorySlug,
      "--archive",
      realpathSync(archivePath),
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      gitProject.head,
      "--artifact-digest",
      `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      "--json",
    ], { artifactInspector, packageRoot, projectDir, storeRoot })

    expect(result.status).toBe(1)
    const output = JSON.parse(result.stdout)
    expect(output).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      reason: expectedReason,
      schemaVersion: "consumer-authority-verify.2",
      sourceFallback: false,
      state: "blocked",
    })
    if (expectedSourceReason === undefined) {
      expect(output).not.toHaveProperty("sourceReason")
    } else {
      expect(output).toMatchObject({ sourceReason: expectedSourceReason })
    }
    expect(readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state).toBe("missing")
    expect(artifactInspector).toHaveBeenCalledOnce()
  })

  it("emits a bounded source reason for verifier source drift without retaining authority", () => {
    // Given
    const gitProject = gitBackedProject()
    const projectDir = gitProject.path
    const packageRoot = installedPackageRoot()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(archivePath, archive)

    // When
    const result = runAuthorityCommand([
      "verify",
      enrollment.repositorySlug,
      "--archive",
      realpathSync(archivePath),
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      gitProject.head,
      "--artifact-digest",
      `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      "--json",
    ], {
      artifactInspector: () => ({
        authorityEligible: false,
        consumptionState: "not-applicable" as const,
        decision: "blocked" as const,
        diagnostics: [{ code: "source-drift" as const, path: "source.contentDigest" }],
        state: "source-drift" as const,
        summary: "blocked",
      }),
      packageRoot,
      projectDir,
      storeRoot,
    })

    // Then
    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      authorityEligible: false,
      consumptionState: "not-applicable",
      reason: "source-mismatch",
      schemaVersion: "consumer-authority-verify.2",
      sourceFallback: false,
      sourceReason: "content",
      state: "blocked",
    })
    expect(readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state).toBe("missing")
    expect(`${result.stdout}${result.stderr}`).not.toContain("source.contentDigest")
  })

  it("blocks a current Git head mismatch before verifier with a bounded source reason", () => {
    const gitProject = gitBackedProject()
    const projectDir = gitProject.path
    const packageRoot = installedPackageRoot()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const archive = artifactArchive()
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(archivePath, archive)
    const artifactInspector = vi.fn()

    const result = runAuthorityCommand([
      "verify",
      enrollment.repositorySlug,
      "--archive",
      realpathSync(archivePath),
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      "--json",
    ], { artifactInspector, packageRoot, projectDir, storeRoot })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toEqual({
      authorityEligible: false,
      consumptionState: "not-applicable",
      reason: "source-mismatch",
      schemaVersion: "consumer-authority-verify.2",
      sourceFallback: false,
      sourceReason: "head",
      state: "blocked",
    })
    expect(artifactInspector).not.toHaveBeenCalled()
    expect(readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state).toBe("missing")
  })

  it("requires an explicit repository when multiple enrollments are present", () => {
    const gitProject = gitBackedProject()
    const projectDir = gitProject.path
    const packageRoot = installedPackageRoot()
    const storeRoot = join(projectDir, "user-store")
    const first = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654321,
      repositorySlug: "example/first-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    })
    const second = authorityEnrollmentFromReadback({
      callerWorkflowPath: "project-finish.yml",
      repositoryId: 987654322,
      repositorySlug: "example/second-gradle-app",
      reusableWorkflowSha: "c".repeat(40),
    })
    if (
      first === undefined
      || second === undefined
      || !writeAuthorityEnrollment(first, { storeRoot })
      || !writeAuthorityEnrollment(second, { storeRoot })
    ) {
      throw new Error("multiple enrollment fixture must persist")
    }
    const archive = artifactArchive()
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(archivePath, archive)
    const artifactInspector = vi.fn()
    const result = runAuthorityCommand([
      "verify",
      "--archive",
      realpathSync(archivePath),
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      gitProject.head,
      "--artifact-digest",
      `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      "--json",
    ], { artifactInspector, packageRoot, projectDir, storeRoot })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      reason: "selection-required",
      schemaVersion: "consumer-authority-verify.2",
      state: "blocked",
    })
    expect(artifactInspector).not.toHaveBeenCalled()
  })

  it("rejects an archive symlink before verifier or store", () => {
    const projectDir = project()
    const packageRoot = installedPackageRoot()
    const archive = artifactArchive()
    const targetPath = join(projectDir, "real-attestation.zip")
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(targetPath, archive)
    symlinkSync(targetPath, archivePath)
    const artifactInspector = vi.fn()
    const result = runAuthorityCommand([
      "verify",
      "--archive",
      archivePath,
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      "--json",
    ], { artifactInspector, packageRoot, projectDir, storeRoot: join(projectDir, "user-store") })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      reason: "archive-invalid",
      schemaVersion: "consumer-authority-verify.2",
      state: "blocked",
    })
    expect(artifactInspector).not.toHaveBeenCalled()
  })

  it("rejects an archive symlink ancestor before verifier or store", () => {
    const projectDir = project()
    const packageRoot = installedPackageRoot()
    const archive = artifactArchive()
    const targetDirectory = join(projectDir, "real-artifacts")
    const archiveDirectory = join(projectDir, "linked-artifacts")
    mkdirSync(targetDirectory)
    writeFileSync(join(targetDirectory, "attestation.zip"), archive)
    symlinkSync(targetDirectory, archiveDirectory)
    const artifactInspector = vi.fn()
    const result = runAuthorityCommand([
      "verify",
      "--archive",
      join(archiveDirectory, "attestation.zip"),
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      "--json",
    ], { artifactInspector, packageRoot, projectDir, storeRoot: join(projectDir, "user-store") })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      reason: "archive-invalid",
      schemaVersion: "consumer-authority-verify.2",
      state: "blocked",
    })
    expect(artifactInspector).not.toHaveBeenCalled()
  })

  it("rejects a source checkout before verifier as source fallback", () => {
    const projectDir = project()
    const archive = artifactArchive()
    const archivePath = join(projectDir, "attestation.zip")
    writeFileSync(archivePath, archive)
    const artifactInspector = vi.fn()
    const result = runAuthorityCommand([
      "verify",
      "--archive",
      realpathSync(archivePath),
      "--artifact-id",
      "11",
      "--run-id",
      "1001",
      "--source-head",
      "a".repeat(40),
      "--artifact-digest",
      `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      "--json",
    ], { artifactInspector, packageRoot: process.cwd(), projectDir, storeRoot: join(projectDir, "user-store") })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      reason: "package-provenance-unavailable",
      schemaVersion: "consumer-authority-verify.2",
      sourceFallback: false,
      state: "blocked",
    })
    expect(artifactInspector).not.toHaveBeenCalled()
  })
})

function project(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-authority-command-"))
  projects.push(projectDir)
  return projectDir
}

function gitBackedProject(): { readonly head: string; readonly path: string } {
  const path = project()
  writeFileSync(join(path, "README.md"), "fixture\n")
  for (const args of [
    ["init", "-q"],
    ["config", "user.email", "authority-test@example.invalid"],
    ["config", "user.name", "authority-test"],
    ["add", "README.md"],
    ["commit", "-qm", "fixture"],
  ]) {
    const result = spawnSync("git", args, { cwd: path, encoding: "utf8" })
    if (result.status !== 0) throw new Error("git fixture setup failed")
  }
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: path, encoding: "utf8" })
  if (head.status !== 0) throw new Error("git fixture head failed")
  return { head: head.stdout.trim(), path }
}

function installedPackageRoot(): string {
  const root = project()
  mkdirSync(join(root, "dist", "cli"), { recursive: true })
  writeFileSync(join(root, "package.json"), JSON.stringify({
    bin: {
      "persona-harness": "dist/cli/index.js",
      ph: "dist/cli/index.js",
    },
    version: personaHarnessVersion(),
  }))
  writeFileSync(join(root, "dist", "cli", "index.js"), "")
  return root
}

function trustedReceiptFor(enrollment: AuthorityEnrollment, runId: string, sourceHead = "a".repeat(40)) {
  const parsed = parseProjectFinishAttestationStatement(createValidProjectFinishAttestationStatement())
  if (!parsed.ok) throw new Error("fixture receipt must parse")
  const receipt = parsed.value.predicate.receipt
  return {
    ...receipt,
    lifecycle: {
      ...receipt.lifecycle,
      attemptId: `project-finish-attempt-${runId}-2`,
      finishId: `project-finish-finish-${runId}-2`,
      nonce: `project-finish-${runId}-2`,
      runId,
      sessionId: `project-finish-session-${runId}-2`,
    },
    repository: {
      id: enrollment.repositoryId,
      slug: enrollment.repositorySlug,
      visibility: "public" as const,
    },
    source: {
      ...receipt.source,
      head: sourceHead,
      identity: {
        ...receipt.source.identity,
        repositoryHead: sourceHead,
      },
    },
    workflow: {
      ...receipt.workflow,
      caller: {
        ref: `${enrollment.repositorySlug}/.github/workflows/${enrollment.callerWorkflowPath}@refs/heads/main`,
        sha: sourceHead,
      },
      certificateSan: projectFinishAttestationReusableCertificateSan(enrollment.reusableWorkflowSha),
      reusable: {
        ...receipt.workflow.reusable,
        ref: `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${enrollment.reusableWorkflowSha}`,
        sha: enrollment.reusableWorkflowSha,
      },
      runId,
    },
  }
}

function artifactArchive(): Buffer {
  const members = {
    "bundle.json": Buffer.from("bundle", "utf8"),
    "predicate.json": Buffer.from("predicate", "utf8"),
    "receipt.json": Buffer.from("receipt", "utf8"),
  }
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0
  for (const [name, bytes] of Object.entries(members)) {
    const encodedName = Buffer.from(name, "utf8")
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt32LE(bytes.byteLength, 18)
    local.writeUInt32LE(bytes.byteLength, 22)
    local.writeUInt16LE(encodedName.byteLength, 26)
    localParts.push(local, encodedName, bytes)
    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt32LE(bytes.byteLength, 20)
    central.writeUInt32LE(bytes.byteLength, 24)
    central.writeUInt16LE(encodedName.byteLength, 28)
    central.writeUInt32LE(offset, 42)
    centralParts.push(central, encodedName)
    offset += local.byteLength + encodedName.byteLength + bytes.byteLength
  }
  const directory = Buffer.concat(centralParts)
  const footer = Buffer.alloc(22)
  footer.writeUInt32LE(0x06054b50, 0)
  footer.writeUInt16LE(3, 8)
  footer.writeUInt16LE(3, 10)
  footer.writeUInt32LE(directory.byteLength, 12)
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, directory, footer])
}
