import { createHash } from "node:crypto"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  FINISH_ATTESTATION_BUNDLE_PATH,
  FINISH_ATTESTATION_CONSUMPTION_PATH,
  FINISH_ATTESTATION_POLICY,
  FINISH_ATTESTATION_COMMAND_CATALOG,
  FINISH_ATTESTATION_PREDICATE_TYPE,
  consumeFinishAttestation,
  parseFinishAttestationStatement,
  verifyExternalFinishAttestation,
} from "../src/cli/workflow-finish-attestation.js"
import { canonicalJson } from "../src/cli/workflow-finish-attestation-canonical.js"

const projectDirs: string[] = []
const workerPath = join(process.cwd(), "scripts", "verify-finish-attestation.mjs")

afterEach(() => {
  for (const projectDir of projectDirs) {
    rmSync(projectDir, { force: true, recursive: true })
  }
  projectDirs.length = 0
})

describe("finish-attestation.1 policy", () => {
  it("pins the protected-main signer and fixed verification contract", () => {
    expect(FINISH_ATTESTATION_POLICY).toMatchObject({
      certificateIdentityURI: "https://github.com/jyt6640/persona-harness/.github/workflows/canonical-clean-ci-attestation-builder.yml@refs/heads/main",
      certificateIssuer: "https://token.actions.githubusercontent.com",
      event: "push",
      predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
      ref: "refs/heads/main",
      repository: "jyt6640/persona-harness",
      repositoryId: 1272008570,
      runnerEnvironment: "github-hosted",
      runnerLabel: "ubuntu-latest",
      runnerOs: "Linux",
      workflowPath: ".github/workflows/canonical-clean-ci-attestation-builder.yml",
    })
    expect(FINISH_ATTESTATION_BUNDLE_PATH).toBe(".persona/evidence/finish-attestation/bundle.json")
    expect(FINISH_ATTESTATION_CONSUMPTION_PATH).toBe(".persona/evidence/finish-attestation/consumption.json")
  })

  it("uses only the fixed product-owned worker and online Sigstore trust refresh", () => {
    const worker = readFileSync(workerPath, "utf8")

    expect(worker).toContain("@sigstore/tuf")
    expect(worker).toContain("forceInit: true")
    expect(worker).toContain("forceCache: false")
    expect(worker).toContain("https://tuf-repo-cdn.sigstore.dev")
    expect(worker).not.toContain("gh ")
    expect(worker).not.toContain("process.env")
    expect(worker).not.toContain("spawn")
    expect(worker).not.toContain("shell")
  })

  it("parses a canonical statement and binds the subject to canonical receipt bytes", () => {
    const receipt = canonicalReceipt()
    const receiptBytes = Buffer.from(`${canonicalJson(receipt)}\n`)
    const statement = canonicalStatement(receipt, receiptBytes)

    const result = parseFinishAttestationStatement(statement)
    expect(result).toMatchObject({
      ok: true,
      value: {
        predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
        predicate: {
          receipt: {
            schemaVersion: "finish-attestation.1",
            repository: "jyt6640/persona-harness",
            source: { clean: true, head: receipt.source.head },
          },
        },
      },
    })
  })

  it.each([
    ["staging", (statement: Record<string, unknown>) => updatePredicate(statement, { event: "workflow_dispatch" })],
    ["wrong repository", (statement: Record<string, unknown>) => updatePredicate(statement, { repository: "attacker/repo" })],
    ["wrong ref", (statement: Record<string, unknown>) => updatePredicate(statement, { ref: "refs/heads/feature" })],
    ["zero tests", (statement: Record<string, unknown>) => updatePredicate(statement, { test: { count: 0, failed: 0, passed: 0, skipped: 0 } })],
    ["dirty source", (statement: Record<string, unknown>) => updatePredicate(statement, { source: { ...readPredicate(statement).source, clean: false } })],
  ])("rejects %s predicate claims", (_name, mutate) => {
    const receipt = canonicalReceipt()
    const receiptBytes = Buffer.from(`${canonicalJson(receipt)}\n`)
    const statement = mutate(canonicalStatement(receipt, receiptBytes))

    const result = parseFinishAttestationStatement(statement)

    expect(result.ok).toBe(false)
  })
})

describe("finish-attestation.1 authority boundary", () => {
  it("fails closed when the fixed external bundle is absent", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-finish-attestation-missing-"))
    projectDirs.push(projectDir)

    const result = verifyExternalFinishAttestation(projectDir)

    expect(result).toMatchObject({
      authorityEligible: false,
      state: "missing",
    })
  })

  it("fails closed for an unsigned or malformed bundle without creating consumption", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-finish-attestation-invalid-"))
    projectDirs.push(projectDir)
    const bundlePath = join(projectDir, FINISH_ATTESTATION_BUNDLE_PATH)
    const parent = join(projectDir, ".persona", "evidence", "finish-attestation")
    mkdirSync(parent, { recursive: true })
    writeFileSync(bundlePath, JSON.stringify({ mediaType: "not-a-sigstore-bundle" }))

    const result = verifyExternalFinishAttestation(projectDir)

    expect(result.authorityEligible).toBe(false)
    expect(["malformed", "crypto-failed", "unavailable"]).toContain(result.state)
    expect(existsSync(join(projectDir, FINISH_ATTESTATION_CONSUMPTION_PATH))).toBe(false)
  })

  it("consumes an attestation identity exactly once", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-finish-attestation-replay-"))
    projectDirs.push(projectDir)

    const first = consumeFinishAttestation(projectDir, "attestation-1", "nonce-1", "request-1")
    const second = consumeFinishAttestation(projectDir, "attestation-1", "nonce-1", "request-2")

    expect(first).toEqual({ ok: true })
    expect(second).toMatchObject({ ok: false, code: "replayed-attestation" })
    expect(JSON.parse(readFileSync(join(projectDir, FINISH_ATTESTATION_CONSUMPTION_PATH), "utf8"))).toMatchObject({
      attestationId: "attestation-1",
      nonce: "nonce-1",
      requestId: "request-1",
    })
  })
})

type Receipt = {
  readonly authorityBoundary: "external-attested"
  readonly authorityEligible: true
  readonly command: {
    readonly argvDigest: string
    readonly catalogId: string
    readonly commands: readonly { readonly args: readonly string[]; readonly executable: string; readonly id: string }[]
    readonly results: readonly {
      readonly argv: readonly string[]
      readonly exitCode: number
      readonly id: string
      readonly stderrDigest: string
      readonly stdoutDigest: string
    }[]
  }
  readonly event: "push"
  readonly expiresAt: string
  readonly finishId: string
  readonly issuedAt: string
  readonly nonce: string
  readonly pack: { readonly fileCount: number; readonly name: string; readonly version: string }
  readonly phVersion: string
  readonly predicateType: string
  readonly ref: string
  readonly repository: string
  readonly repositoryId: number
  readonly replayState: "unconsumed"
  readonly runAttempt: number
  readonly runId: string
  readonly attemptId: string
  readonly schemaVersion: "finish-attestation.1"
  readonly sessionId: string
  readonly source: {
    readonly clean: true
    readonly dirtyWorktreeDigest: string
    readonly head: string
    readonly identity: {
      readonly contentDigest: string
      readonly entryCount: number
      readonly exclusions: readonly string[]
      readonly gitStatusDigest: string
      readonly repositoryHead: string
      readonly schemaVersion: "source-identity.1"
      readonly trackedEntryCount: number
      readonly trackedIndexDigest: string
      readonly untrackedEntryCount: number
    }
  }
  readonly test: {
    readonly artifactDigest: string
    readonly count: number
    readonly failed: number
    readonly identity: string
    readonly passed: number
    readonly skipped: number
  }
  readonly workflow: {
    readonly path: string
    readonly ref: string
    readonly sha: string
  }
  readonly runner: {
    readonly environment: string
    readonly label: string
    readonly os: string
  }
}

function canonicalReceipt(): Receipt {
  const head = "a".repeat(40)
  const digest = "sha256:" + "b".repeat(64)
  const commands = FINISH_ATTESTATION_COMMAND_CATALOG.map((command) => ({
    args: [...command.args],
    executable: command.executable,
    id: command.id,
  }))
  return {
    authorityBoundary: "external-attested",
    authorityEligible: true,
    command: {
      argvDigest: `sha256:${createHash("sha256").update(canonicalJson(FINISH_ATTESTATION_COMMAND_CATALOG)).digest("hex")}`,
      catalogId: "persona-harness-clean-ci-builder.1",
      commands,
      results: commands.map((command) => ({
        argv: [command.executable, ...command.args],
        exitCode: 0,
        id: command.id,
        stderrDigest: digest,
        stdoutDigest: digest,
      })),
    },
    event: "push",
    expiresAt: "2026-07-16T05:00:00.000Z",
    finishId: "clean-ci-builder-finish-12345-1",
    issuedAt: "2026-07-16T03:00:00.000Z",
    nonce: "clean-ci-builder-12345-1-" + head,
    pack: { fileCount: 1, name: "persona-harness", version: "0.7.0-rc.3" },
    phVersion: "0.7.0-rc.3",
    predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
    ref: "refs/heads/main",
    repository: "jyt6640/persona-harness",
    repositoryId: 1272008570,
    replayState: "unconsumed",
    runAttempt: 1,
    runId: "12345",
    attemptId: "clean-ci-builder-attempt-12345-1",
    schemaVersion: "finish-attestation.1",
    sessionId: "clean-ci-builder-session-12345-1",
    source: {
      clean: true,
      dirtyWorktreeDigest: "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      head,
      identity: {
        contentDigest: digest,
        entryCount: 1,
        exclusions: [".git/**", ".gradle/**", "build/**", "node_modules/**", "<configured-evidence>/**"],
        gitStatusDigest: digest,
        repositoryHead: head,
        schemaVersion: "source-identity.1",
        trackedEntryCount: 1,
        trackedIndexDigest: digest,
        untrackedEntryCount: 0,
      },
    },
    test: { artifactDigest: digest, count: 1, failed: 0, identity: "vitest:repository", passed: 1, skipped: 0 },
    workflow: {
      path: ".github/workflows/canonical-clean-ci-attestation-builder.yml",
      ref: "jyt6640/persona-harness/.github/workflows/canonical-clean-ci-attestation-builder.yml@refs/heads/main",
      sha: head,
    },
    runner: { environment: "github-hosted", label: "ubuntu-latest", os: "Linux" },
  }
}

function canonicalStatement(receipt: Receipt, receiptBytes: Buffer): Record<string, unknown> {
  return {
    _type: "https://in-toto.io/Statement/v1",
    predicate: {
      authorityBoundary: "external-attested",
      authorityEligible: true,
      predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
      receipt,
      receiptDigest: `sha256:${createHash("sha256").update(receiptBytes).digest("hex")}`,
    },
    predicateType: FINISH_ATTESTATION_PREDICATE_TYPE,
    subject: [{ digest: { sha256: createHash("sha256").update(receiptBytes).digest("hex") }, name: "receipt.json" }],
  }
}

function readPredicate(statement: Record<string, unknown>): Receipt {
  return statement.predicate as Receipt
}

function updatePredicate(statement: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  return { ...statement, predicate: { ...readPredicate(statement), ...patch } }
}
