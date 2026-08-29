export const CONTEXT_EXTERNAL_VALIDATION_PROTOCOL_SCHEMA = "persona-context-external-validation-protocol.1" as const
export const CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA = "persona-context-external-validation-status.1" as const
export const CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA = "persona-context-external-validation-result.1" as const

export type ContextExternalValidationCandidate = {
  readonly commit: string
  readonly packageVersion: string
  readonly tarSha256: string
}

export type ContextExternalValidationParticipant = {
  readonly id: string
  readonly relationship: "independent" | "past-collaborator" | "disclosed-other"
}

export type ContextExternalValidationProtocol = {
  readonly candidate: ContextExternalValidationCandidate
  readonly cohort: readonly ContextExternalValidationParticipant[]
  readonly interventionPolicy: "none" | "clarification-only"
  readonly maximumMinutesPerStart: number
  readonly schemaVersion: typeof CONTEXT_EXTERNAL_VALIDATION_PROTOCOL_SCHEMA
  readonly taskDigest: string
  readonly tokenReference: "same-task-context-off"
}

export type ContextExternalValidationObservation = {
  readonly candidate: ContextExternalValidationCandidate
  readonly conflictResolution: "accurate" | "inaccurate" | "not-observed"
  readonly contradictionIncreased: boolean | null
  readonly correctionReduced: boolean | null
  readonly durationMinutes: number | null
  readonly intervention: "none" | "declared-clarification"
  readonly overreachIncreased: boolean | null
  readonly outcome: "completed" | "not-completed" | "not-observed"
  readonly participantId: string
  readonly policySurvived: boolean | null
  readonly startState: "accepted-start" | "declined-before-start" | "withdrawn-before-start"
  readonly taskDigest: string
  readonly taskRegressed: boolean | null
  readonly tokenOverheadPermille: number | null
}

export type ContextExternalValidationProductVerdict = "INCONCLUSIVE" | "PRODUCT_GO" | "PRODUCT_NO_GO"

export type ContextExternalValidationStatus =
  | {
      readonly observations: readonly []
      readonly productVerdict: "INCONCLUSIVE"
      readonly protocol: null
      readonly schemaVersion: typeof CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA
      readonly status: "not-started"
    }
  | {
      readonly observations: readonly []
      readonly productVerdict: "INCONCLUSIVE"
      readonly protocol: ContextExternalValidationProtocol
      readonly schemaVersion: typeof CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA
      readonly status: "preregistered"
    }
  | {
      readonly observations: readonly ContextExternalValidationObservation[]
      readonly productVerdict: "INCONCLUSIVE"
      readonly protocol: ContextExternalValidationProtocol
      readonly schemaVersion: typeof CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA
      readonly status: "observing"
    }
  | {
      readonly observations: readonly ContextExternalValidationObservation[]
      readonly productVerdict: "PRODUCT_GO" | "PRODUCT_NO_GO"
      readonly protocol: ContextExternalValidationProtocol
      readonly schemaVersion: typeof CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA
      readonly status: "completed"
    }

export type ContextExternalValidationResult =
  | {
      readonly code: "context-external-validation-status-invalid" | "context-external-validation-verdict-mismatch"
      readonly schemaVersion: typeof CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA
      readonly status: "blocked"
    }
  | {
      readonly acceptedStartCount: number
      readonly independentStartCount: number
      readonly observationCount: number
      readonly phase: ContextExternalValidationStatus["status"]
      readonly productVerdict: ContextExternalValidationProductVerdict
      readonly schemaVersion: typeof CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA
      readonly status: "ready"
    }

const EMPTY_OBSERVATIONS: readonly [] = []

export const CONTEXT_EXTERNAL_VALIDATION_INITIAL_STATUS: ContextExternalValidationStatus = Object.freeze({
  observations: EMPTY_OBSERVATIONS,
  productVerdict: "INCONCLUSIVE",
  protocol: null,
  schemaVersion: CONTEXT_EXTERNAL_VALIDATION_STATUS_SCHEMA,
  status: "not-started",
})
