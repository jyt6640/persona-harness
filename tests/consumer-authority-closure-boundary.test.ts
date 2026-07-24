import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  readAuthorityArtifact,
} from "../src/cli/authority-artifact-store.js"
import {
  runAuthorityCommand,
} from "../src/cli/authority-command.js"
import {
  authorityEnrollmentFromReadback,
  writeAuthorityEnrollment,
} from "../src/cli/authority-enrollment.js"
import { runDoctorCommand } from "../src/cli/doctor.js"

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

describe("consumer authority closure-ready boundary", () => {
  it("records explicit no-protection policy and metadata-only audit history for trust changes", () => {
    // Given
    const storeRoot = temporaryDirectory("persona-authority-audit-")
    const first = authorityEnrollmentFromReadback({
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "a".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    const updated = authorityEnrollmentFromReadback({
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "b".repeat(40),
    }, new Date("2026-07-24T01:00:00.000Z"))
    if (first === undefined || updated === undefined) throw new Error("fixture enrollments must parse")

    // When
    const firstWrite = writeAuthorityEnrollment(first, { storeRoot })
    const secondWrite = writeAuthorityEnrollment(updated, { storeRoot })
    const stored: unknown = JSON.parse(readFileSync(join(storeRoot, "consumer-authority-v1.json"), "utf8"))

    // Then
    expect(firstWrite).toBe(true)
    expect(secondWrite).toBe(true)
    expect(first).toMatchObject({
      event: "push",
      protectionPolicy: "branch-protection-not-proven",
      ref: "refs/heads/main",
    })
    expect(stored).toMatchObject({
      audit: [
        {
          action: "enrolled",
          occurredAt: "2026-07-24T00:00:00.000Z",
          protectionPolicy: "branch-protection-not-proven",
          repositoryId: 987654321,
          schemaVersion: "consumer-authority-audit.1",
        },
        {
          action: "updated",
          occurredAt: "2026-07-24T01:00:00.000Z",
          protectionPolicy: "branch-protection-not-proven",
          repositoryId: 987654321,
          schemaVersion: "consumer-authority-audit.1",
        },
      ],
      schemaVersion: "consumer-authority-store.1",
    })
    expect(JSON.stringify(stored)).not.toContain(storeRoot)
  })

  it("does not retain a fetched archive until verifier core accepts it", () => {
    // Given
    const projectDir = temporaryDirectory("persona-authority-fetch-project-")
    const storeRoot = temporaryDirectory("persona-authority-fetch-store-")
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "a".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined) throw new Error("fixture enrollment must parse")
    if (!writeAuthorityEnrollment(enrollment, { storeRoot })) throw new Error("fixture enrollment must persist")
    const archive = artifactArchive()

    // When
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
        authorityEligible: false,
        consumptionState: "not-applicable",
        decision: "blocked",
        diagnostics: [{ code: "crypto-failed", path: "bundle" }],
        state: "crypto-failed",
        summary: "blocked",
      }),
      projectDir,
      storeRoot,
    })

    // Then
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("BLOCKED")
    expect(readAuthorityArtifact(987654321, { storeRoot }).state).toBe("missing")
    expect(`${result.stdout}${result.stderr}`).not.toContain(projectDir)
  })

  it("keeps doctor plaintext and JSON consumer-authority state on one bounded next step", () => {
    // Given
    const projectDir = temporaryDirectory("persona-authority-doctor-")
    const consumerAuthority = {
      authorityEligible: false,
      consumptionState: "not-applicable" as const,
      enrollment: "unavailable" as const,
      next: "authority-enroll-github" as const,
      state: "enrollment-unavailable" as const,
    }
    const options = {
      consumerAuthorityInspector: () => consumerAuthority,
      env: {
        PH_DOCTOR_OPENCODE_VERSION: "1.0.0-test",
        PH_DOCTOR_REGISTRY_FAILURE: "unavailable",
      },
      externalTrustInspector: () => ({
        authorityEligible: false,
        consumptionState: "not-applicable" as const,
        decision: "blocked" as const,
        diagnostics: [],
        state: "missing" as const,
        summary: "missing",
      }),
      projectDir,
      sigstoreTrustInspector: () => ({
        networkReadiness: "blocked" as const,
        state: "dns-unavailable" as const,
        trustRootReadiness: "blocked" as const,
      }),
    }

    // When
    const plaintext = runDoctorCommand([], options)
    const json = runDoctorCommand(["--json"], options)
    const payload: unknown = JSON.parse(json.stdout)

    // Then
    expect(plaintext.stdout).toContain("Consumer authority: BLOCKED (enrollment-unavailable; not-applicable; read-only)")
    expect(plaintext.stdout).toContain("Consumer authority next: authority-enroll-github")
    expect(plaintext.stdout).toContain("Sigstore network readiness: BLOCKED (dns-unavailable)")
    expect(plaintext.stdout).toContain("Sigstore trust-root readiness: BLOCKED (dns-unavailable; live no-cache check)")
    expect(payload).toMatchObject({
      authority: {
        consumer: consumerAuthority,
      },
      sigstore: {
        networkReadiness: "blocked",
        state: "dns-unavailable",
        trustRootReadiness: "blocked",
      },
    })
    expect(`${plaintext.stdout}${json.stdout}`).not.toContain(projectDir)
  })
})

function temporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  directories.push(directory)
  return directory
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
