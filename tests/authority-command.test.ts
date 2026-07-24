import { createHash } from "node:crypto"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
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

const projects: string[] = []

afterEach(() => {
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
    const result = runPersonaCli(["authority", "status"], {
      cwd: projectDir,
      env: { GH_TOKEN: "github-test-credential" },
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Enrollment: unavailable")
    expect(result.stdout).not.toContain(projectDir)
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

  it("fetches only a product-owned original archive into the user store without creating workspace authority", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "a".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined) throw new Error("fixture enrollment must parse")
    expect(writeAuthorityEnrollment(enrollment, { storeRoot })).toBe(true)
    const archive = artifactArchive()

    const result = runAuthorityCommand(["fetch", "github"], {
      artifactFetch: () => ({
        archive,
        artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
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
        state: "trusted",
        summary: "trusted",
      }),
      projectDir,
      storeRoot,
    })

    expect(result).toEqual({
      status: 0,
      stderr: "",
      stdout: "Fetched and verified matching original public evidence. No completion authority was consumed.\n",
    })
    expect(readAuthorityArtifact(987654321, { storeRoot }).state).toBe("ready")
    expect(existsSync(join(projectDir, ".persona", "evidence", "project-finish-attestation", "bundle.json"))).toBe(false)
    expect(`${result.stdout}${result.stderr}`).not.toContain(projectDir)
  })

  it("selects one explicit enrolled repository when the user store contains multiple entries", () => {
    const projectDir = project()
    const storeRoot = join(projectDir, "user-store")
    for (const [repositoryId, repositorySlug] of [
      [987654321, "example/public-gradle-app"],
      [987654322, "example/second-gradle-app"],
    ] as const) {
      const enrollment = authorityEnrollmentFromReadback({
        callerWorkflowPath: "persona-harness.yml",
        repositoryId,
        repositorySlug,
        reusableWorkflowSha: "a".repeat(40),
      }, new Date("2026-07-24T00:00:00.000Z"))
      if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
        throw new Error("fixture enrollment must persist")
      }
    }
    const archive = artifactArchive()
    const artifactFetch = vi.fn((_candidateProjectDir: string, enrollment: AuthorityEnrollment) => ({
      archive,
      artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      fetchedAt: "2026-07-24T00:00:00.000Z",
      repositoryId: enrollment.repositoryId,
      runId: "10",
      sourceHead: "a".repeat(40),
    }))
    const artifactInspector = () => ({
      authorityEligible: true as const,
      consumptionState: "unconsumed" as const,
      decision: "trusted" as const,
      diagnostics: [],
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
})

function project(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-authority-command-"))
  projects.push(projectDir)
  return projectDir
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
