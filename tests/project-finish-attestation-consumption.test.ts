import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const worker = vi.hoisted(() => ({
  runProjectFinishAttestationWorker: vi.fn(),
}))
const source = vi.hoisted(() => ({
  matchesProjectFinishAttestationSource: vi.fn(),
}))

vi.mock("../src/cli/project-finish-attestation-worker.js", () => worker)
vi.mock("../src/cli/project-finish-attestation-source.js", () => source)

import {
  consumeProjectFinishAttestation,
  inspectProjectFinishAttestation,
  type ProjectFinishAttestationEnrolledPolicy,
} from "../src/cli/project-finish-attestation-verifier.js"
import { canonicalProjectFinishAttestationBytes } from "../src/cli/project-finish-attestation-canonical.js"
import { sha256Digest } from "../src/cli/workflow-finish-attestation-canonical.js"
import { createValidProjectFinishAttestationStatement } from "./helpers/project-finish-attestation-fixture.js"

const projects: string[] = []
const now = new Date("2026-07-18T01:30:00.000Z")
const enrollment: ProjectFinishAttestationEnrolledPolicy = {
  callerWorkflowPath: "project-finish.yml",
  repositoryId: 987654321,
  repositorySlug: "example/public-gradle-app",
  reusableWorkflowSha: "b".repeat(40),
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(now)
  worker.runProjectFinishAttestationWorker.mockReset()
  source.matchesProjectFinishAttestationSource.mockReset()
  source.matchesProjectFinishAttestationSource.mockReturnValue(true)
})

afterEach(() => {
  vi.useRealTimers()
  for (const project of projects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

describe("project finish attestation inspection and consumption", () => {
  it("keeps inspection non-consuming and consumes a verified compatible terminal record exactly once", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-consumption-")))
    const consumptionPath = writeVerifiedEvidence(projectDir)

    expect(inspectProjectFinishAttestation(projectDir, enrollment, now)).toMatchObject({
      authorityEligible: true,
      consumptionState: "unconsumed",
      state: "trusted",
    })
    expect(existsSync(consumptionPath)).toBe(false)

    expect(consumeProjectFinishAttestation(projectDir, enrollment, now)).toMatchObject({
      authorityEligible: true,
      consumptionState: "consumed",
      state: "trusted",
    })
    expect(existsSync(consumptionPath)).toBe(true)

    expect(consumeProjectFinishAttestation(projectDir, enrollment, now)).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      state: "replayed",
    })
    expect(inspectProjectFinishAttestation(projectDir, enrollment, now)).toMatchObject({
      authorityEligible: true,
      consumptionState: "consumed",
      state: "trusted",
    })
  })

  it("blocks stale verified evidence before it can consume the terminal record", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-consumption-")))
    const consumptionPath = writeVerifiedEvidence(projectDir)

    expect(consumeProjectFinishAttestation(projectDir, enrollment, new Date("2026-07-18T02:00:00.000Z"))).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      state: "stale",
    })
    expect(existsSync(consumptionPath)).toBe(false)
  })
})

function track(projectDir: string): string {
  projects.push(projectDir)
  return projectDir
}

function requireRecord(value: Record<string, unknown>, key: string): Record<string, unknown> {
  const field = value[key]
  if (!isRecord(field)) {
    throw new TypeError(`fixture field ${key} must be an object`)
  }
  return field
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function writeVerifiedEvidence(projectDir: string): string {
  const statement = createValidProjectFinishAttestationStatement()
  const predicate = requireRecord(statement, "predicate")
  const receipt = requireRecord(predicate, "receipt")
  const evidenceDir = join(projectDir, ".persona", "evidence", "project-finish-attestation")
  const bundleBytes = Buffer.from("{\"fixture\":\"verified-worker-input\"}\n")
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, "bundle.json"), bundleBytes)
  writeFileSync(join(evidenceDir, "predicate.json"), canonicalProjectFinishAttestationBytes(predicate))
  writeFileSync(join(evidenceDir, "receipt.json"), canonicalProjectFinishAttestationBytes(receipt))
  worker.runProjectFinishAttestationWorker.mockReturnValue({
    bundleDigest: sha256Digest(bundleBytes),
    ok: true,
    statement,
  })
  return join(projectDir, ".persona", "evidence", "finish-attestation", "consumption.json")
}
