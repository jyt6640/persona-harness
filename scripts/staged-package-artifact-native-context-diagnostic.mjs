import {
  STAGED_PACKAGE_ARTIFACT_CONTEXT_REQUIREMENTS,
} from "./staged-package-artifact-attestation-core.mjs"

export const STAGED_PACKAGE_ARTIFACT_NATIVE_CONTEXT_DIAGNOSTIC_SCHEMA = "staged-producer-native-context-diagnostic.1"

const GITHUB_ACTIONS_REQUIREMENT = {
  code: "github-actions",
  expected: "true",
  key: "githubActions",
}

export function assessNativeStagedProducerContext(value) {
  const context = isRecord(value) ? value : {}
  const fields = [
    statusForRequirement(context, GITHUB_ACTIONS_REQUIREMENT),
    ...STAGED_PACKAGE_ARTIFACT_CONTEXT_REQUIREMENTS.map((requirement) => statusForRequirement(context, requirement)),
    {
      code: "workflow-sha-equality",
      status: workflowShaStatus(context.workflowSha, context.contextHead),
    },
  ]
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
    schemaVersion: STAGED_PACKAGE_ARTIFACT_NATIVE_CONTEXT_DIAGNOSTIC_SCHEMA,
    signing: false,
  }
}

function statusForRequirement(context, requirement) {
  const value = context[requirement.key]
  if (typeof value !== "string" || value.length === 0) {
    return { code: requirement.code, status: "missing" }
  }
  return {
    code: requirement.code,
    status: value === requirement.expected ? "match" : "mismatch",
  }
}

function workflowShaStatus(workflowSha, contextHead) {
  if (typeof workflowSha !== "string" || workflowSha.length === 0 || typeof contextHead !== "string" || contextHead.length === 0) {
    return "missing"
  }
  if (!isSha(workflowSha) || !isSha(contextHead)) return "invalid"
  return workflowSha === contextHead ? "match" : "mismatch"
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function isSha(value) {
  return typeof value === "string" && /^[0-9a-f]{40}$/u.test(value)
}
