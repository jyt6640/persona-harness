import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  blockedVerificationDecision,
  diagnosticVerificationDecision,
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
      code: "legacy-evidence-only",
      status: "diagnostic-only",
      summary: "legacy evidence is diagnostic-only",
    })
    expect(verificationDecisionSummary(decision)).toBe("legacy evidence is diagnostic-only")
    expect(isTrustedVerificationDecision(decision)).toBe(false)
  })

  it("represents the finish boundary as blocked without creating authority", () => {
    const decision = blockedVerificationDecision("trusted-authority-required", "trusted authority is required")

    expect(decision).toEqual({
      code: "trusted-authority-required",
      status: "blocked",
      summary: "trusted authority is required",
    })
    expect(verificationDecisionSummary(decision)).toBe("trusted authority is required")
    expect(isTrustedVerificationDecision(decision)).toBe(false)
  })

  it("rejects a trusted-looking disk object because only an internal capability can be trusted", () => {
    const diskValue: unknown = JSON.parse(JSON.stringify({
      authority: "local-current-process",
      decisionId: "disk-decision",
      status: "trusted",
    }))

    expect(isTrustedVerificationDecision(diskValue)).toBe(false)
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
