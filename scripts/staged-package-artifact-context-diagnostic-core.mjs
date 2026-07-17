import {
  STAGED_PACKAGE_ARTIFACT_REPOSITORY,
  STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID,
} from "./staged-package-artifact-attestation-core.mjs"

export const STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA = "staged-producer-context-diagnostic.1"
export const STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_WORKFLOW_PATH = ".github/workflows/staged-producer-context-diagnostic.yml"
export const STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_WORKFLOW_REF = `${STAGED_PACKAGE_ARTIFACT_REPOSITORY}/${STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_WORKFLOW_PATH}@refs/heads/main`

const CONTEXT_FIELDS = [
  ["github-actions", "githubActions", "true"],
  ["repository", "repository", STAGED_PACKAGE_ARTIFACT_REPOSITORY],
  ["repository-id", "repositoryId", String(STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID)],
  ["ref", "ref", "refs/heads/main"],
  ["event", "event", "workflow_dispatch"],
  ["workflow-ref", "workflowRef", STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_WORKFLOW_REF],
  ["runner-environment", "runnerEnvironment", "github-hosted"],
  ["runner-os", "runnerOs", "Linux"],
]

export function assessStagedProducerContextDiagnostic(value) {
  const context = isRecord(value) ? value : {}
  const fields = CONTEXT_FIELDS.map(([code, key, expected]) => ({
    code,
    status: statusFor(context[key], expected),
  }))
  const diagnosticCodes = fields
    .filter((field) => field.status !== "match")
    .map((field) => `staged-producer-context-${field.code}-${field.status}`)

  return {
    artifactCreated: false,
    authorityEligible: false,
    diagnosticCodes,
    diagnosticOnly: true,
    fields,
    networkAccess: false,
    outcome: diagnosticCodes.length === 0 ? "match" : "blocked",
    producerPredicateCreated: false,
    registryAccess: false,
    schemaVersion: STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA,
    signing: false,
  }
}

function statusFor(value, expected) {
  if (typeof value !== "string" || value.length === 0) return "missing"
  return value === expected ? "match" : "mismatch"
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
