export type StablePromotionCompletionIntegrityInput = {
  readonly approval: {
    readonly decisionDigest: string
    readonly packageVersion: string
    readonly provider: string
    readonly schemaVersion: string
    readonly sourceHead: string
    readonly status: string
  }
  readonly candidateTag: string
  readonly completionMatrix: {
    readonly closureBlocked: boolean
    readonly forgedEvidenceBlocked: boolean
    readonly malformedConfigBlocked: boolean
    readonly noSensitiveOutput: boolean
    readonly sourceCheckoutIndependent: boolean
    readonly symlinkEvidenceBlocked: boolean
    readonly workflowFinishBlocked: boolean
  }
  readonly registry: {
    readonly distTags: Readonly<Record<string, string>>
    readonly gitHead: string
    readonly integrity: string
    readonly packageName: string
    readonly schemaVersion: string
    readonly shasum: string
    readonly version: string
  }
  readonly sourceHead: string
  readonly tarball: {
    readonly integrity: string
    readonly packageName: string
    readonly sha1: string
    readonly sha256: string
    readonly version: string
  }
}

export type StablePromotionCompletionIntegrityResult = {
  readonly approval: {
    readonly decisionDigest: string
    readonly status: "recorded" | "unavailable"
  }
  readonly candidateTag: "latest" | "next" | "unavailable"
  readonly completionMatrix: Readonly<Record<string, "blocked" | "unavailable">>
  readonly diagnostics: readonly string[]
  readonly durableEvidence: "required-before-closure"
  readonly mode: "read-only"
  readonly provenance: {
    readonly registry: {
      readonly gitHead: string
      readonly integrity: string
      readonly version: string
    }
    readonly sourceHead: string
    readonly tarball: {
      readonly integrity: string
      readonly sha1: string
      readonly sha256: string
      readonly version: string
    }
  }
  readonly schemaVersion: "stable-promotion-completion-integrity.1"
  readonly stableMovement: "not-authorized"
  readonly status: "blocked" | "pass"
}

export function assessStablePromotionCompletionIntegrity(
  input: StablePromotionCompletionIntegrityInput,
): StablePromotionCompletionIntegrityResult
