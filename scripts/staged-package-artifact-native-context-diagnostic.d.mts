export type StagedPackageArtifactNativeContextDiagnosticStatus = "invalid" | "match" | "mismatch" | "missing"

export type StagedPackageArtifactNativeContextDiagnosticField = {
  readonly code: string
  readonly status: StagedPackageArtifactNativeContextDiagnosticStatus
}

export type StagedPackageArtifactNativeContextDiagnosticResult = {
  readonly artifactCreated: false
  readonly authorityEligible: false
  readonly diagnosticCodes: readonly string[]
  readonly diagnosticOnly: true
  readonly fields: readonly StagedPackageArtifactNativeContextDiagnosticField[]
  readonly networkAccess: false
  readonly outcome: "blocked" | "match"
  readonly producerPredicateCreated: false
  readonly registryAccess: false
  readonly schemaVersion: "staged-producer-native-context-diagnostic.1"
  readonly signing: false
}

export const STAGED_PACKAGE_ARTIFACT_NATIVE_CONTEXT_DIAGNOSTIC_SCHEMA: "staged-producer-native-context-diagnostic.1"

export function assessNativeStagedProducerContext(value: unknown): StagedPackageArtifactNativeContextDiagnosticResult
