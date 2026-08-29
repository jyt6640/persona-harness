import { CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA } from "./context-external-validation-types.js"
import type {
  ContextExternalValidationObservation,
  ContextExternalValidationParticipant,
  ContextExternalValidationProductVerdict,
  ContextExternalValidationProtocol,
  ContextExternalValidationResult,
} from "./context-external-validation-types.js"
import { parseContextExternalValidationStatus } from "./context-external-validation-parser.js"

const MINIMUM_INDEPENDENT_STARTS = 3
const PRODUCT_GO_TOKEN_OVERHEAD_PERMILLE = 1_300

export function evaluateContextExternalValidationStatus(value: unknown): ContextExternalValidationResult {
  const parsed = parseContextExternalValidationStatus(value)
  if (parsed === undefined) return blocked("context-external-validation-status-invalid")

  if (parsed.status === "not-started") {
    return {
      acceptedStartCount: 0,
      independentStartCount: 0,
      observationCount: 0,
      phase: "not-started",
      productVerdict: "INCONCLUSIVE",
      schemaVersion: CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA,
      status: "ready",
    }
  }

  const acceptedStarts = parsed.observations.filter((observation) => observation.startState === "accepted-start")
  const independentStartCount = acceptedStarts.filter((observation) => relationshipFor(parsed.protocol.cohort, observation.participantId) === "independent").length
  const productVerdict = parsed.status === "completed"
    ? calculateCompletedVerdict(parsed.protocol, acceptedStarts, independentStartCount)
    : "INCONCLUSIVE"

  if (parsed.productVerdict !== productVerdict) return blocked("context-external-validation-verdict-mismatch")
  return {
    acceptedStartCount: acceptedStarts.length,
    independentStartCount,
    observationCount: parsed.observations.length,
    phase: parsed.status,
    productVerdict,
    schemaVersion: CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA,
    status: "ready",
  }
}

function calculateCompletedVerdict(
  protocol: ContextExternalValidationProtocol,
  acceptedStarts: readonly ContextExternalValidationObservation[],
  independentStartCount: number,
): ContextExternalValidationProductVerdict {
  const positiveOutcomes = acceptedStarts.filter((observation) => observation.correctionReduced === true || observation.policySurvived === true).length
  const qualifies = independentStartCount >= MINIMUM_INDEPENDENT_STARTS
    && positiveOutcomes >= 2
    && acceptedStarts.every((observation) => observation.outcome === "completed")
    && acceptedStarts.every((observation) => observation.conflictResolution === "accurate")
    && acceptedStarts.every((observation) => observation.contradictionIncreased === false && observation.overreachIncreased === false)
    && acceptedStarts.every((observation) => observation.taskRegressed === false)
    && acceptedStarts.every((observation) => observation.durationMinutes !== null && observation.durationMinutes <= protocol.maximumMinutesPerStart)
    && acceptedStarts.every((observation) => observation.tokenOverheadPermille !== null && observation.tokenOverheadPermille <= PRODUCT_GO_TOKEN_OVERHEAD_PERMILLE)
    && acceptedStarts.every((observation) => observation.intervention === "none")
  return qualifies ? "PRODUCT_GO" : "PRODUCT_NO_GO"
}

function relationshipFor(cohort: readonly ContextExternalValidationParticipant[], participantId: string): ContextExternalValidationParticipant["relationship"] | undefined {
  return cohort.find((participant) => participant.id === participantId)?.relationship
}

function blocked(code: "context-external-validation-status-invalid" | "context-external-validation-verdict-mismatch"): ContextExternalValidationResult {
  return { code, schemaVersion: CONTEXT_EXTERNAL_VALIDATION_RESULT_SCHEMA, status: "blocked" }
}
