import { join } from "node:path"
import { pathToFileURL } from "node:url"

const PRIVATE_CONTEXT_KEYS = [
  "PROJECT_FINISH_DIAGNOSTIC_ACTIONS",
  "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF",
  "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA",
  "PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME",
  "PROJECT_FINISH_DIAGNOSTIC_PRODUCER_CHECKOUT",
  "PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA",
  "PROJECT_FINISH_DIAGNOSTIC_REF",
  "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY",
  "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID",
  "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY",
  "PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF",
  "PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA",
  "PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT",
  "PROJECT_FINISH_DIAGNOSTIC_RUN_ID",
  "PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT",
  "PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS",
  "PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP",
  "PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD",
]
const CONTEXT_CODES = [
  "github-actions",
  "event",
  "ref",
  "repository",
  "repository-id",
  "repository-visibility",
  "caller-workflow-sha",
  "caller-workflow-ref",
  "producer-pin",
  "reusable-workflow-ref",
  "reusable-workflow-sha",
  "run-id",
  "run-attempt",
  "runner-environment",
  "runner-environment-env",
  "runner-os",
  "source-head",
  "producer-checkout",
]

export async function runNativeProjectFinishContextSelftest({ githubActionsCoreToken, sourceRoot }) {
  const environment = nativeEnvironment()
  if (githubActionsCoreToken === undefined) {
    return nativeCase("capability")
  }
  try {
    const module = await import(
      pathToFileURL(join(sourceRoot, "scripts", "diagnose-project-finish-producer-context.mjs")).href,
    )
    const result = await module.runProjectFinishProducerContextDiagnostic({
      environment,
      githubActionsCoreToken,
      producerCheckout: environment.PROJECT_FINISH_DIAGNOSTIC_PRODUCER_CHECKOUT,
      producerRoot: sourceRoot,
    })
    if (allContextStatusesMatch(result)) {
      return {
        id: "native-runner-context",
        stage: "match",
        status: "match",
      }
    }
    const contextCodes = contextCodesForDiagnostic(result)
    return contextCodes.length === 0 && hasOidcValidationFailure(result)
      ? nativeCase("validation")
      : nativeCase("context", contextCodes)
  } catch {
    return nativeCase("bridge")
  }
}

function nativeEnvironment() {
  const environment = {}
  for (const name of PRIVATE_CONTEXT_KEYS) {
    environment[name] = process.env[name]
  }
  return environment
}

function allContextStatusesMatch(value) {
  if (!isRecord(value) || value.outcome !== "match") return false
  if (!Array.isArray(value.diagnosticCodes) || value.diagnosticCodes.length !== 0) return false
  if (!Array.isArray(value.fields) || value.fields.length === 0) return false
  return value.fields.every((field) => isRecord(field) && field.status === "match")
}

function contextCodesForDiagnostic(value) {
  if (!isRecord(value) || !Array.isArray(value.fields)) return []
  const fields = value.fields.filter((field) => isRecord(field))
  if (
    fields.some((field) =>
      (field.code === "oidc-audience" || field.code === "oidc-claims" || field.code === "oidc-token") &&
      field.status !== "match",
    )
  ) {
    return []
  }
  return CONTEXT_CODES.filter((code) =>
    fields.some((field) => field.code === code && field.status !== "match"),
  )
}

function hasOidcValidationFailure(value) {
  if (!isRecord(value) || !Array.isArray(value.fields)) return false
  return value.fields.some((field) =>
    isRecord(field) &&
    (field.code === "oidc-audience" || field.code === "oidc-claims" || field.code === "oidc-token") &&
    field.status !== "match",
  )
}

function nativeCase(stage, contextCodes = []) {
  return stage === "context"
    ? {
      contextCodes,
      id: "native-runner-context",
      stage,
      status: "mismatch",
    }
    : {
    id: "native-runner-context",
    stage,
    status: "mismatch",
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
