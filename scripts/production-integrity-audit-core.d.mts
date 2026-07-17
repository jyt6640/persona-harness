export type ProductionIntegrityAuditTarball = {
  readonly integrity: string
  readonly sha1: string
  readonly sha256: string
}

export type ProductionIntegrityAuditInput = {
  readonly commandResults: {
    readonly fixedProvenanceVerifier: number
    readonly installedAdversarialMatrix: number
    readonly installedRegistryContract: number
    readonly sourceBuild: number
    readonly sourceRepositoryContract: number
  }
  readonly registry: {
    readonly gitHead: string
    readonly integrity: string
    readonly shasum: string
    readonly stagingVersion: string
    readonly tarball: ProductionIntegrityAuditTarball
    readonly version: string
  }
  readonly sourceHead: string
  readonly sourceTarball: ProductionIntegrityAuditTarball
  readonly version: string
}

export type ProductionIntegrityAuditResult = {
  readonly authorityEligible: false
  readonly channel: "staging"
  readonly commandCatalog: readonly {
    readonly actualExit: number | "unavailable"
    readonly expectedExit: 0
    readonly id: string
    readonly status: "blocked" | "passed"
  }[]
  readonly diagnostics: readonly string[]
  readonly mode: "read-only"
  readonly promotionAuthorized: false
  readonly promotionDecision: "release-approval-required"
  readonly provenance: {
    readonly artifactDigest: string
    readonly registryDigest: string
    readonly subjectDigest: string
  }
  readonly registryMutation: "not-performed"
  readonly schemaVersion: "production-integrity-audit.1"
  readonly secretRemovalConfirmed: true
  readonly status: "blocked" | "passed"
  readonly summaryDigest: string
}

export const PRODUCTION_INTEGRITY_AUDIT_CHANNEL: "staging"
export const PRODUCTION_INTEGRITY_AUDIT_PACKAGE: "persona-harness"

export function assessProductionIntegrityAudit(
  input: ProductionIntegrityAuditInput,
): ProductionIntegrityAuditResult
