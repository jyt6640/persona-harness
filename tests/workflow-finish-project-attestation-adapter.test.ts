import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const projectAuthority = vi.hoisted(() => ({
  read: vi.fn(),
}))
const projectVerifier = vi.hoisted(() => ({
  consume: vi.fn(),
}))
const legacy = vi.hoisted(() => ({
  inspect: vi.fn(),
  verify: vi.fn(),
}))

vi.mock("../src/cli/authority-project-attestation.js", () => ({
  readEnrolledProjectFinishAttestations: projectAuthority.read,
}))
vi.mock("../src/cli/project-finish-attestation-verifier.js", () => ({
  consumeProjectFinishAttestationArtifact: projectVerifier.consume,
}))
vi.mock("../src/cli/workflow-finish-attestation.js", () => ({
  verifyExternalFinishAttestation: legacy.verify,
  verifyExternalFinishAttestationForClosure: legacy.inspect,
}))

import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"

const projects: string[] = []
const now = new Date("2026-07-24T00:00:00.000Z")

beforeEach(() => {
  projectAuthority.read.mockReset()
  projectVerifier.consume.mockReset()
  legacy.inspect.mockReset()
  legacy.verify.mockReset()
  legacy.inspect.mockReturnValue(legacyBlocked())
  legacy.verify.mockReturnValue(legacyBlocked())
})

afterEach(() => {
  for (const project of projects.splice(0)) rmSync(project, { force: true, recursive: true })
})

describe("workflow Finish enrolled project attestation adapter", () => {
  it("preserves trusted legacy external authority without reading user-scoped project artifacts", () => {
    legacy.inspect.mockReturnValue(legacyTrusted())
    projectAuthority.read.mockReturnValue({ enrollmentState: "missing", sourceState: "unavailable", values: [] })

    const result = readWorkflowFinishAuthority(project(), { consumeExternalAttestation: false, now })

    expect(result).toMatchObject({
      decision: { authorityProvider: "external-attested", consumptionState: "unconsumed" },
      status: "trusted",
    })
    expect(projectAuthority.read).not.toHaveBeenCalled()
  })

  it("keeps a non-consuming preview trusted only for one verified enrolled project candidate", () => {
    const candidate = trustedCandidate()
    projectAuthority.read.mockReturnValue({ enrollmentState: "ready", sourceState: "ready", values: [candidate] })
    const projectDir = project()

    const result = readWorkflowFinishAuthority(projectDir, { consumeExternalAttestation: false, now })

    expect(result).toMatchObject({
      decision: { authorityProvider: "external-attested", consumptionState: "unconsumed" },
      projectAttestation: { authorityEligible: true, consumptionState: "unconsumed" },
      status: "trusted",
    })
    expect(projectVerifier.consume).not.toHaveBeenCalled()
  })

  it("blocks ambiguous trusted project candidates before either one can be consumed", () => {
    projectAuthority.read.mockReturnValue({
      enrollmentState: "ready",
      sourceState: "ready",
      values: [trustedCandidate(), trustedCandidate()],
    })

    const result = readWorkflowFinishAuthority(project(), { now })

    expect(result).toMatchObject({ decision: { completionEligible: false }, status: "blocked" })
    expect(result.blocker.reason).toContain("Multiple enrolled project finish attestations")
    expect(projectVerifier.consume).not.toHaveBeenCalled()
  })

  it("requires the selected original artifact to remain trusted through consumption", () => {
    const candidate = trustedCandidate()
    projectAuthority.read.mockReturnValue({ enrollmentState: "ready", sourceState: "ready", values: [candidate] })
    projectVerifier.consume.mockReturnValue({ ...candidate.assessment, consumptionState: "consumed" })

    const result = readWorkflowFinishAuthority(project(), { now })

    expect(result).toMatchObject({
      decision: { authorityProvider: "external-attested", consumptionState: "consumed" },
      status: "trusted",
    })
    expect(projectVerifier.consume).toHaveBeenCalledWith(
      expect.any(String),
      candidate.enrollment,
      candidate.artifact.archive,
      now,
    )
  })
})

function project(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-finish-project-adapter-"))
  projects.push(projectDir)
  return projectDir
}

function legacyBlocked() {
  return {
    authorityEligible: false,
    consumptionState: "not-applicable",
    decision: "blocked",
    diagnostics: [],
    state: "missing",
    summary: "missing",
  }
}

function legacyTrusted() {
  return {
    authorityEligible: true,
    consumptionState: "unconsumed",
    decision: "trusted",
    diagnostics: [],
    receipt: {
      finishId: "legacy-finish-1",
      source: { identity: { contentDigest: `sha256:${"c".repeat(64)}` } },
    },
    state: "trusted",
    summary: "trusted legacy external authority",
  }
}

function trustedCandidate() {
  return {
    artifact: {
      archive: Buffer.from("original-archive", "utf8"),
      artifactDigest: `sha256:${"a".repeat(64)}`,
      fetchedAt: "2026-07-24T00:00:00.000Z",
      repositoryId: 987654321,
      runId: "10",
      sourceHead: "a".repeat(40),
    },
    assessment: {
      authorityEligible: true,
      consumptionState: "unconsumed",
      decision: "trusted",
      diagnostics: [],
      receipt: {
        lifecycle: { finishId: "finish-1" },
        source: { identity: { contentDigest: `sha256:${"b".repeat(64)}` } },
      },
      state: "trusted",
      summary: "trusted",
    },
    enrollment: {
      callerWorkflowPath: "persona-harness.yml",
      enrolledAt: "2026-07-24T00:00:00.000Z",
      event: "push",
      policyMarker: "user-scoped-enrollment-v1",
      ref: "refs/heads/main",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "a".repeat(40),
      schemaVersion: "consumer-authority-enrollment.1",
    },
  }
}
