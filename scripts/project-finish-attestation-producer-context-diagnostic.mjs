import {
  assessProjectFinishProducerContextDiagnosticWorkflow,
} from "./project-finish-attestation-producer-context.mjs"

export const PROJECT_FINISH_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA =
  "project-finish-attestation-producer-context-diagnostic.1"

export function assessProjectFinishProducerContextDiagnostic(value) {
  const input = isRecord(value) ? value : {}
  const claims = isRecord(input.claims) ? input.claims : undefined
  const environment = isRecord(input.environment) ? input.environment : {}
  const core = assessProjectFinishProducerContextDiagnosticWorkflow(claims, environment)
  const fields = [
    statusForFixed("github-actions", environment.GITHUB_ACTIONS, "true"),
    {
      code: "oidc-claims",
      status: claims === undefined ? "missing" : "match",
    },
    ...core.fields,
    statusForFixed("runner-environment-env", environment.RUNNER_ENVIRONMENT, "github-hosted"),
    statusForFixed("runner-os", environment.RUNNER_OS, "Linux"),
    statusForCheckout(input.producerCheckout),
  ]
  const diagnosticCodes = fields
    .filter((field) => field.status !== "match")
    .map((field) => `${PROJECT_FINISH_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA}-${field.code}-${field.status}`)

  return {
    artifactProducer: false,
    authorityEligible: false,
    diagnosticCodes,
    diagnosticOnly: true,
    fields,
    networkAccess: false,
    oidcClaimRead: claims !== undefined,
    outcome: diagnosticCodes.length === 0 ? "match" : "blocked",
    predicateCreated: false,
    receiptCreated: false,
    registryAccess: false,
    schemaVersion: PROJECT_FINISH_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA,
    signing: false,
  }
}

function statusForFixed(code, value, expected) {
  if (typeof value !== "string" || value.length === 0 || value.length > 512 || /[\u0000\r\n]/u.test(value)) {
    return { code, status: "missing" }
  }
  return { code, status: value === expected ? "match" : "mismatch" }
}

function statusForCheckout(value) {
  if (value === "match") return { code: "producer-checkout", status: "match" }
  if (value === "missing") return { code: "producer-checkout", status: "missing" }
  return { code: "producer-checkout", status: "mismatch" }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
