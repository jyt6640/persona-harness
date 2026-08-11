export const OPENCODE_INTERVIEW_OBSERVATION_SCHEMA_VERSION: "opencode-interview-observation.1"

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

export function evaluateOpenCodeInterviewObservation(value: unknown): OpenCodeInterviewObservationResult
