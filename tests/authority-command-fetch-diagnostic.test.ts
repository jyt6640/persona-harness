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

    const json = runAuthorityCommand(["fetch", "github", "--json"], {
      githubToken: token,
      projectDir,
      storeRoot,
    })
    const plain = runAuthorityCommand(["fetch", "github"], {
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
})

function root(): string {
  const value = mkdtempSync(join(tmpdir(), "persona-authority-fetch-diagnostic-"))
  roots.push(value)
  return value
}
