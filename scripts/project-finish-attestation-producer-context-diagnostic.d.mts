export type ProjectFinishProducerContextDiagnosticStatus = "match" | "mismatch" | "missing"

export type ProjectFinishProducerContextDiagnosticField = {
  readonly code: string
  readonly status: ProjectFinishProducerContextDiagnosticStatus
}

export type ProjectFinishProducerContextDiagnosticResult = {
  readonly artifactProducer: false
  readonly authorityEligible: false
  readonly diagnosticCodes: readonly string[]
  readonly diagnosticOnly: true
  readonly fields: readonly ProjectFinishProducerContextDiagnosticField[]
  readonly networkAccess: true
  readonly networkAccessScope: "github-actions-oidc-only"
  readonly oidcClaimRead: boolean
  readonly oidcRequestAttempted: boolean
  readonly outcome: "blocked" | "match"
  readonly predicateCreated: false
  readonly receiptCreated: false
  readonly registryAccess: false
  readonly schemaVersion: "project-finish-attestation-producer-context-diagnostic.2"
  readonly signing: false
}

export const PROJECT_FINISH_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA:
  "project-finish-attestation-producer-context-diagnostic.2"

export function assessProjectFinishProducerContextDiagnostic(
  value: unknown,
): ProjectFinishProducerContextDiagnosticResult
