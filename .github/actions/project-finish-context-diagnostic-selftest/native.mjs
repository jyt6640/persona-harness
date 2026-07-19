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

export async function runNativeProjectFinishContextSelftest({ sourceRoot }) {
  const environment = nativeEnvironment()
  if (
    environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN === undefined
    || environment.ACTIONS_ID_TOKEN_REQUEST_URL === undefined
  ) {
    return {
      id: "native-runner-context",
      status: "mismatch",
    }
  }
  const module = await import(
    pathToFileURL(join(sourceRoot, "scripts", "diagnose-project-finish-producer-context.mjs")).href,
  )
  const result = await module.runProjectFinishProducerContextDiagnostic({
    environment,
    producerCheckout: environment.PROJECT_FINISH_DIAGNOSTIC_PRODUCER_CHECKOUT,
    producerRoot: sourceRoot,
  })
  return {
    id: "native-runner-context",
    status: allContextStatusesMatch(result) ? "match" : "mismatch",
  }
}

function nativeEnvironment() {
  const environment = {}
  for (const name of PRIVATE_CONTEXT_KEYS) {
    environment[name] = process.env[name]
  }
  return {
    ...environment,
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,
    ACTIONS_ID_TOKEN_REQUEST_URL: process.env.ACTIONS_ID_TOKEN_REQUEST_URL,
  }
}

function allContextStatusesMatch(value) {
  if (!isRecord(value) || value.outcome !== "match") return false
  if (!Array.isArray(value.diagnosticCodes) || value.diagnosticCodes.length !== 0) return false
  if (!Array.isArray(value.fields) || value.fields.length === 0) return false
  return value.fields.every((field) => isRecord(field) && field.status === "match")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
