export const INSTALLED_CHECKS = [
  "authorityBlocked",
  "cliHelp",
  "closureAuthorityParity",
  "exactVersion",
  "npmTest",
  "sourceCheckoutIndependent",
  "version",
  "workflowHelp",
] as const

export type InstalledCheck = (typeof INSTALLED_CHECKS)[number]
export type JsonRecord = Readonly<Record<string, unknown>>
export const STAGED_PACKAGE_TAGS = ["staging", "next"] as const
export type StagedPackageTag = (typeof STAGED_PACKAGE_TAGS)[number]

export type VerifiedInstalled = {
  readonly authorityBlocked: boolean
  readonly cliHelp: boolean
  readonly closureAuthorityParity: boolean
  readonly exactVersion: boolean
  readonly npmTest: boolean
  readonly sourceCheckoutIndependent: boolean
  readonly version: boolean
  readonly workflowHelp: boolean
}

export type VerifiedPlan = {
  readonly canonicalMainHead: string
  readonly packageName: "persona-harness"
  readonly packageVersion: string
  readonly promotionTarget: "next"
  readonly sourceHead: string
  readonly sourceTag: string
  readonly stagedTag: StagedPackageTag
}

export type VerifiedPreflight = {
  readonly exactVersion: "absent" | "present"
  readonly outputDigest: string
  readonly packageName: "persona-harness"
  readonly version: string
}

export type VerifiedRegistry = {
  readonly gitHead: string
  readonly integrity: string
  readonly packageName: "persona-harness"
  readonly shasum: string
  readonly stagedTag: StagedPackageTag
  readonly stagedVersion: string
  readonly version: string
}

export type VerifiedTarball = {
  readonly integrity: string
  readonly packageName: "persona-harness"
  readonly sha1: string
  readonly sha256: string
  readonly version: string
}

export type VerifiedProvenance = {
  readonly method: "npm-audit-signatures"
  readonly outputDigest: string
  readonly status: "unverified" | "verified"
}

export type StagedPackageVerificationAssessment = {
  readonly diagnostics: readonly string[]
  readonly installed: VerifiedInstalled | undefined
  readonly plan: VerifiedPlan | undefined
  readonly preflight: VerifiedPreflight | undefined
  readonly provenance: VerifiedProvenance | undefined
  readonly registry: VerifiedRegistry | undefined
  readonly tarball: VerifiedTarball | undefined
}

export type StagedPackageVerificationInput = {
  readonly installed: VerifiedInstalled
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
  readonly installed: Readonly<Record<InstalledCheck, "unavailable" | "verified">>
  readonly mode: "read-only"
  readonly promotionAuthorized: false
  readonly promotionDecision: "blocked" | "release-approval-required"
  readonly provenance: {
    readonly auditSignatures: {
      readonly method: "npm-audit-signatures" | "unavailable"
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
