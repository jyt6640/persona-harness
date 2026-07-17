export const STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA: "staged-producer-context-diagnostic.1"
export const STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_WORKFLOW_PATH: ".github/workflows/staged-producer-context-diagnostic.yml"
export const STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_WORKFLOW_REF: "jyt6640/persona-harness/.github/workflows/staged-producer-context-diagnostic.yml@refs/heads/main"

export type StagedProducerContextDiagnosticStatus = "match" | "mismatch" | "missing"

export type StagedProducerContextDiagnosticField = {
  readonly code: string
  readonly status: StagedProducerContextDiagnosticStatus
}

export type StagedProducerContextDiagnosticResult = {
  readonly artifactCreated: false
  readonly authorityEligible: false
  readonly diagnosticCodes: readonly string[]
  readonly diagnosticOnly: true
  readonly fields: readonly StagedProducerContextDiagnosticField[]
  readonly networkAccess: false
  readonly outcome: "blocked" | "match"
  readonly producerPredicateCreated: false
  readonly registryAccess: false
  readonly schemaVersion: "staged-producer-context-diagnostic.1"
  readonly signing: false
}

export function assessStagedProducerContextDiagnostic(value: unknown): StagedProducerContextDiagnosticResult
