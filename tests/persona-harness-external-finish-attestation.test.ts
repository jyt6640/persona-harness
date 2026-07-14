import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"
import {
  CLEAN_CI_ARGV,
  CLEAN_CI_CATALOG_ID,
  CLEAN_CI_REF,
  CLEAN_CI_REPOSITORY,
  CLEAN_CI_WORKFLOW,
  FINISH_ATTESTATION_PREDICATE_TYPE,
  FINISH_ATTESTATION_SCHEMA,
  assessExternalFinishAttestation,
  parseFinishAttestation,
} from "../src/cli/workflow-external-finish-attestation.js"

const tempProjects: string[] = []
const DIGEST = `sha256:${"a".repeat(64)}`
const SOURCE_HEAD = "0123456789abcdef0123456789abcdef01234567"

afterEach(() => {
  for (const projectDir of tempProjects) rmSync(projectDir, { recursive: true, force: true })
  tempProjects.length = 0
})

describe("clean-CI external finish attestation", () => {
  it("parses the versioned predicate with strict clean-CI bindings", () => {
    const receipt = validReceipt()
    const parsed = parseFinishAttestation(JSON.stringify(receipt), "receipt.json")

    expect(parsed).toMatchObject({ ok: true, value: receipt })
    expect(FINISH_ATTESTATION_SCHEMA).toBe("finish-attestation.1")
    expect(FINISH_ATTESTATION_PREDICATE_TYPE).toContain("finish-attestation.1")
  })

  it.each([
    ["legacy schema", (value: Record<string, unknown>) => { value.schemaVersion = "verification-receipt.1" }],
    ["dirty source", (value: Record<string, unknown>) => { value.dirtyWorktreeDigest = `sha256:${"b".repeat(64)}` }],
    ["zero tests", (value: Record<string, unknown>) => {
      value.test = { identity: "suite", count: 0, passed: true }
      value.result = { status: "pass", testCount: 0 }
    }],
    ["wrong mode", (value: Record<string, unknown>) => { value.sourceMode = "local" }],
    ["wrong fixed command", (value: Record<string, unknown>) => {
      value.command = { catalogId: "caller-selected", argv: ["node", "other-script"], argvDigest: DIGEST }
    }],
    ["wrong builder ref", (value: Record<string, unknown>) => { value.ref = "refs/heads/other" }],
    ["unknown field", (value: Record<string, unknown>) => { value.untrusted = true }],
  ])("rejects %s with structured diagnostics", (_name, mutate) => {
    const value = validReceipt()
    mutate(value)

    const parsed = parseFinishAttestation(JSON.stringify(value), "receipt.json")

    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.diagnostics[0]?.code).toBeDefined()
  })

  it("fails closed without a bundle and never treats local evidence as authority", () => {
    const projectDir = createProject()
    writeReceipt(projectDir, validReceipt())

    const external = assessExternalFinishAttestation(projectDir)
    const authority = readWorkflowFinishAuthority(projectDir)

    expect(external.status).toBe("blocked")
    expect(external.authorityEligible).toBe(false)
    expect(external.reason).toContain("bundle")
    expect(authority.status).toBe("blocked")
    expect(authority.blocker.id).toBe("trusted-authority-required")
  })

  it("rejects a caller-selected trust root and preserves read-only behavior", () => {
    const projectDir = createProject()
    writeReceipt(projectDir, validReceipt())
    writeFileSync(join(projectDir, ".persona", "evidence", "external-finish-attestation", "bundle.json"), "{}\n")

    const before = readTree(projectDir)
    const external = assessExternalFinishAttestation(projectDir, new Date("2026-07-14T12:00:00.000Z"))

    expect(external.status).toBe("blocked")
    expect(external.authorityEligible).toBe(false)
    expect(external.reason).toContain("cryptographic")
    expect(readTree(projectDir)).toBe(before)
  })
})

function validReceipt(): Record<string, unknown> {
  return {
    schemaVersion: FINISH_ATTESTATION_SCHEMA,
    sourceMode: "clean-ci",
    repository: CLEAN_CI_REPOSITORY,
    ref: CLEAN_CI_REF,
    workflow: CLEAN_CI_WORKFLOW,
    workflowRef: `${CLEAN_CI_REPOSITORY}/${CLEAN_CI_WORKFLOW}@${CLEAN_CI_REF}`,
    workflowSha: SOURCE_HEAD,
    runId: "100",
    runAttempt: 1,
    sourceHead: SOURCE_HEAD,
    dirtyWorktreeDigest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    workspaceIdentity: {
      kind: "github-hosted-runner",
      runnerEnvironment: "github-hosted",
      identity: "run-100",
    },
    command: {
      catalogId: CLEAN_CI_CATALOG_ID,
      argv: CLEAN_CI_ARGV,
      argvDigest: DIGEST,
    },
    phVersion: "0.7.0-rc.3",
    attemptId: "attempt-clean-ci-100",
    sessionId: "session-clean-ci-100",
    finishId: "finish-clean-ci-100",
    artifactDigests: [{ name: "ci-reverification", digest: DIGEST }],
    test: { identity: "junit:test", count: 1, passed: true },
    result: { status: "pass", testCount: 1 },
    issuedAt: "2026-07-14T11:00:00.000Z",
    expiresAt: "2026-07-14T13:00:00.000Z",
    nonce: "nonce-clean-ci-100",
    replayState: "unconsumed",
  }
}

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-external-attestation-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "evidence", "external-finish-attestation"), { recursive: true })
  return projectDir
}

function writeReceipt(projectDir: string, receipt: Record<string, unknown>): void {
  writeFileSync(
    join(projectDir, ".persona", "evidence", "external-finish-attestation", "receipt.json"),
    `${JSON.stringify(receipt, null, 2)}\n`,
  )
}

function readTree(projectDir: string): string {
  return execFileSync("find", [projectDir, "-type", "f", "-exec", "shasum", "-a", "256", "{}", ";"], { encoding: "utf8" })
}
