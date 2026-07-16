import { describe, expect, it } from "vitest"

import {
  assessStagedPackageVerification,
  type StagedPackageVerificationInput,
} from "../scripts/staged-package-verification-core.mjs"

const SOURCE_SHA = "a".repeat(40)
const TARBALL_SHA1 = "b".repeat(40)
const TARBALL_SHA256 = "c".repeat(64)
const TARBALL_INTEGRITY = `sha512-${"d".repeat(86)}`
const AUDIT_DIGEST = `sha256:${"e".repeat(64)}`

function validInput(
  overrides: Partial<StagedPackageVerificationInput> = {},
): StagedPackageVerificationInput {
  return {
    installed: {
      authorityBlocked: true,
      cliHelp: true,
      exactVersion: true,
      npmTest: true,
      sourceCheckoutIndependent: true,
      version: true,
      workflowHelp: true,
    },
    plan: {
      canonicalMainHead: SOURCE_SHA,
      packageName: "persona-harness",
      packageVersion: "1.2.3",
      promotionTarget: "latest",
      schemaVersion: "staged-package-plan.1",
      sourceHead: SOURCE_SHA,
      sourceTag: "v1.2.3",
      stagedTag: "next",
    },
    preflight: {
      exactVersion: "absent",
      outputDigest: AUDIT_DIGEST,
      packageName: "persona-harness",
      schemaVersion: "staged-package-preflight.1",
      version: "1.2.3",
    },
    provenance: {
      method: "npm-audit-signatures",
      outputDigest: AUDIT_DIGEST,
      status: "verified",
    },
    registry: {
      distTags: { latest: "1.2.2", next: "1.2.3" },
      gitHead: SOURCE_SHA,
      integrity: TARBALL_INTEGRITY,
      packageName: "persona-harness",
      schemaVersion: "staged-package-registry-facts.1",
      shasum: TARBALL_SHA1,
      version: "1.2.3",
    },
    tarball: {
      integrity: TARBALL_INTEGRITY,
      packageName: "persona-harness",
      sha1: TARBALL_SHA1,
      sha256: TARBALL_SHA256,
      version: "1.2.3",
    },
    ...overrides,
  }
}

describe("staged package verification assessment", () => {
  it("verifies matching staged facts while requiring a separate release approval", () => {
    const result = assessStagedPackageVerification(validInput())

    expect(result).toMatchObject({
      durableEvidence: "required-before-closure",
      mode: "read-only",
      promotionAuthorized: false,
      promotionDecision: "release-approval-required",
      registryMutation: "not-performed",
      verificationStatus: "verified",
    })
    expect(result.diagnostics).toEqual([])
  })

  it.each([
    [
      "an already-published exact version",
      { preflight: { ...validInput().preflight, exactVersion: "present" } },
      "existing-version-present",
    ],
    [
      "a source head outside canonical main",
      { plan: { ...validInput().plan, sourceHead: "f".repeat(40) } },
      "source-main-mismatch",
    ],
    [
      "a mismatched source tag plan",
      { plan: { ...validInput().plan, sourceTag: "v1.2.2" } },
      "source-tag-version-mismatch",
    ],
    [
      "a non-staged channel",
      { plan: { ...validInput().plan, stagedTag: "latest" } },
      "staged-tag-invalid",
    ],
    [
      "a staged tag that resolves elsewhere",
      { registry: { ...validInput().registry, distTags: { latest: "1.2.2", next: "1.2.2" } } },
      "staged-dist-tag-mismatch",
    ],
    [
      "an unsafe channel value",
      {
        registry: {
          ...validInput().registry,
          distTags: { latest: "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa", next: "1.2.3" },
        },
      },
      "registry-facts-invalid",
    ],
    [
      "a registry source mismatch",
      { registry: { ...validInput().registry, gitHead: "f".repeat(40) } },
      "registry-git-head-mismatch",
    ],
    [
      "a tarball shasum mismatch",
      { registry: { ...validInput().registry, shasum: "f".repeat(40) } },
      "registry-shasum-mismatch",
    ],
    [
      "a tarball integrity mismatch",
      { registry: { ...validInput().registry, integrity: `sha512-${"f".repeat(86)}` } },
      "registry-integrity-mismatch",
    ],
    [
      "unverified provenance",
      { provenance: { ...validInput().provenance, status: "unverified" } },
      "provenance-unverified",
    ],
    [
      "a failed installed package surface",
      { installed: { ...validInput().installed, authorityBlocked: false } },
      "installed-authority-boundary-failed",
    ],
  ] as const)("blocks %s", (_label, override, diagnostic) => {
    const result = assessStagedPackageVerification(validInput(override))

    expect(result.verificationStatus).toBe("blocked")
    expect(result.promotionAuthorized).toBe(false)
    expect(result.promotionDecision).toBe("blocked")
    expect(result.diagnostics).toContain(diagnostic)
  })

  it("does not reflect hostile fact data into the result", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const absolutePath = "/private/tmp/staged-package-secret"
    const result = assessStagedPackageVerification(validInput({
      plan: { ...validInput().plan, packageName: `${secret}-${absolutePath}` },
      registry: { ...validInput().registry, packageName: `${secret}-${absolutePath}` },
    }))

    expect(result.verificationStatus).toBe("blocked")
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain(absolutePath)
  })
})
