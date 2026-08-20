import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

const worker = vi.hoisted(() => ({
  fetchGithubAuthorityArtifact: vi.fn(),
}))

vi.mock("../src/cli/authority-fetch-worker.js", () => ({
  fetchGithubAuthorityArtifact: worker.fetchGithubAuthorityArtifact,
}))

import { runAuthorityCommand } from "../src/cli/authority-command.js"
import { authorityEnrollmentFromReadback, writeAuthorityEnrollment } from "../src/cli/authority-enrollment.js"
import { readAuthorityArtifact } from "../src/cli/authority-artifact-store.js"

const roots: string[] = []

afterEach(() => {
  worker.fetchGithubAuthorityArtifact.mockReset()
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true })
})

describe("consumer authority fetch child diagnostic", () => {
  it.each([
    "authority-fetch-invalid",
    "authority-fetch-policy",
    "authority-fetch-evidence",
    "authority-fetch-network",
  ] as const)("keeps missing while exposing only the bounded %s child code", (diagnostic) => {
    const projectDir = root()
    const storeRoot = join(projectDir, "authority-store")
    const token = "ghp_child_boundary_probe"
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "research-attestation.yml",
      repositoryId: 1304576182,
      repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
      reusableWorkflowSha: "73e8654ce3307a6be7fb511e0c1f67df93c7d1b3",
    })
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    worker.fetchGithubAuthorityArtifact.mockReturnValue({ kind: "blocked", diagnostic })

    const json = runAuthorityCommand(selectedFetchArgs(true), {
      githubToken: token,
      projectDir,
      storeRoot,
    })
    const plain = runAuthorityCommand(selectedFetchArgs(false), {
      githubToken: token,
      projectDir,
      storeRoot,
    })

    expect(json.status).toBe(1)
    expect(JSON.parse(json.stdout)).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      diagnostic,
      state: "missing",
    })
    expect(plain.status).toBe(1)
    expect(plain.stdout).toContain(diagnostic)
    expect(readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state).toBe("missing")
    expect(existsSync(join(projectDir, ".persona", "evidence", "project-finish-attestation"))).toBe(false)
    expect(`${json.stdout}${json.stderr}${plain.stdout}${plain.stderr}`).not.toContain(projectDir)
    expect(`${json.stdout}${json.stderr}${plain.stdout}${plain.stderr}`).not.toContain(token)
  })

  it("exposes only a normalized package binding reason for verifier failures", () => {
    const projectDir = root()
    const storeRoot = join(projectDir, "authority-store")
    const token = "ghp_binding_reason_probe"
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "research-attestation.yml",
      repositoryId: 1304576182,
      repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
      reusableWorkflowSha: "73e8654ce3307a6be7fb511e0c1f67df93c7d1b3",
    })
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const marker = "private-path-marker"

    const result = runAuthorityCommand(selectedFetchArgs(true), {
      artifactFetch: () => ({
        archive: Buffer.from("archive-marker"),
        artifactId: 1,
        artifactDigest: "sha256:" + "a".repeat(64),
        fetchedAt: new Date(0).toISOString(),
        repositoryId: enrollment.repositoryId,
        runId: "1",
        sourceHead: "a".repeat(40),
      }),
      artifactInspector: () => ({
        authorityEligible: false,
        consumptionState: "not-applicable",
        decision: "blocked",
        diagnostics: [{ code: "binding-mismatch", path: "predicate.receipt.phVersion" }],
        state: "binding-mismatch",
        summary: `secret ${marker}`,
      }),
      githubToken: token,
      projectDir,
      storeRoot,
    })

    expect(result.status).toBe(1)
    expect(JSON.parse(result.stdout)).toMatchObject({
      authorityEligible: false,
      bindingReason: "package-version",
      schemaVersion: "consumer-authority-fetch.4",
      state: "binding-mismatch",
    })
    expect(`${result.stdout}${result.stderr}`).not.toContain(marker)
    expect(`${result.stdout}${result.stderr}`).not.toContain(token)
  })
})

function root(): string {
  const value = mkdtempSync(join(tmpdir(), "persona-authority-fetch-diagnostic-"))
  roots.push(value)
  return value
}

function selectedFetchArgs(json: boolean): string[] {
  const args = [
    "fetch",
    "github",
    "--artifact-id",
    "1",
    "--run-id",
    "1",
    "--source-head",
    "a".repeat(40),
    "--artifact-digest",
    `sha256:${"a".repeat(64)}`,
  ]
  if (json) args.push("--json")
  return args
}
