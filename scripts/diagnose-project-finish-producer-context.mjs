import { closeSync, ftruncateSync, lstatSync, mkdirSync, openSync, realpathSync, writeSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"
import { pathToFileURL } from "node:url"

import {
  assessProjectFinishProducerContextDiagnostic,
} from "./project-finish-attestation-producer-context-diagnostic.mjs"
import {
  readProjectFinishAttestationOidc,
  readProjectFinishAttestationOidcToken,
} from "./project-finish-attestation-oidc.mjs"
import {
  verifyProjectFinishProducerCheckout,
} from "./verify-project-finish-producer-checkout.mjs"

const OUTPUT_DIRECTORY = "project-finish-attestation-context-diagnostic"
const SUMMARY_FILENAME = "summary.json"
const FAILURE_CODE = "project-finish-producer-context-diagnostic-failed"

export async function runProjectFinishProducerContextDiagnostic(options = {}) {
  const environment = options.environment ?? process.env
  const producerCheckout = options.producerCheckout
  const producerRoot = options.producerRoot ?? process.cwd()
  const forwarded = readForwardedEnvironment(environment)
  const oidc = Object.hasOwn(options, "githubActionsCoreToken")
    ? readProjectFinishAttestationOidcToken(options.githubActionsCoreToken)
    : await readProjectFinishAttestationOidc(forwarded.oidc)
  const result = assessProjectFinishProducerContextDiagnostic({
    claims: oidc.claims,
    environment: forwarded.context,
    oidcAudienceStatus: oidc.audienceStatus,
    oidcEndpointStatus: oidc.endpointStatus,
    oidcRequestAttempted: oidc.requestAttempted,
    oidcTokenStatus: oidc.tokenStatus,
    producerCheckout: producerCheckoutStatus(producerRoot, forwarded.context.PERSONA_HARNESS_PRODUCER_SHA, producerCheckout),
  })
  return result
}

async function main() {
  const summary = createSummaryWriter(forwardedValue(process.env, "PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP"))
  try {
    const result = await runProjectFinishProducerContextDiagnostic()
    summary.write(result)
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (result.outcome !== "match") process.exitCode = 1
  } finally {
    summary.close()
  }
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
        forwardedValue(environment, "ACTIONS_ID_TOKEN_REQUEST_TOKEN"),
      ACTIONS_ID_TOKEN_REQUEST_URL:
        forwardedValue(environment, "ACTIONS_ID_TOKEN_REQUEST_URL"),
    },
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

function createSummaryWriter(runnerTemp) {
  if (typeof runnerTemp !== "string" || !isAbsolute(runnerTemp) || runnerTemp !== resolve(runnerTemp)) {
    throw new Error(FAILURE_CODE)
  }
  const rootEntry = lstatSync(runnerTemp)
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
    throw new Error(FAILURE_CODE)
  }
  const root = realpathSync(runnerTemp)
  if (root !== runnerTemp) throw new Error(FAILURE_CODE)
  const output = join(root, OUTPUT_DIRECTORY)
  if (relative(root, output) !== OUTPUT_DIRECTORY) {
    throw new Error(FAILURE_CODE)
  }
  mkdirSync(output, { mode: 0o700 })
  const outputEntry = lstatSync(output)
  if (!outputEntry.isDirectory() || outputEntry.isSymbolicLink()) {
    throw new Error(FAILURE_CODE)
  }
  const descriptor = openSync(join(output, SUMMARY_FILENAME), "wx", 0o600)
  return {
    write(summary) {
      const bytes = Buffer.from(`${JSON.stringify(summary)}\n`, "utf8")
      ftruncateSync(descriptor, 0)
      writeSync(descriptor, bytes, 0, bytes.length, 0)
    },
    close() {
      closeSync(descriptor)
    },
  }
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main().catch(() => {
    process.stderr.write(`${FAILURE_CODE}\n`)
    process.exitCode = 1
  })
}
