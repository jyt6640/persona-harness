import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  blockedVerificationDecision,
  completionEligibleForAssurance,
  diagnosticVerificationDecision,
  externalAttestedVerificationDecision,
  isExternalAttestedVerificationDecision,
  isTrustedVerificationDecision,
  verificationDecisionSummary,
} from "../src/cli/workflow-verification-decision.js"
import { assessSemanticTddChain } from "../src/cli/workflow-semantic-tdd.js"
import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"
import { assessVerificationAuthority } from "../src/cli/workflow-verification-receipt.js"

const projectDirs: string[] = []

afterEach(() => {
  for (const projectDir of projectDirs) {
    rmSync(projectDir, { force: true, recursive: true })
  }
  projectDirs.length = 0
})

describe("verification decision model", () => {
  it("represents diagnostic-only evidence with deterministic summary", () => {
    const decision = diagnosticVerificationDecision("legacy-evidence-only", "legacy evidence is diagnostic-only")

    expect(decision).toEqual({
      assurance: "diagnostic-only",
      authorityProvider: "none",
      code: "legacy-evidence-only",
      completionEligible: false,
      consumptionState: "not-applicable",
      kind: "diagnostic-only",
      status: "diagnostic-only",
      summary: "legacy evidence is diagnostic-only",
    })
    expect(verificationDecisionSummary(decision)).toBe("legacy evidence is diagnostic-only")
    expect(isTrustedVerificationDecision(decision)).toBe(false)
  })

  it("represents the finish boundary as blocked without creating authority", () => {
    const decision = blockedVerificationDecision("trusted-authority-required", "trusted authority is required")

    expect(decision).toEqual({
      assurance: "none",
      authorityProvider: "none",
      code: "trusted-authority-required",
      completionEligible: false,
      consumptionState: "not-applicable",
      kind: "blocked",
      status: "blocked",
      summary: "trusted authority is required",
    })
    expect(verificationDecisionSummary(decision)).toBe("trusted authority is required")
    expect(isTrustedVerificationDecision(decision)).toBe(false)
  })

  it("rejects a copied cooperative decision because only the module-private current-process capability can satisfy cooperative assurance", () => {
    const diskValue: unknown = JSON.parse(JSON.stringify({
      assurance: "cooperative",
      authorityProvider: "cooperative-current-process",
      completionEligible: true,
      consumptionState: "unconsumed",
      decisionId: "disk-decision",
      kind: "cooperative-current-process",
      status: "trusted",
    }))

    expect(isTrustedVerificationDecision(diskValue)).toBe(false)
    expect(completionEligibleForAssurance(diskValue, "cooperative")).toBe(false)
    expect(completionEligibleForAssurance(diskValue, "external")).toBe(false)
  })

  it("rejects copied external receipt fields because disk data cannot create external authority", () => {
    const diskValue: unknown = JSON.parse(JSON.stringify({
      assurance: "external",
      attestationId: "copied-attestation",
      authorityProvider: "external-attested",
      completionEligible: true,
      consumptionState: "unconsumed",
      decisionId: "copied-decision",
      kind: "external-attested",
      sourceSnapshotDigest: "sha256:copied",
      status: "trusted",
      verifiedAt: "2026-07-18T00:00:00.000Z",
    }))

    expect(isExternalAttestedVerificationDecision(diskValue)).toBe(false)
    expect(completionEligibleForAssurance(diskValue)).toBe(false)
  })

  it("keeps the default finish requirement external even when another eligible assurance kind exists", () => {
    const decision = externalAttestedVerificationDecision({
      attestationId: "attestation-1",
      consumptionState: "unconsumed",
      decisionId: "external-decision-1",
      sourceSnapshotDigest: "sha256:source",
      verifiedAt: "2026-07-18T00:00:00.000Z",
    })

    expect(decision).toMatchObject({
      assurance: "external",
      authorityProvider: "external-attested",
      completionEligible: true,
      consumptionState: "unconsumed",
      kind: "external-attested",
    })
    expect(isExternalAttestedVerificationDecision(decision)).toBe(true)
    expect(completionEligibleForAssurance(decision)).toBe(true)
    expect(completionEligibleForAssurance(decision, "external")).toBe(true)
    expect(completionEligibleForAssurance(decision, "cooperative")).toBe(false)
  })

  it("routes receipt, semantic TDD, and finish assessments through the shared statuses", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-verification-decision-"))
    projectDirs.push(projectDir)

    const receipt = assessVerificationAuthority(projectDir)
    const semanticTdd = assessSemanticTddChain(projectDir)
    const finish = readWorkflowFinishAuthority(projectDir)

    expect(receipt.decision.status).toBe("diagnostic-only")
    expect(semanticTdd.decision.status).toBe("diagnostic-only")
    expect(finish.decision).toMatchObject({
      code: "trusted-authority-required",
      status: "blocked",
    })
    if (finish.decision.status !== "blocked") {
      throw new Error("expected the finish decision to remain blocked")
    }
    expect(finish.blocker.id).toBe(finish.decision.code)
  })
})
