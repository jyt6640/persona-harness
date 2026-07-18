import { describe, expect, it } from "vitest"

import {
  canonicalProjectFinishAttestationReceiptDigest,
} from "../src/cli/project-finish-attestation-canonical.js"
import {
  assessProjectFinishAttestationStatement,
  parseProjectFinishAttestationStatement,
} from "../src/cli/project-finish-attestation-policy.js"
import {
  PROJECT_FINISH_ATTESTATION_POLICY,
} from "../src/cli/project-finish-attestation-types.js"
import { createValidProjectFinishAttestationStatement } from "./helpers/project-finish-attestation-fixture.js"

describe("project-finish-attestation.1 parser and policy", () => {
  it("parses the canonical public push-to-main subject but keeps it signature-unverified", () => {
    const statement = createValidProjectFinishAttestationStatement()
    const parsed = parseProjectFinishAttestationStatement(statement)
    const assessment = assessProjectFinishAttestationStatement(statement)

    if (!parsed.ok) {
      throw new Error(`expected valid project attestation: ${JSON.stringify(parsed.diagnostics)}`)
    }
    expect(parsed.ok).toBe(true)
    if (parsed.ok) {
      expect(parsed.value.predicate.receipt.repository).toEqual({
        id: 987654321,
        slug: "example/public-gradle-app",
        visibility: "public",
      })
      expect(parsed.value.predicate.receipt.project).toMatchObject({
        root: ".",
        scope: "repository-root-gradle-project",
      })
    }
    expect(assessment).toMatchObject({
      authorityEligible: false,
      decision: "blocked",
      state: "signature-unverified",
    })
  })

  it("requires separately bound caller and reusable workflow identities", () => {
    const statement = createValidProjectFinishAttestationStatement()
    const workflow = recordField(receipt(statement), "workflow")
    const callerSha = "a".repeat(40)
    const reusableSha = "b".repeat(40)

    delete workflow["path"]
    delete workflow["ref"]
    delete workflow["sha"]
    workflow["caller"] = {
      ref: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
      sha: callerSha,
    }
    workflow["certificateSan"] = "https://github.com/example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main"
    workflow["reusable"] = {
      path: ".github/workflows/persona-harness-project-finish.yml",
      ref: `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${reusableSha}`,
      sha: reusableSha,
    }
    recomputeReceiptDigest(statement)

    const parsed = parseProjectFinishAttestationStatement(statement)

    expect(parsed.ok).toBe(true)
  })

  it.each([
    ["unknown schema", (statement: Record<string, unknown>) => setReceiptField(statement, "schemaVersion", "finish-attestation.1")],
    ["existing finish attestation predicate", (statement: Record<string, unknown>) => {
      statement["predicateType"] = "https://github.com/jyt6640/persona-harness/attestations/finish-attestation.1"
    }],
    ["wrong policy marker", (statement: Record<string, unknown>) => {
      setReceiptField(statement, "policyMarker", "caller-selected-policy")
    }],
    ["workflow dispatch event", (statement: Record<string, unknown>) => setReceiptField(statement, "event", "workflow_dispatch")],
    ["feature branch ref", (statement: Record<string, unknown>) => setReceiptField(statement, "ref", "refs/heads/feature")],
    ["private repository", (statement: Record<string, unknown>) => {
      const repository = recordField(receipt(statement), "repository")
      repository["visibility"] = "private"
    }],
    ["enrollment field", (statement: Record<string, unknown>) => {
      receipt(statement)["enrollment"] = "caller-controlled"
    }],
    ["caller authority field", (statement: Record<string, unknown>) => {
      receipt(statement)["authorityEligible"] = true
    }],
    ["subproject source root", (statement: Record<string, unknown>) => {
      recordField(receipt(statement), "source")["root"] = "service"
    }],
    ["source identity head mismatch", (statement: Record<string, unknown>) => {
      recordField(recordField(receipt(statement), "source"), "identity")["repositoryHead"] = "b".repeat(40)
    }],
    ["non-wrapper Gradle command", (statement: Record<string, unknown>) => {
      recordField(receipt(statement), "gradle")["wrapperPath"] = "gradle"
    }],
    ["zero test count", (statement: Record<string, unknown>) => {
      const test = recordField(receipt(statement), "test")
      test["count"] = 0
      test["passed"] = 0
    }],
    ["non-fresh build outcome", (statement: Record<string, unknown>) => {
      recordField(receipt(statement), "build")["outcome"] = "UP-TO-DATE"
    }],
    ["workflow certificate SAN mismatch", (statement: Record<string, unknown>) => {
      recordField(receipt(statement), "workflow")["certificateSan"] = "https://github.com/example/other@refs/heads/main"
    }],
    ["duplicate subject", (statement: Record<string, unknown>) => {
      const subject = arrayField(statement, "subject")
      subject.push(subject[0])
    }],
    ["substituted subject", (statement: Record<string, unknown>) => {
      const subject = arrayField(statement, "subject")
      subject[0] = {
        digest: { sha256: "0".repeat(64) },
        name: "other-receipt.json",
      }
    }],
  ])("fails closed for %s", (_name, mutate) => {
    const statement = createValidProjectFinishAttestationStatement()
    mutate(statement)
    recomputeReceiptDigest(statement)

    const result = assessProjectFinishAttestationStatement(statement)

    expect(result.authorityEligible).toBe(false)
    expect(result.decision).toBe("blocked")
    expect(result.state).not.toBe("signature-unverified")
  })

  it("fails closed for an absent subject without reflecting caller data", () => {
    const statement = createValidProjectFinishAttestationStatement()
    statement["subject"] = []
    receipt(statement)["callerNote"] = "PH_SECRET_TOKEN=do-not-reflect"

    const result = assessProjectFinishAttestationStatement(statement)

    expect(result).toMatchObject({
      authorityEligible: false,
      decision: "blocked",
      state: "malformed",
    })
    expect(JSON.stringify(result)).not.toContain("PH_SECRET_TOKEN")
  })

  it("fails closed for extra or reordered subjects", () => {
    const statement = createValidProjectFinishAttestationStatement()
    const subject = arrayField(statement, "subject")
    subject.unshift({
      digest: { sha256: "0".repeat(64) },
      name: PROJECT_FINISH_ATTESTATION_POLICY.subjectName,
    })

    const result = assessProjectFinishAttestationStatement(statement)

    expect(result).toMatchObject({
      authorityEligible: false,
      decision: "blocked",
      state: "malformed",
    })
  })

  it("fails closed when the canonical receipt digest and DSSE subject digest diverge", () => {
    const statement = createValidProjectFinishAttestationStatement()
    const subject = arrayField(statement, "subject")
    recordField(subject[0], "digest")["sha256"] = "0".repeat(64)

    const result = assessProjectFinishAttestationStatement(statement)

    expect(result).toMatchObject({
      authorityEligible: false,
      decision: "blocked",
      state: "binding-mismatch",
    })
  })
})

function receipt(statement: Record<string, unknown>): Record<string, unknown> {
  return recordField(recordField(statement, "predicate"), "receipt")
}

function setReceiptField(statement: Record<string, unknown>, key: string, value: unknown): void {
  receipt(statement)[key] = value
}

function recomputeReceiptDigest(statement: Record<string, unknown>): void {
  const predicate = recordField(statement, "predicate")
  const receiptDigest = canonicalProjectFinishAttestationReceiptDigest(recordField(predicate, "receipt"))
  predicate["receiptDigest"] = receiptDigest
  recordField(arrayField(statement, "subject")[0], "digest")["sha256"] = receiptDigest.slice("sha256:".length)
}

function recordField(value: unknown, key: string): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError(`expected record for ${key}`)
  const field = value[key]
  if (!isRecord(field)) throw new TypeError(`expected record field ${key}`)
  return field
}

function arrayField(value: unknown, key: string): unknown[] {
  if (!isRecord(value)) throw new TypeError(`expected record for ${key}`)
  const field = value[key]
  if (!Array.isArray(field)) throw new TypeError(`expected array field ${key}`)
  return field
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
