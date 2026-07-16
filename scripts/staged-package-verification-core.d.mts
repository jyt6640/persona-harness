export type StagedPackageVerificationInput = {
  readonly installed: {
    readonly authorityBlocked: boolean
    readonly cliHelp: boolean
    readonly closureAuthorityParity: boolean
    readonly exactVersion: boolean
    readonly npmTest: boolean
    readonly sourceCheckoutIndependent: boolean
    readonly version: boolean
    readonly workflowHelp: boolean
  }
  readonly plan: {
    readonly canonicalMainHead: string
    readonly packageName: string
    readonly packageVersion: string
    readonly promotionTarget: string
    readonly schemaVersion: string
    readonly sourceHead: string
    readonly sourceTag: string
    readonly stagedTag: string
  }
  readonly preflight: {
    readonly exactVersion: string
    readonly outputDigest: string
    readonly packageName: string
    readonly schemaVersion: string
    readonly version: string
  }
  readonly provenance: {
    readonly method: string
    readonly outputDigest: string
    readonly status: string
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
  readonly tarball: {
    readonly integrity: string
    readonly packageName: string
    readonly sha1: string
    readonly sha256: string
    readonly version: string
  }
}

export type StagedPackageVerificationResult = {
  readonly diagnostics: readonly string[]
  readonly durableEvidence: "required-before-closure"
  readonly installed: Readonly<Record<string, "unavailable" | "verified">>
  readonly mode: "read-only"
  readonly promotionAuthorized: false
  readonly promotionDecision: "blocked" | "release-approval-required"
  readonly provenance: {
    readonly auditSignatures: {
      readonly method: string
      readonly outputDigest: string
      readonly status: "unavailable" | "verified"
    }
    readonly registry: {
      readonly gitHead: string
      readonly integrity: string
      readonly shasum: string
      readonly version: string
    }
    readonly source: {
      readonly canonicalMainHead: string
      readonly sourceHead: string
      readonly sourceTag: string
    }
    readonly tarball: {
      readonly integrity: string
      readonly sha1: string
      readonly sha256: string
      readonly version: string
    }
  }
  readonly registryMutation: "not-performed"
  readonly schemaVersion: "staged-package-verification.1"
  readonly verificationStatus: "blocked" | "verified"
}

export function assessStagedPackageVerification(
  input: StagedPackageVerificationInput,
): StagedPackageVerificationResult
