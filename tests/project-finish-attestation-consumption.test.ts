import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const worker = vi.hoisted(() => ({
  runProjectFinishAttestationWorker: vi.fn(),
}))
const source = vi.hoisted(() => ({
  // The verifier now asks where the source drifted rather than whether it
  // matches, so `undefined` is the matching answer.
  matchesProjectFinishAttestationSource: vi.fn(),
  projectFinishAttestationSourceDriftPath: vi.fn(),
}))

vi.mock("../src/cli/project-finish-attestation-worker.js", () => worker)
vi.mock("../src/cli/project-finish-attestation-source.js", () => source)

import {
  consumeProjectFinishAttestation,
  consumeProjectFinishAttestationArtifact,
  inspectProjectFinishAttestationArtifact,
  inspectProjectFinishAttestation,
  type ProjectFinishAttestationEnrolledPolicy,
} from "../src/cli/project-finish-attestation-verifier.js"
import {
  canonicalProjectFinishAttestationBytes,
  canonicalProjectFinishAttestationReceiptDigest,
} from "../src/cli/project-finish-attestation-canonical.js"
import { runAuthorityCommand, readAuthorityStatus } from "../src/cli/authority-command.js"
import { readAuthorityArtifact } from "../src/cli/authority-artifact-store.js"
import {
  authorityEnrollmentFromReadback,
  writeAuthorityEnrollment,
} from "../src/cli/authority-enrollment.js"
import { createProjectFinishAttestationProducerArtifacts } from "../src/cli/project-finish-attestation-producer.js"
import { evidenceFromOriginalArtifact } from "../src/cli/project-finish-attestation-evidence.js"
import { sha256Digest } from "../src/cli/workflow-finish-attestation-canonical.js"
import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"
import { personaHarnessVersion } from "../src/cli/version.js"
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
  source.projectFinishAttestationSourceDriftPath.mockReset()
  source.projectFinishAttestationSourceDriftPath.mockReturnValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  for (const project of projects.splice(0)) {
    rmSync(project, { force: true, recursive: true })
  }
})

describe.sequential("project finish attestation inspection and consumption", () => {
  it("fails closed for an original-artifact archive that cannot be parsed without consulting project-local evidence", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-consumption-")))
    const evidenceDir = join(projectDir, ".persona", "evidence", "project-finish-attestation")
    mkdirSync(evidenceDir, { recursive: true })
    writeVerifiedEvidence(projectDir)

    const result = inspectArtifactAt(
      projectDir,
      Buffer.from("local-repacked-archive-marker", "utf8"),
    )

    expect(result).toMatchObject({ authorityEligible: false, state: "missing" })
    expect(worker.runProjectFinishAttestationWorker).not.toHaveBeenCalled()
    expect(existsSync(join(projectDir, ".persona", "evidence", "finish-attestation", "consumption.json"))).toBe(false)
    expect(JSON.stringify(result)).not.toContain("local-repacked-archive-marker")
  })

  it("keeps inspection non-consuming and consumes a verified compatible terminal record exactly once", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-consumption-")))
    const consumptionPath = writeVerifiedEvidence(projectDir)

    expect(inspectAt(projectDir)).toMatchObject({
      authorityEligible: true,
      consumptionState: "unconsumed",
      state: "trusted",
    })
    expect(existsSync(consumptionPath)).toBe(false)

    expect(consumeAt(projectDir)).toMatchObject({
      authorityEligible: true,
      consumptionState: "consumed",
      state: "trusted",
    })
    expect(existsSync(consumptionPath)).toBe(true)

    expect(consumeAt(projectDir)).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      state: "replayed",
    })
    expect(inspectAt(projectDir)).toMatchObject({
      authorityEligible: true,
      consumptionState: "consumed",
      state: "trusted",
    })
  })

  it("retains a separately bound caller and reusable artifact unconsumed until Finish consumes it once", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-fetch-consume-")))
    const storeRoot = join(projectDir, "consumer-authority-store")
    const sourceHead = initializeGitProject(projectDir)
    mkdirSync(join(projectDir, ".persona"))
    const enrollment = authorityEnrollmentFromReadback({
      callerWorkflowPath: "research-attestation.yml",
      repositoryId: 1304576182,
      repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
      reusableWorkflowSha: "73e8654ce3307a6be7fb511e0c1f67df93c7d1b3",
    }, now)
    if (enrollment === undefined || !writeAuthorityEnrollment(enrollment, { storeRoot })) {
      throw new Error("fixture enrollment must persist")
    }
    const produced = createProjectFinishAttestationProducerArtifacts({
      buildArtifactDigest: `sha256:${"b".repeat(64)}`,
      callerWorkflowRef: `${enrollment.repositorySlug}/.github/workflows/${enrollment.callerWorkflowPath}@refs/heads/main`,
      callerWorkflowSha: sourceHead,
      issuedAt: "2026-07-18T01:00:00.000Z",
      phVersion: personaHarnessVersion(),
      repository: {
        id: enrollment.repositoryId,
        slug: enrollment.repositorySlug,
        visibility: "public",
      },
      reusableWorkflowSha: enrollment.reusableWorkflowSha,
      runAttempt: 1,
      runId: "30430000000",
      source: {
        head: sourceHead,
        identity: {
          contentDigest: `sha256:${"c".repeat(64)}`,
          entryCount: 1,
          exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"],
          gitStatusDigest: `sha256:${"d".repeat(64)}`,
          repositoryHead: sourceHead,
          schemaVersion: "source-identity.1",
          trackedEntryCount: 1,
          trackedIndexDigest: `sha256:${"e".repeat(64)}`,
          untrackedEntryCount: 0,
        },
        root: ".",
      },
      test: {
        count: 1,
        junitDigest: `sha256:${"f".repeat(64)}`,
        passed: 1,
        skipped: 0,
      },
    })
    const bundle = Buffer.from(`${JSON.stringify(produced.statement)}\n`, "utf8")
    const archive = originalArtifactArchive({
      "bundle.json": bundle,
      "predicate.json": canonicalProjectFinishAttestationBytes(produced.predicate),
      "receipt.json": produced.receiptBytes,
    })
    worker.runProjectFinishAttestationWorker.mockReturnValue({
      bundleDigest: sha256Digest(bundle),
      ok: true,
      statement: produced.statement,
    })
    expect(evidenceFromOriginalArtifact(archive)).toBeDefined()
    const inspection = withCurrentDirectory(
      projectDir,
      () => inspectProjectFinishAttestationArtifact(".", enrollment, archive, now),
    )
    expect(inspection).toMatchObject({
      authorityEligible: true,
      consumptionState: "unconsumed",
      state: "trusted",
    })

    const fetched = withCurrentDirectory(projectDir, () => runAuthorityCommand([
      "fetch",
      "github",
      "--artifact-id",
      "710000001",
      "--run-id",
      produced.receipt.lifecycle.runId,
      "--source-head",
      sourceHead,
      "--artifact-digest",
      sha256Digest(archive),
      "--json",
    ], {
      artifactFetch: () => ({
        archive,
        artifactId: 710000001,
        artifactDigest: sha256Digest(archive),
        fetchedAt: now.toISOString(),
        repositoryId: enrollment.repositoryId,
        runId: produced.receipt.lifecycle.runId,
        sourceHead,
      }),
      projectDir: ".",
      storeRoot,
      now,
    }))

    expect(fetched.status).toBe(0)
    expect(JSON.parse(fetched.stdout)).toMatchObject({
      authorityEligible: true,
      consumptionState: "unconsumed",
      state: "trusted",
    })
    expect(readAuthorityArtifact(enrollment.repositoryId, { storeRoot }).state).toBe("ready")
    expect(withCurrentDirectory(projectDir, () => readAuthorityStatus({ projectDir: ".", storeRoot, now }))).toMatchObject({
      authorityEligible: true,
      consumptionState: "unconsumed",
      state: "trusted",
    })

    expect(withCurrentDirectory(projectDir, () => readWorkflowFinishAuthority(".", { authorityStoreRoot: storeRoot, now }))).toMatchObject({
      projectAttestation: { authorityEligible: true, consumptionState: "consumed", state: "trusted" },
      status: "trusted",
    })
    expect(withCurrentDirectory(projectDir, () => readWorkflowFinishAuthority(".", { authorityStoreRoot: storeRoot, now }))).toMatchObject({
      projectAttestation: { authorityEligible: true, consumptionState: "consumed", state: "trusted" },
      status: "blocked",
    })
    expect(withCurrentDirectory(
      projectDir,
      () => consumeProjectFinishAttestationArtifact(".", enrollment, archive, now),
    )).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      state: "replayed",
    })
  })

  it("blocks stale verified evidence before it can consume the terminal record", () => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-consumption-")))
    const consumptionPath = writeVerifiedEvidence(projectDir)

    expect(consumeAt(projectDir, new Date("2026-07-18T02:00:00.000Z"))).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      state: "stale",
    })
    expect(existsSync(consumptionPath)).toBe(false)
  })

  it.each([
    "0.8.0-beta.1",
    "0.8.0-beta.2",
    "0.8.0-beta.3",
    "0.8.0-beta.4",
    "0.8.0-beta.5",
  ])("blocks an otherwise verified original artifact from %s", (phVersion) => {
    const projectDir = track(mkdtempSync(join(tmpdir(), "persona-project-finish-consumption-")))
    const consumptionPath = writeVerifiedEvidence(projectDir, statementForVersion(phVersion))

    expect(inspectAt(projectDir)).toMatchObject({
      authorityEligible: false,
      consumptionState: "not-applicable",
      state: "binding-mismatch",
    })
    expect(existsSync(consumptionPath)).toBe(false)
  })
})

function track(projectDir: string): string {
  projects.push(projectDir)
  return projectDir
}

function inspectAt(projectDir: string) {
  return withCurrentDirectory(projectDir, () => inspectProjectFinishAttestation(".", enrollment, now))
}

function inspectArtifactAt(projectDir: string, archive: Buffer) {
  return withCurrentDirectory(
    projectDir,
    () => inspectProjectFinishAttestationArtifact(".", enrollment, archive, now),
  )
}

function consumeAt(projectDir: string, at = now) {
  return withCurrentDirectory(projectDir, () => consumeProjectFinishAttestation(".", enrollment, at))
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

function writeVerifiedEvidence(projectDir: string, statement = createValidProjectFinishAttestationStatement()): string {
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

function statementForVersion(phVersion: string): Record<string, unknown> {
  const statement = createValidProjectFinishAttestationStatement()
  const predicate = requireRecord(statement, "predicate")
  const receipt = requireRecord(predicate, "receipt")
  const subject = statement["subject"]
  if (!Array.isArray(subject) || subject.length !== 1 || !isRecord(subject[0])) {
    throw new TypeError("fixture subject must contain one record")
  }
  const digest = requireRecord(subject[0], "digest")

  receipt["phVersion"] = phVersion
  const receiptDigest = canonicalProjectFinishAttestationReceiptDigest(receipt)
  predicate["receiptDigest"] = receiptDigest
  digest["sha256"] = receiptDigest.slice("sha256:".length)
  return statement
}

function initializeGitProject(projectDir: string): string {
  writeFileSync(join(projectDir, "README.md"), "consumer authority fixture\n")
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "gc.auto", "0"], { cwd: projectDir })
  execFileSync("git", ["config", "maintenance.auto", "false"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "README.md"], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "consumer authority fixture"], { cwd: projectDir })
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectDir, encoding: "utf8" }).trim()
}

function originalArtifactArchive(members: Readonly<Record<string, Buffer>>): Buffer {
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
  footer.writeUInt16LE(Object.keys(members).length, 8)
  footer.writeUInt16LE(Object.keys(members).length, 10)
  footer.writeUInt32LE(directory.byteLength, 12)
  footer.writeUInt32LE(offset, 16)
  return Buffer.concat([...localParts, directory, footer])
}
