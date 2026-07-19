import {
  assessProjectFinishProducerContextDiagnosticWorkflow,
} from "./project-finish-attestation-producer-context.mjs"

export const PROJECT_FINISH_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA =
  "project-finish-attestation-producer-context-diagnostic.2"

export function assessProjectFinishProducerContextDiagnostic(value) {
  const input = isRecord(value) ? value : {}
  const claims = isRecord(input.claims) ? input.claims : undefined
  const environment = isRecord(input.environment) ? input.environment : {}
  const oidcEndpointStatus = statusForOidcEndpoint(input.oidcEndpointStatus, claims)
  const oidcTokenStatus = statusForOidcField(input.oidcTokenStatus, claims)
  const oidcAudienceStatus = statusForOidcField(input.oidcAudienceStatus, claims)
  const oidcRequestAttempted =
    typeof input.oidcRequestAttempted === "boolean" ? input.oidcRequestAttempted : claims !== undefined
  const core = assessProjectFinishProducerContextDiagnosticWorkflow(claims, environment)
  const fields = [
    statusForFixed("github-actions", environment.GITHUB_ACTIONS, "true"),
    {
      code: "oidc-endpoint",
      status: oidcEndpointStatus,
    },
    {
      code: "oidc-token",
      status: oidcTokenStatus,
    },
    {
      code: "oidc-audience",
      status: oidcAudienceStatus,
    },
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
    networkAccess: true,
    networkAccessScope: "github-actions-oidc-only",
    oidcClaimRead: claims !== undefined,
    oidcRequestAttempted,
    outcome: diagnosticCodes.length === 0 ? "match" : "blocked",
    predicateCreated: false,
    receiptCreated: false,
    registryAccess: false,
    schemaVersion: PROJECT_FINISH_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA,
    signing: false,
  }
}

function statusForOidcEndpoint(value, claims) {
  if (value === "match" || value === "mismatch" || value === "missing") return value
  return claims === undefined ? "missing" : "match"
}

function statusForOidcField(value, claims) {
  if (value === "match" || value === "mismatch" || value === "missing") return value
  return claims === undefined ? "missing" : "match"
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
