import { describe, expect, it } from "vitest"

import {
  assessProductionIntegrityAudit,
  deriveProductionIntegrityAuditChannel,
  type ProductionIntegrityAuditInput,
} from "../scripts/production-integrity-audit-core.mjs"

const SHA = "a".repeat(40)
const SHA256 = `sha256:${"b".repeat(64)}`
const SHA1 = "c".repeat(40)
const INTEGRITY = `sha512-${"d".repeat(86)}`

describe("production integrity audit summary", () => {
  it("emits digest-bound expected and actual statuses for the fixed read-only contract", () => {
    const result = assessProductionIntegrityAudit(input())

    expect(result).toMatchObject({
      authorityEligible: false,
      channel: "staging",
      diagnostics: [],
      mode: "read-only",
      promotionAuthorized: false,
      promotionDecision: "release-approval-required",
      registryMutation: "not-performed",
      secretRemovalConfirmed: true,
      status: "passed",
    })
    expect(result.commandCatalog).toContainEqual({
      actualExit: 0,
      expectedExit: 0,
      id: "fixed-provenance-verifier",
      status: "passed",
    })
    expect(result.provenance).toMatchObject({
      artifactDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      registryDigest: expect.stringMatching(/^sha256:[a-f0-9]{64}$/u),
      subjectDigest: SHA256,
    })
    expect(result.summaryDigest).toMatch(/^sha256:[a-f0-9]{64}$/u)
  })

  it("derives latest for a strict stable source and expects the staging-only verifier to remain blocked", () => {
    const result = assessProductionIntegrityAudit(stableInput())

    expect(deriveProductionIntegrityAuditChannel("0.7.0")).toBe("latest")
    expect(result).toMatchObject({
      authorityEligible: false,
      channel: "latest",
      diagnostics: [],
      mode: "read-only",
      promotionAuthorized: false,
      promotionDecision: "release-approval-required",
      registryMutation: "not-performed",
      status: "passed",
    })
    expect(result.commandCatalog).toContainEqual({
      actualExit: 1,
      expectedExit: 1,
      id: "fixed-provenance-verifier",
      status: "expected-block",
    })
  })

  it("derives channels only from strict bounded SemVer", () => {
    expect(deriveProductionIntegrityAuditChannel("0.7.0-rc.1")).toBe("staging")
    expect(deriveProductionIntegrityAuditChannel("0.7.0+build.1")).toBe("latest")
    expect(deriveProductionIntegrityAuditChannel("01.7.0")).toBe("unavailable")
    expect(deriveProductionIntegrityAuditChannel("0.7.0-01")).toBe("unavailable")
  })

  it("fails closed when the strict SemVer-derived channel is not bound to the selected registry tag", () => {
    const result = assessProductionIntegrityAudit({
      ...stableInput(),
      registry: {
        ...stableInput().registry,
        selectedVersion: "0.7.0-rc.8",
      },
    })

    expect(result.status).toBe("blocked")
    expect(result.diagnostics).toContain("audit-registry-channel")
  })

  it("fails closed if the staging-only verifier unexpectedly reports success for latest", () => {
    const result = assessProductionIntegrityAudit({
      ...stableInput(),
      commandResults: {
        ...stableInput().commandResults,
        fixedProvenanceVerifier: 0,
      },
    })

    expect(result.status).toBe("blocked")
    expect(result.diagnostics).toContain("audit-fixed-provenance-verifier")
  })

  it("fails closed without reflecting unsafe raw values into the durable summary", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const result = assessProductionIntegrityAudit({
      ...input(),
      registry: {
        ...input().registry,
        gitHead: `/private/tmp/${secret}`,
      },
    })

    expect(result.status).toBe("blocked")
    expect(result.diagnostics).toContain("audit-registry-facts-invalid")
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain("/private/tmp")
  })
})

function input(): ProductionIntegrityAuditInput {
  return {
    commandResults: {
      fixedProvenanceVerifier: 0,
      installedAdversarialMatrix: 0,
      installedRegistryContract: 0,
      sourceBuild: 0,
      sourceRepositoryContract: 0,
    },
    registry: {
      gitHead: SHA,
      integrity: INTEGRITY,
      shasum: SHA1,
      selectedVersion: "0.7.0-rc.8",
      tarball: {
        integrity: INTEGRITY,
        sha1: SHA1,
        sha256: SHA256,
      },
      version: "0.7.0-rc.8",
    },
    sourceHead: SHA,
    sourceTarball: {
      integrity: INTEGRITY,
      sha1: SHA1,
      sha256: SHA256,
    },
    version: "0.7.0-rc.8",
  }
}

function stableInput(): ProductionIntegrityAuditInput {
  return {
    ...input(),
    commandResults: {
      ...input().commandResults,
      fixedProvenanceVerifier: 1,
    },
    registry: {
      ...input().registry,
      selectedVersion: "0.7.0",
      version: "0.7.0",
    },
    version: "0.7.0",
  }
}
