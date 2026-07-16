import { describe, expect, it } from "vitest"

import {
  assessStablePromotionCompletionIntegrity,
  type StablePromotionCompletionIntegrityInput,
} from "../scripts/stable-promotion-completion-integrity-core.mjs"

const SOURCE_SHA = "a".repeat(40)
const TAR_SHA256 = "b".repeat(64)
const TAR_SHA1 = "c".repeat(40)
const INTEGRITY = `sha512-${"d".repeat(86)}`
function validInput(
  overrides: Partial<StablePromotionCompletionIntegrityInput> = {},
): StablePromotionCompletionIntegrityInput {
  return {
    approval: {
      decisionDigest: `sha256:${"e".repeat(64)}`,
      packageVersion: "1.2.3",
      provider: "github-protected",
      schemaVersion: "stable-promotion-approval.1",
      sourceHead: SOURCE_SHA,
      status: "approved",
    },
    candidateTag: "latest",
    completionMatrix: {
      closureBlocked: true,
      forgedEvidenceBlocked: true,
      malformedConfigBlocked: true,
      noSensitiveOutput: true,
      sourceCheckoutIndependent: true,
      symlinkEvidenceBlocked: true,
      workflowFinishBlocked: true,
    },
    registry: {
      distTags: { latest: "1.2.3", next: "1.2.4-rc.1" },
      gitHead: SOURCE_SHA,
      integrity: INTEGRITY,
      packageName: "persona-harness",
      schemaVersion: "stable-promotion-registry-facts.1",
      shasum: TAR_SHA1,
      version: "1.2.3",
    },
    sourceHead: SOURCE_SHA,
    tarball: {
      integrity: INTEGRITY,
      packageName: "persona-harness",
      sha1: TAR_SHA1,
      sha256: TAR_SHA256,
      version: "1.2.3",
    },
    ...overrides,
  }
}

describe("stable promotion completion-integrity assessment", () => {
  it("records matching installed-package facts without authorizing a stable move", () => {
    const result = assessStablePromotionCompletionIntegrity(validInput())

    expect(result).toMatchObject({
      approval: { status: "recorded" },
      durableEvidence: "required-before-closure",
      mode: "read-only",
      status: "pass",
      stableMovement: "not-authorized",
    })
    expect(result.diagnostics).toEqual([])
  })

  it.each([
    ["registry head mismatch", { registry: { ...validInput().registry, gitHead: "f".repeat(40) } }, "registry-git-head-mismatch"],
    ["tarball integrity mismatch", { registry: { ...validInput().registry, integrity: "sha512-invalid" } }, "registry-integrity-mismatch"],
    ["unprotected approval", { approval: { ...validInput().approval, provider: "local-file" } }, "approval-not-protected"],
    [
      "forged evidence completion failure",
      { completionMatrix: { ...validInput().completionMatrix, forgedEvidenceBlocked: false } },
      "completion-forged-evidence",
    ],
    [
      "finish authority bypass",
      { completionMatrix: { ...validInput().completionMatrix, workflowFinishBlocked: false } },
      "completion-finish-authority",
    ],
  ] as const)("blocks %s", (_label, override, diagnostic) => {
    const result = assessStablePromotionCompletionIntegrity(validInput(override))

    expect(result.status).toBe("blocked")
    expect(result.stableMovement).toBe("not-authorized")
    expect(result.diagnostics).toContain(diagnostic)
  })

  it("never reflects hostile fact payloads into its bounded result", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const absolutePath = "/private/tmp/stable-promotion-secret"
    const result = assessStablePromotionCompletionIntegrity(
      validInput({
        approval: { ...validInput().approval, provider: `${secret}-${absolutePath}` },
        registry: { ...validInput().registry, packageName: `${secret}-${absolutePath}` },
      }),
    )

    expect(result.status).toBe("blocked")
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain(absolutePath)
  })
})
