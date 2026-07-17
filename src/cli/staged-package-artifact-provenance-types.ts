export const STAGED_PACKAGE_ARTIFACT_PROVENANCE_SCHEMA = "staged-package-artifact-verification.1" as const
export const STAGED_PACKAGE_ARTIFACT_CHANNELS = ["staging", "next"] as const

export type StagedPackageArtifactChannel = (typeof STAGED_PACKAGE_ARTIFACT_CHANNELS)[number]

export type StagedPackageArtifactProvenanceResult = {
  readonly authorityEligible: false
  readonly channel: StagedPackageArtifactChannel | "unavailable"
  readonly diagnostics: readonly string[]
  readonly mode: "read-only"
  readonly promotionAuthorized: false
  readonly promotionDecision: "release-approval-required"
  readonly registryMutation: "not-performed"
  readonly schemaVersion: typeof STAGED_PACKAGE_ARTIFACT_PROVENANCE_SCHEMA
  readonly sourceHead?: string
  readonly subjectDigest?: string
  readonly verificationStatus: "blocked" | "verified"
  readonly version: string
}

export type StagedPackageArtifactSelection = {
  readonly channel: StagedPackageArtifactChannel
  readonly version: string
}
