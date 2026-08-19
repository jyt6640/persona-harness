export const OPENCODE_INTERVIEW_OBSERVATION_SCHEMA_VERSION: "opencode-interview-observation.1"
export const OPENCODE_ADVISORY_OBSERVATION_SCHEMA_VERSION: "opencode-advisory-observation.1"
export const OPENCODE_ADVISORY_MODEL: "openai/gpt-5.3-codex-spark"
export const OPENCODE_ADVISORY_THRESHOLD: Readonly<{
  id: "profile-adherence-v1"
  maxCapsuleGrowthRatio: 1.5
}>

export type OpenCodeInterviewObservationResult = Readonly<{
  schemaVersion: "opencode-interview-observation.1"
  status: "passed" | "blocked"
  code:
    | "ready"
    | "observation-schema-invalid"
    | "observation-event-invalid"
    | "assistant-response-missing"
    | "assistant-response-order-invalid"
    | "multiple-assistant-responses"
    | "message-identity-conflict"
    | "part-identity-conflict"
    | "message-lifecycle-invalid"
    | "part-lifecycle-invalid"
    | "foreign-event"
    | "assistant-response-not-single-question"
    | "assistant-response-solution-content"
    | "assistant-response-plan-content"
    | "assistant-response-command-content"
    | "assistant-response-file-change-content"
    | "pre-approval-mutation"
  ambiguousInterviewFirst: boolean
  responsePredicatePostModel: boolean
  preApprovalNoMutation: boolean
}>

export type OpenCodeAdvisoryObservationBinding = Readonly<{
  base: string
  candidate: string
  configuredModel: "openai/gpt-5.3-codex-spark"
  package: Readonly<{
    contentIdentity: string
    name: "persona-harness"
    tarSha256: string
    version: string
  }>
}>

export type OpenCodeAdvisoryObservationResult =
  | Readonly<{
      advisoryOnly: true
      code:
        | "binding-invalid"
        | "binding-mismatch"
        | "case-contract-invalid"
        | "consumer-mismatch"
        | "execution-abnormal"
        | "metric-invalid"
        | "model-not-exact-spark"
        | "profile-correction-unverified"
        | "result-cardinality-invalid"
        | "result-missing"
        | "result-schema-invalid"
        | "rollback-outcome-missing"
        | "secret-exposure"
      schemaVersion: "opencode-advisory-observation.1"
      status: "UNKNOWN"
    }>
  | Readonly<{
      advisoryOnly: true
      binding: OpenCodeAdvisoryObservationBinding
      cases: readonly [
        Readonly<{
          caseId: "baseline"
          classification: "static-policy-overlay"
          correctionVerified: false
          metrics: OpenCodeAdvisoryObservationMetrics
        }>,
        Readonly<{
          caseId: "profile"
          classification: "profile-captured-correction"
          correctionVerified: true
          metrics: OpenCodeAdvisoryObservationMetrics
        }>,
      ]
      code: "threshold-accepted" | "threshold-rejected"
      execution: OpenCodeAdvisoryObservationExecution
      failedMetrics: readonly OpenCodeAdvisoryMetric[]
      schemaVersion: "opencode-advisory-observation.1"
      status: "PASS" | "FAIL"
      threshold: Readonly<{
        id: "profile-adherence-v1"
        maxCapsuleGrowthRatio: 1.5
      }>
    }>

export type OpenCodeAdvisoryMetric =
  | "architectureGuessCount"
  | "capsuleSize"
  | "conflictOverwrites"
  | "relevantRulePrecision"
  | "repeatedCorrectionCount"
  | "rollbackOutcome"

export type OpenCodeAdvisoryObservationMetrics = Readonly<{
  architectureGuessCount: number
  capsuleSize: number
  conflictOverwrites: number
  relevantRulePrecision: number
  repeatedCorrectionCount: number
  rollbackOutcome: "failed" | "not-applicable" | "passed"
}>

export type OpenCodeAdvisoryObservationExecution = Readonly<{
  budgetDigest: string
  count: 1
  sourceDigest: string
  taskDigest: string
  terminal: "complete"
}>

export function evaluateOpenCodeInterviewObservation(value: unknown): OpenCodeInterviewObservationResult
export function evaluateOpenCodeAdvisoryObservation(
  value: unknown,
  expectedBinding: unknown,
): OpenCodeAdvisoryObservationResult
