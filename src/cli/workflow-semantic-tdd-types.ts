export type SemanticTddState =
  | "invalid"
  | "legacy-only"
  | "malformed"
  | "missing-green"
  | "missing-red"
  | "mismatch"
  | "ordering-invalid"
  | "replayed"
  | "valid-untrusted"

export type SemanticTddDiagnosticCode =
  | "semantic-artifact-invalid"
  | "semantic-binding-mismatch"
  | "semantic-green-required"
  | "semantic-junit-failure-missing"
  | "semantic-junit-pass-missing"
  | "semantic-legacy-only"
  | "semantic-order-invalid"
  | "semantic-red-required"
  | "semantic-replayed"
  | "semantic-testcase-mismatch"

export type SemanticTddDiagnostic = {
  readonly code: SemanticTddDiagnosticCode
  readonly message: string
  readonly path: string
}

export type SemanticTddPhase = {
  readonly attemptId: string
  readonly artifactPath: string
  readonly finishId: string
  readonly sessionId: string
  readonly sourceHead: string
  readonly testcaseId: string
}

export type SemanticTddAssessment = {
  readonly authorityEligible: false
  readonly diagnosticCodes: readonly SemanticTddDiagnosticCode[]
  readonly diagnostics: readonly SemanticTddDiagnostic[]
  readonly green?: SemanticTddPhase
  readonly red?: SemanticTddPhase
  readonly state: SemanticTddState
  readonly summary: string
}
