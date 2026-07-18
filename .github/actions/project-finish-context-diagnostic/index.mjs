import { runProjectFinishProducerContextDiagnostic } from "../../../scripts/diagnose-project-finish-producer-context.mjs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const FAILURE_CODE = "project-finish-producer-context-diagnostic-failed"

const INPUTS = [
  ["DIAGNOSTIC_ACTIONS", "PROJECT_FINISH_DIAGNOSTIC_ACTIONS"],
  ["DIAGNOSTIC_CALLER_WORKFLOW_REF", "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF"],
  ["DIAGNOSTIC_CALLER_WORKFLOW_SHA", "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA"],
  ["DIAGNOSTIC_EVENT_NAME", "PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME"],
  ["DIAGNOSTIC_PRODUCER_SHA", "PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA"],
  ["DIAGNOSTIC_REF", "PROJECT_FINISH_DIAGNOSTIC_REF"],
  ["DIAGNOSTIC_REPOSITORY", "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY"],
  ["DIAGNOSTIC_REPOSITORY_ID", "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID"],
  ["DIAGNOSTIC_REPOSITORY_VISIBILITY", "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY"],
  ["DIAGNOSTIC_REUSABLE_WORKFLOW_REF", "PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF"],
  ["DIAGNOSTIC_REUSABLE_WORKFLOW_SHA", "PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA"],
  ["DIAGNOSTIC_RUN_ATTEMPT", "PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT"],
  ["DIAGNOSTIC_RUN_ID", "PROJECT_FINISH_DIAGNOSTIC_RUN_ID"],
  ["DIAGNOSTIC_RUNNER_ENVIRONMENT", "PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT"],
  ["DIAGNOSTIC_RUNNER_OS", "PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS"],
  ["DIAGNOSTIC_SOURCE_HEAD", "PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD"],
  ["DIAGNOSTIC_WORKSPACE", "PROJECT_FINISH_DIAGNOSTIC_WORKSPACE"],
]

async function main() {
  const result = await runProjectFinishProducerContextDiagnostic({
    environment: forwardedEnvironment(),
    producerCheckout: producerCheckoutStatus(),
    producerRoot: resolve(dirname(fileURLToPath(import.meta.url)), "../../.."),
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (result.outcome !== "match") process.exitCode = 1
}

function forwardedEnvironment() {
  const environment = {}
  for (const [inputName, alias] of INPUTS) {
    environment[alias] = actionInput(inputName)
  }
  environment.PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN =
    platformEnvironment("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
  environment.PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL =
    platformEnvironment("ACTIONS_ID_TOKEN_REQUEST_URL")
  return environment
}

function actionInput(name) {
  return platformEnvironment(`INPUT_${name}`)
}

function platformEnvironment(name) {
  const value = process.env[name]
  return typeof value === "string" ? value : undefined
}

function producerCheckoutStatus() {
  const value = actionInput("DIAGNOSTIC_PRODUCER_CHECKOUT")
  return value === "match" || value === "missing" ? value : "mismatch"
}

await main().catch(() => {
  process.stderr.write(`${FAILURE_CODE}\n`)
  process.exitCode = 1
})
