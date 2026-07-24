import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { writeAuthorityArtifact } from "../src/cli/authority-artifact-store.js"
import {
  authorityEnrollmentFromReadback,
  writeAuthorityEnrollment,
} from "../src/cli/authority-enrollment.js"
import { readEnrolledProjectFinishAttestations } from "../src/cli/authority-project-attestation.js"

const directories: string[] = []

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true })
})

describe("enrolled project finish attestation selection", () => {
  it("does not assess a copied original archive when its fetched source head differs from the current project", () => {
    const projectDir = project()
    const storeRoot = track(mkdtempSync(join(tmpdir(), "persona-authority-project-store-")))
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectDir, encoding: "utf8" }).trim()
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "persona-harness.yml",
      repositoryId: 987654321,
      repositorySlug: "example/public-gradle-app",
      reusableWorkflowSha: "a".repeat(40),
    }, new Date("2026-07-24T00:00:00.000Z"))
    if (enrollment === undefined) throw new Error("fixture enrollment must parse")
    const archive = archiveFor({
      "bundle.json": Buffer.from("{}\n", "utf8"),
      "predicate.json": Buffer.from("{}\n", "utf8"),
      "receipt.json": Buffer.from("{}\n", "utf8"),
    })

    expect(writeAuthorityEnrollment(enrollment, { storeRoot })).toBe(true)
    expect(writeAuthorityArtifact({
      archive,
      artifactDigest: `sha256:${createHash("sha256").update(archive).digest("hex")}`,
      fetchedAt: "2026-07-24T00:00:00.000Z",
      repositoryId: 987654321,
      runId: "10",
      sourceHead: `${head.startsWith("a") ? "b" : "a"}${head.slice(1)}`,
    }, { storeRoot })).toBe(true)

    const result = readEnrolledProjectFinishAttestations(projectDir, { storeRoot })

    expect(result).toMatchObject({ enrollmentState: "ready", sourceState: "ready", values: [] })
  })
})

function project(): string {
  const projectDir = track(mkdtempSync(join(tmpdir(), "persona-authority-project-")))
  mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
  writeFileSync(join(projectDir, "build.gradle"), "plugins {}\n")
  execFileSync("git", ["init", "--quiet"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["-c", "user.email=fixture@example.test", "-c", "user.name=Fixture", "commit", "--quiet", "-m", "fixture"], { cwd: projectDir })
  return projectDir
}

function track(directory: string): string {
  directories.push(directory)
  return directory
}

function archiveFor(members: Readonly<Record<string, Buffer>>): Buffer {
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
