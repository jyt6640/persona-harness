import { describe, expect, it } from "vitest"

import {
  assessProductionIntegrityAudit,
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
      stagingVersion: "0.7.0-rc.8",
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
