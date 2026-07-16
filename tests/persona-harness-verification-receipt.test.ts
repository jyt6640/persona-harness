import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  VERIFICATION_ATTEMPT_DIR,
  VERIFICATION_RECEIPT_DIR,
  assessVerificationAuthority,
  parseVerificationAttempt,
  parseVerificationReceipt,
} from "../src/cli/workflow-verification-receipt.js"
import { SOURCE_IDENTITY_EXCLUSIONS } from "../src/cli/source-identity.js"

const tempProjects: string[] = []
const NOW = "2026-07-13T12:00:00.000Z"
const SOURCE_HEAD = "0123456789abcdef0123456789abcdef01234567"
const DIGEST = `sha256:${"a".repeat(64)}`

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("verification receipt and attempt contract", () => {
  it("parses a strict receipt and completed attempt without treating them as authority", () => {
    const receipt = validReceipt()
    const attempt = validAttempt()

    const parsedReceipt = parseVerificationReceipt(JSON.stringify(receipt), "receipt.json")
    const parsedAttempt = parseVerificationAttempt(JSON.stringify(attempt), "attempt.json")

    expect(parsedReceipt).toMatchObject({ ok: true, value: receipt })
    expect(parsedAttempt).toMatchObject({ ok: true, value: attempt })

    const projectDir = createProject()
    writeReceiptSet(projectDir, receipt, attempt)
    expect(assessVerificationAuthority(projectDir, new Date(NOW))).toMatchObject({
      authorityEligible: false,
      state: "untrusted",
    })
  })

  it.each([
    ["missing field", (value: Record<string, unknown>) => { delete value.receiptId }],
    ["missing source identity", (value: Record<string, unknown>) => { delete value.sourceIdentity }],
    ["malformed source identity", (value: Record<string, unknown>) => { value.sourceIdentity = { schemaVersion: "source-identity.1" } }],
    ["unknown field", (value: Record<string, unknown>) => { value.extra = "reject" }],
    ["invalid source head", (value: Record<string, unknown>) => { value.sourceHead = "arbitrary-head" }],
    ["invalid digest", (value: Record<string, unknown>) => { value.dirtyWorktreeDigest = "self-computed" }],
    ["invalid timestamp", (value: Record<string, unknown>) => { value.issuedAt = "tomorrow" }],
    ["future schema", (value: Record<string, unknown>) => { value.schemaVersion = "verification-receipt.99" }],
  ])("rejects %s with structured diagnostics", (_name, mutate) => {
    const value = validReceipt()
    mutate(value)

    const result = parseVerificationReceipt(JSON.stringify(value), "receipt.json")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.diagnostics.length).toBeGreaterThan(0)
      expect(result.diagnostics[0]?.code).toBeDefined()
      expect(result.diagnostics[0]?.message).toBeDefined()
    }
  })

  it("rejects authority and issuer class mismatches", () => {
    const value = validReceipt()
    value.authorityClass = "external-attested"
    value.issuer = { kind: "persona-harness", id: "persona-harness" }

    const result = parseVerificationReceipt(JSON.stringify(value), "receipt.json")

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain("authority-issuer-mismatch")
    }
  })

  it.each([
    ["missing session binding", (value: Record<string, unknown>) => { value.sessionId = "other-session" }],
    ["missing finish binding", (value: Record<string, unknown>) => { value.finishId = "other-finish" }],
    ["different source head", (value: Record<string, unknown>) => {
      const sourceHead = "fedcba9876543210fedcba9876543210fedcba98"
      value.sourceHead = sourceHead
      value.sourceIdentity = { ...sourceIdentity(), repositoryHead: sourceHead }
    }],
    ["different argv digest", (value: Record<string, unknown>) => {
      value.command = { catalogId: "ph-gradle-spring-verify.1", argvDigest: `sha256:${"b".repeat(64)}` }
    }],
  ])("rejects receipt/attempt %s binding", (_name, mutate) => {
    const receipt = validReceipt()
    const attempt = validAttempt()
    mutate(receipt)
    const projectDir = createProject()
    writeReceiptSet(projectDir, receipt, attempt)

    const assessment = assessVerificationAuthority(projectDir, new Date(NOW))

    expect(assessment.authorityEligible).toBe(false)
    expect(assessment.state).toBe("mismatch")
    expect(assessment.diagnostics.map((diagnostic) => diagnostic.code)).toContain("binding-mismatch")
  })

  it("rejects a receipt provenance mismatch without changing the attempt", () => {
    const receipt = validReceipt({ provenanceDigest: `sha256:${"b".repeat(64)}` })
    const attempt = validAttempt()
    const projectDir = createProject()
    writeReceiptSet(projectDir, receipt, attempt)

    const assessment = assessVerificationAuthority(projectDir, new Date(NOW))

    expect(assessment.authorityEligible).toBe(false)
    expect(assessment.state).toBe("mismatch")
    expect(assessment.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "binding-mismatch",
        message: "Receipt and attempt provenanceDigest values differ.",
      }),
    ]))
  })

  it("rejects a receipt source identity content digest mismatch without changing the attempt", () => {
    const receipt = validReceipt({
      sourceIdentity: {
        ...sourceIdentity(),
        contentDigest: `sha256:${"b".repeat(64)}`,
      },
    })
    const attempt = validAttempt()
    const projectDir = createProject()
    writeReceiptSet(projectDir, receipt, attempt)

    const assessment = assessVerificationAuthority(projectDir, new Date(NOW))

    expect(assessment.authorityEligible).toBe(false)
    expect(assessment.state).toBe("mismatch")
    expect(assessment.diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "binding-mismatch",
        message: "Receipt and attempt sourceIdentity values differ.",
      }),
    ]))
  })

  it("rejects duplicate receipt and attempt identities", () => {
    const receipt = validReceipt()
    const attempt = validAttempt()
    const projectDir = createProject()
    writeJson(projectDir, `${VERIFICATION_RECEIPT_DIR}/first.json`, receipt)
    writeJson(projectDir, `${VERIFICATION_RECEIPT_DIR}/second.json`, receipt)
    writeJson(projectDir, `${VERIFICATION_ATTEMPT_DIR}/first.json`, attempt)
    writeJson(projectDir, `${VERIFICATION_ATTEMPT_DIR}/second.json`, attempt)

    const assessment = assessVerificationAuthority(projectDir, new Date(NOW))

    expect(assessment.state).toBe("duplicate")
    expect(assessment.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["duplicate-receipt-id", "duplicate-attempt-id"]),
    )
  })

  it.each([
    ["interrupted attempt", (attempt: Record<string, unknown>) => {
      attempt.status = "interrupted"
      delete attempt.completedAt
      delete attempt.receiptId
    }],
    ["stale attempt", (attempt: Record<string, unknown>) => {
      attempt.status = "stale"
      delete attempt.completedAt
      delete attempt.receiptId
    }],
    ["expired receipt", (receipt: Record<string, unknown>) => { receipt.expiresAt = "2026-07-13T11:59:00.000Z" }],
    ["replayed receipt", (receipt: Record<string, unknown>) => { receipt.receiptId = "receipt-replayed"; receipt.provenanceDigest = `sha256:${"c".repeat(64)}` }],
  ])("fails closed for %s", (_name, mutate) => {
    const receipt = validReceipt()
    const attempt = validAttempt()
    if (_name.includes("receipt")) {
      mutate(receipt)
    } else {
      mutate(attempt)
    }
    const parsedAttempt = parseVerificationAttempt(JSON.stringify(attempt), "attempt.json")
    expect(parsedAttempt.ok).toBe(true)
    if (_name === "replayed receipt") {
      const projectDir = createProject()
      writeReceiptSet(projectDir, validReceipt(), attempt)
      writeJson(projectDir, `${VERIFICATION_RECEIPT_DIR}/replayed.json`, receipt)
      expect(assessVerificationAuthority(projectDir, new Date(NOW)).state).toBe("replayed")
      return
    }
    const projectDir = createProject()
    writeReceiptSet(projectDir, receipt, attempt)

    const assessment = assessVerificationAuthority(projectDir, new Date(NOW))

    expect(assessment.authorityEligible).toBe(false)
    expect(["expired", "stale", "interrupted", "mismatch"]).toContain(assessment.state)
  })

  it("classifies local self-digest and external records as untrusted", () => {
    const localReceipt = validReceipt()
    localReceipt.provenanceDigest = `sha256:${"d".repeat(64)}`
    const externalReceipt = validReceipt()
    externalReceipt.authorityClass = "external-attested"
    externalReceipt.issuer = { kind: "external-attestor", id: "external.example" }
    externalReceipt.issuerVerificationState = "external-attested-unverified"
    externalReceipt.receiptId = "external-receipt"
    externalReceipt.provenanceDigest = `sha256:${"e".repeat(64)}`

    const localProject = createProject()
    writeReceiptSet(localProject, localReceipt, validAttempt({ provenanceDigest: localReceipt.provenanceDigest }))
    const externalProject = createProject()
    writeReceiptSet(externalProject, externalReceipt, validAttempt({
      provenanceDigest: externalReceipt.provenanceDigest,
      receiptId: "external-receipt",
    }))

    expect(assessVerificationAuthority(localProject, new Date(NOW))).toMatchObject({
      authorityEligible: false,
      state: "untrusted",
    })
    expect(assessVerificationAuthority(externalProject, new Date(NOW))).toMatchObject({
      authorityEligible: false,
      state: "untrusted",
    })
  })

  it("keeps legacy evidence diagnostic-only and preserves its bytes", () => {
    const projectDir = createProject()
    const legacyPath = join(projectDir, ".persona/evidence/phase0/forged.json")
    mkdirSync(join(legacyPath, ".."), { recursive: true })
    const legacyBytes = '{"generatedBy":"persona-harness","status":0,"toolOutput":"BUILD SUCCESSFUL"}\n'
    writeFileSync(legacyPath, legacyBytes)

    const assessment = assessVerificationAuthority(projectDir, new Date(NOW))

    expect(assessment.state).toBe("missing")
    expect(assessment.legacyEvidence).toMatchObject({ diagnosticOnly: true, files: [".persona/evidence/phase0/forged.json"] })
    expect(readFileSync(legacyPath, "utf8")).toBe(legacyBytes)
  })

  it("returns deterministic diagnostics for malformed or future receipt files", () => {
    const projectDir = createProject()
    mkdirSync(join(projectDir, VERIFICATION_RECEIPT_DIR), { recursive: true })
    writeFileSync(join(projectDir, VERIFICATION_RECEIPT_DIR, "broken.json"), "{broken\n")
    writeFileSync(join(projectDir, VERIFICATION_RECEIPT_DIR, "future.json"), JSON.stringify({ schemaVersion: "verification-receipt.99" }))

    const first = assessVerificationAuthority(projectDir, new Date(NOW))
    const second = assessVerificationAuthority(projectDir, new Date(NOW))

    expect(first).toEqual(second)
    expect(first.state).toBe("malformed")
    expect(first.authorityEligible).toBe(false)
  })

  it("keeps P3-2 finish blocked when a receipt is absent, malformed, or structurally valid", () => {
    const projectDir = createProject()
    writeFinishFixture(projectDir)
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
    expect(finish.stderr).not.toContain("Finish status: PASS")
  })

  it("exposes receipt status through doctor without writing or migrating evidence", () => {
    const projectDir = createProject()
    writeFinishFixture(projectDir)
    const legacyPath = join(projectDir, ".persona/evidence/phase0/legacy.json")
    writeJson(projectDir, ".persona/evidence/phase0/legacy.json", { generatedBy: "persona-harness", status: 0 })
    const before = readFileSync(legacyPath, "utf8")

    const doctor = runPersonaCli(["doctor"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(doctor.status).toBe(0)
    expect(doctor.stdout).toContain("Verification receipt authority: missing")
    expect(doctor.stdout).toContain("Legacy evidence records: 2 (diagnostic-only; no automatic migration)")
    expect(doctor.stdout).not.toContain("Migration command:")
    expect(readFileSync(legacyPath, "utf8")).toBe(before)
  })
})

function validReceipt(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    schemaVersion: "verification-receipt.1",
    receiptId: "receipt-001",
    authorityClass: "local-fresh-cooperative",
    issuer: { kind: "persona-harness", id: "persona-harness" },
    issuerVerificationState: "cooperative-unverified",
    attemptId: "attempt-001",
    sessionId: "session-001",
    finishId: "finish-001",
    sourceHead: SOURCE_HEAD,
    sourceIdentity: sourceIdentity(),
    dirtyWorktreeDigest: DIGEST,
    workspaceIdentity: {
      rootDigest: DIGEST,
      deviceIdentity: "cooperative-unverified",
      platform: "darwin",
    },
    command: {
      catalogId: "ph-gradle-spring-verify.1",
      argvDigest: DIGEST,
    },
    phVersion: "0.7.0-rc.2",
    result: {
      status: "pass",
      testCount: 3,
      artifactDigests: [DIGEST],
    },
    issuedAt: "2026-07-13T11:55:00.000Z",
    expiresAt: "2026-07-13T12:55:00.000Z",
    provenanceDigest: DIGEST,
    ...overrides,
  }
}

function validAttempt(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    schemaVersion: "verification-attempt.1",
    attemptId: "attempt-001",
    sessionId: "session-001",
    finishId: "finish-001",
    sourceHead: SOURCE_HEAD,
    sourceIdentity: sourceIdentity(),
    dirtyWorktreeDigest: DIGEST,
    workspaceIdentity: {
      rootDigest: DIGEST,
      deviceIdentity: "cooperative-unverified",
      platform: "darwin",
    },
    command: {
      catalogId: "ph-gradle-spring-verify.1",
      argvDigest: DIGEST,
    },
    phVersion: "0.7.0-rc.2",
    status: "completed",
    startedAt: "2026-07-13T11:50:00.000Z",
    completedAt: "2026-07-13T11:56:00.000Z",
    receiptId: "receipt-001",
    provenanceDigest: DIGEST,
    ...overrides,
  }
}

function sourceIdentity(): Record<string, unknown> {
  return {
    schemaVersion: "source-identity.1",
    repositoryHead: SOURCE_HEAD,
    gitStatusDigest: DIGEST,
    trackedIndexDigest: DIGEST,
    contentDigest: DIGEST,
    entryCount: 3,
    trackedEntryCount: 2,
    untrackedEntryCount: 1,
    exclusions: SOURCE_IDENTITY_EXCLUSIONS,
  }
}

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-p3-verification-receipt-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeReceiptSet(projectDir: string, receipt: Record<string, unknown>, attempt: Record<string, unknown>): void {
  writeJson(projectDir, `${VERIFICATION_RECEIPT_DIR}/${String(receipt.receiptId)}.json`, receipt)
  writeJson(projectDir, `${VERIFICATION_ATTEMPT_DIR}/${String(attempt.attemptId)}.json`, attempt)
}

function writeJson(projectDir: string, relativePath: string, value: Record<string, unknown>): void {
  const target = join(projectDir, relativePath)
  mkdirSync(join(target, ".."), { recursive: true })
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`)
}

function writeFinishFixture(projectDir: string): void {
  writeFileSync(join(projectDir, "README.md"), "# Receipt fixture\n\n- Workflow verification.\n")
  writeFileSync(
    join(projectDir, "AGENTS.md"),
    [
      "# Persona Harness Agent Instructions",
      "",
      "Before implementation:",
      "- Run `npx ph workflow implement` and follow the single AI-facing rail.",
      "",
      "After implementation:",
      "- Run `npx ph workflow finish implement` before claiming completion.",
      "",
    ].join("\n"),
  )
  mkdirSync(join(projectDir, ".opencode"), { recursive: true })
  writeFileSync(
    join(projectDir, ".opencode/opencode.json"),
    `${JSON.stringify({ plugin: ["/tmp/persona-harness/dist/index.js"] }, null, 2)}\n`,
  )
  mkdirSync(join(projectDir, ".persona/workflow"), { recursive: true })
  writeJson(projectDir, ".persona/harness.jsonc", { enforce: { executeVerification: false, tdd: false } })
  writeFileSync(join(projectDir, ".persona/workflow/plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona/workflow/implementation-report.md"),
    "Status: filled\n- README ranges read: 1-20\n- `npx ph bearshell --shell './gradlew test'`\n",
  )
  writeFileSync(
    join(projectDir, ".persona/workflow/review-report.md"),
    "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
  )
  writeJson(projectDir, ".persona/evidence/phase0/verification.json", {
    command: "npx ph bearshell --shell './gradlew test'",
    status: 0,
    tool: "bearshell",
    toolOutput: "BUILD SUCCESSFUL",
  })
}
