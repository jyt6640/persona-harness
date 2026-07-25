import { existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  inspectProjectFinishAttestation,
  matchProjectFinishAttestationEnrollment,
  type ProjectFinishAttestationEnrolledPolicy,
} from "../src/cli/project-finish-attestation-verifier.js"
import { parseProjectFinishAttestationStatement } from "../src/cli/project-finish-attestation-parser.js"
import { createValidProjectFinishAttestationStatement } from "./helpers/project-finish-attestation-fixture.js"

const projects: string[] = []

const enrollment: ProjectFinishAttestationEnrolledPolicy = {
  callerWorkflowPath: "project-finish.yml",
  repositoryId: 987654321,
  repositorySlug: "example/public-gradle-app",
  reusableWorkflowSha: "b".repeat(40),
}

afterEach(() => {
  for (const project of projects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

describe("project-finish-attestation.1 verifier core", () => {
  it("fails closed when the fixed evidence directory is absent", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-verifier-")))

    const result = inspectProjectFinishAttestation(projectDir, enrollment, new Date("2026-07-18T01:30:00.000Z"))

    expect(result).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      state: "missing",
    })
    expect(existsSync(join(projectDir, ".persona", "evidence", "finish-attestation", "consumption.json"))).toBe(false)
  })

  it("fails closed when the fixed evidence directory is a symlink", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-verifier-")))
    const evidenceRoot = join(projectDir, ".persona", "evidence")
    mkdirSync(evidenceRoot, { recursive: true })
    symlinkSync(join(projectDir, "outside"), join(evidenceRoot, "project-finish-attestation"), "dir")

    const result = inspectProjectFinishAttestation(projectDir, enrollment, new Date("2026-07-18T01:30:00.000Z"))

    expect(result).toMatchObject({ authorityEligible: false, state: "missing" })
    expect(JSON.stringify(result)).not.toContain(projectDir)
  })

  it("fails closed when the requested project root is a symlink", () => {
    const parentDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-verifier-")))
    const actualProjectDir = join(parentDir, "actual-project")
    const requestedProjectDir = join(parentDir, "requested-project")
    mkdirSync(actualProjectDir)
    symlinkSync(actualProjectDir, requestedProjectDir, "dir")

    const result = inspectProjectFinishAttestation(requestedProjectDir, enrollment, new Date("2026-07-18T01:30:00.000Z"))

    expect(result).toMatchObject({ authorityEligible: false, state: "missing" })
    expect(JSON.stringify(result)).not.toContain(requestedProjectDir)
  })

  it.each([
    ["an oversized bundle", (evidenceDir: string, projectDir: string) => {
      writeMinimalEvidence(evidenceDir)
      writeFileSync(join(evidenceDir, "bundle.json"), Buffer.alloc(1024 * 1024 + 1, 0x20))
    }],
    ["an oversized predicate", (evidenceDir: string, projectDir: string) => {
      writeMinimalEvidence(evidenceDir)
      writeFileSync(join(evidenceDir, "predicate.json"), Buffer.alloc(512 * 1024 + 1, 0x20))
    }],
    ["an unexpected artifact member", (evidenceDir: string, projectDir: string) => {
      writeMinimalEvidence(evidenceDir)
      writeFileSync(join(evidenceDir, "extra.json"), "{}\n")
    }],
    ["a locally repacked archive in place of the fixed evidence members", (evidenceDir: string, projectDir: string) => {
      writeFileSync(join(evidenceDir, "project-finish-attestation.zip"), "not accepted as evidence\n")
    }],
    ["a symlinked bundle leaf", (evidenceDir: string, projectDir: string) => {
      const outside = join(projectDir, "outside-bundle.json")
      writeMinimalEvidence(evidenceDir)
      writeFileSync(outside, "{}\n")
      rmSync(join(evidenceDir, "bundle.json"))
      symlinkSync(outside, join(evidenceDir, "bundle.json"))
    }],
  ])("fails closed for %s without creating a terminal record", (_name, arrange) => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-verifier-")))
    const evidenceDir = join(projectDir, ".persona", "evidence", "project-finish-attestation")
    mkdirSync(evidenceDir, { recursive: true })
    arrange(evidenceDir, projectDir)

    const result = inspectProjectFinishAttestation(projectDir, enrollment, new Date("2026-07-18T01:30:00.000Z"))

    expect(result).toMatchObject({ authorityEligible: false, state: "missing" })
    expect(existsSync(join(projectDir, ".persona", "evidence", "finish-attestation", "consumption.json"))).toBe(false)
    expect(JSON.stringify(result)).not.toContain(projectDir)
  })

  it("rejects a structurally valid statement whose enrollment repository differs", () => {
    const parsed = parseProjectFinishAttestationStatement(createValidProjectFinishAttestationStatement())
    if (!parsed.ok) throw new Error("fixture statement must parse")

    const mismatch = matchProjectFinishAttestationEnrollment(parsed.value.predicate.receipt, {
      ...enrollment,
      repositoryId: 987654322,
    })

    expect(mismatch).toEqual({ code: "wrong-policy", path: "enrollment.repository" })
  })

  it("blocks a local JSON bundle without creating a consumption record", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-verifier-")))
    const evidenceDir = join(projectDir, ".persona", "evidence", "project-finish-attestation")
    const statement = createValidProjectFinishAttestationStatement()
    const predicate = requireRecord(statement, "predicate")
    const receipt = requireRecord(predicate, "receipt")
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(join(evidenceDir, "receipt.json"), `${JSON.stringify(receipt)}\n`)
    writeFileSync(join(evidenceDir, "predicate.json"), `${JSON.stringify(predicate)}\n`)
    const marker = "sk-live-local-bundle-marker"
    writeFileSync(join(evidenceDir, "bundle.json"), `${JSON.stringify({ marker, statement })}\n`)

    const result = inspectProjectFinishAttestation(projectDir, enrollment, new Date("2026-07-18T01:30:00.000Z"))

    expect(result.authorityEligible).toBe(false)
    expect(result.state).toBe("malformed-bundle")
    expect(existsSync(join(projectDir, ".persona", "evidence", "finish-attestation", "consumption.json"))).toBe(false)
    expect(JSON.stringify(result)).not.toContain(marker)
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

function writeMinimalEvidence(evidenceDir: string): void {
  writeFileSync(join(evidenceDir, "bundle.json"), "{}\n")
  writeFileSync(join(evidenceDir, "predicate.json"), "{}\n")
  writeFileSync(join(evidenceDir, "receipt.json"), "{}\n")
}
