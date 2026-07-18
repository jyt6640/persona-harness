import { mkdirSync, realpathSync, writeFileSync } from "node:fs"
import { isAbsolute, join, relative } from "node:path"
import { pathToFileURL } from "node:url"

import {
  assessProjectFinishProducerContextDiagnostic,
} from "./project-finish-attestation-producer-context-diagnostic.mjs"
import {
  readProjectFinishAttestationOidc,
} from "./project-finish-attestation-oidc.mjs"
import {
  verifyProjectFinishProducerCheckout,
} from "./verify-project-finish-producer-checkout.mjs"

const OUTPUT_DIRECTORY = ".ci/project-finish-attestation-context-diagnostic"
const FAILURE_CODE = "project-finish-producer-context-diagnostic-failed"

export async function runProjectFinishProducerContextDiagnostic({
  environment = process.env,
  producerCheckout,
  producerRoot = process.cwd(),
} = {}) {
  const forwarded = readForwardedEnvironment(environment)
  const workspace = workspaceRoot(forwarded.workspace)
  const oidc = await readProjectFinishAttestationOidc(forwarded.oidc)
  const result = assessProjectFinishProducerContextDiagnostic({
    claims: oidc.claims,
    environment: forwarded.context,
    oidcEndpointStatus: oidc.endpointStatus,
    oidcRequestAttempted: oidc.requestAttempted,
    producerCheckout: producerCheckoutStatus(producerRoot, forwarded.context.PERSONA_HARNESS_PRODUCER_SHA, producerCheckout),
  })
  writeSummary(workspace, result)
  return result
}

async function main() {
  const result = await runProjectFinishProducerContextDiagnostic()
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (result.outcome !== "match") process.exitCode = 1
}

function producerCheckoutStatus(producerRoot, producerSha, observedStatus) {
  if (observedStatus === "match" || observedStatus === "missing" || observedStatus === "mismatch") {
    return observedStatus
  }
  if (typeof producerSha !== "string" || producerSha.length === 0) return "missing"
  return verifyProjectFinishProducerCheckout(producerRoot, producerSha).kind === "verified"
    ? "match"
    : "mismatch"
}

function readForwardedEnvironment(environment) {
  return {
    context: {
      GITHUB_ACTIONS: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_ACTIONS"),
      GITHUB_EVENT_NAME: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME"),
      GITHUB_REF: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_REF"),
      GITHUB_REPOSITORY: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY"),
      GITHUB_REPOSITORY_ID: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID"),
      GITHUB_REPOSITORY_VISIBILITY: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY"),
      GITHUB_RUN_ATTEMPT: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT"),
      GITHUB_RUN_ID: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_RUN_ID"),
      GITHUB_SHA: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD"),
      GITHUB_WORKFLOW_REF: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF"),
      GITHUB_WORKFLOW_SHA: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA"),
      PERSONA_HARNESS_DIAGNOSTIC_WORKFLOW_REF:
        forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF"),
      PERSONA_HARNESS_DIAGNOSTIC_WORKFLOW_SHA:
        forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA"),
      PERSONA_HARNESS_PRODUCER_SHA: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA"),
      RUNNER_ENVIRONMENT: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT"),
      RUNNER_OS: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS"),
    },
    oidc: {
      ACTIONS_ID_TOKEN_REQUEST_TOKEN:
        forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN"),
      ACTIONS_ID_TOKEN_REQUEST_URL:
        forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL"),
    },
    workspace: forwardedValue(environment, "PROJECT_FINISH_DIAGNOSTIC_WORKSPACE"),
  }
}

function forwardedValue(environment, key) {
  if (typeof environment !== "object" || environment === null || Array.isArray(environment)) {
    return undefined
  }
  const value = environment[key]
  return typeof value === "string" && value.length > 0 && value.length <= 512 && !/[\u0000\r\n]/u.test(value)
    ? value
    : undefined
}

function workspaceRoot(workspace) {
  if (typeof workspace !== "string" || !isAbsolute(workspace)) {
    throw new Error("project-finish-producer-context-diagnostic-workspace")
  }
  const root = realpathSync(workspace)
  if (relative(root, workspace) !== "") {
    throw new Error("project-finish-producer-context-diagnostic-workspace")
  }
  return root
}

function writeSummary(workspace, result) {
  const output = join(workspace, OUTPUT_DIRECTORY)
  if (relative(workspace, output).startsWith("..")) {
    throw new Error("project-finish-producer-context-diagnostic-workspace")
  }
  mkdirSync(output, { recursive: true, mode: 0o700 })
  writeFileSync(join(output, "summary.json"), `${JSON.stringify(result)}\n`, { flag: "w", mode: 0o600 })
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(() => {
    process.stderr.write(`${FAILURE_CODE}\n`)
    process.exitCode = 1
  })
}
