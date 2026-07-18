import { closeSync, ftruncateSync, lstatSync, openSync, realpathSync, writeSync } from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const FAILURE_CODE = "project-finish-producer-context-diagnostic-failed"
const OUTPUT_DIRECTORY = "project-finish-attestation-context-diagnostic"
const SUMMARY_FILENAME = "summary.json"
const SUMMARY_SCHEMA = "project-finish-attestation-context-diagnostic-summary.1"
const SUMMARY_CODES = {
  bootstrap: "project-finish-attestation-context-diagnostic-bootstrap-pending",
  runtime: "project-finish-attestation-context-diagnostic-runtime-unavailable",
  runtimeLoad: "project-finish-attestation-context-diagnostic-runtime-load-unavailable",
}
const FIELD_STATUS = new Set(["match", "mismatch", "missing"])
const SAFE_CODE = /^[a-z0-9][a-z0-9.-]{0,159}$/u

const PRIVATE_ENVIRONMENT_KEYS = [
  "PROJECT_FINISH_DIAGNOSTIC_ACTIONS",
  "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF",
  "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA",
  "PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME",
  "PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN",
  "PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL",
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

async function main() {
  assertFallbackSummary()
  const environment = forwardedEnvironment()
  const producerCheckout = producerCheckoutStatus()
  const producerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
  let runner
  try {
    ({ runProjectFinishProducerContextDiagnostic: runner } =
      await import("../../../scripts/diagnose-project-finish-producer-context.mjs"))
  } catch {
    finish(failureSummary("runtime-load"))
    return
  }
  try {
    const result = await runner({
      environment,
      producerCheckout,
      producerRoot,
    })
    const summary = resultSummary(result)
    replaceFallbackSummary(summary)
    writeActionOutput("summary-status", summary.outcome)
    finish(summary)
  } catch {
    finish(failureSummary("runtime"))
  }
}

function forwardedEnvironment() {
  const environment = {}
  for (const name of PRIVATE_ENVIRONMENT_KEYS) {
    environment[name] = privateEnvironment(name)
  }
  return environment
}

function privateEnvironment(name) {
  const value = process.env[name]
  return typeof value === "string" ? value : undefined
}

function producerCheckoutStatus() {
  const value = privateEnvironment("PROJECT_FINISH_DIAGNOSTIC_PRODUCER_CHECKOUT")
  return value === "match" || value === "missing" ? value : "mismatch"
}

function replaceFallbackSummary(summary) {
  const path = fallbackSummaryPath()
  const descriptor = openSync(path, "r+")
  try {
    const bytes = Buffer.from(`${JSON.stringify(summary)}\n`, "utf8")
    ftruncateSync(descriptor, 0)
    writeSync(descriptor, bytes, 0, bytes.length, 0)
  } finally {
    closeSync(descriptor)
  }
}

function assertFallbackSummary() {
  fallbackSummaryPath()
}

function fallbackSummaryPath() {
  const runnerTemp = privateEnvironment("PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP")
  if (typeof runnerTemp !== "string" || !isAbsolute(runnerTemp) || runnerTemp !== resolve(runnerTemp)) {
    throw new Error(FAILURE_CODE)
  }
  const rootEntry = lstatSync(runnerTemp)
  if (!rootEntry.isDirectory() || rootEntry.isSymbolicLink()) {
    throw new Error(FAILURE_CODE)
  }
  const root = realpathSync(runnerTemp)
  if (root !== runnerTemp) throw new Error(FAILURE_CODE)
  const directory = join(root, OUTPUT_DIRECTORY)
  if (relative(root, directory) !== OUTPUT_DIRECTORY) {
    throw new Error(FAILURE_CODE)
  }
  const directoryEntry = lstatSync(directory)
  if (!directoryEntry.isDirectory() || directoryEntry.isSymbolicLink() || realpathSync(directory) !== directory) {
    throw new Error(FAILURE_CODE)
  }
  const path = join(directory, SUMMARY_FILENAME)
  const fileEntry = lstatSync(path)
  if (!fileEntry.isFile() || fileEntry.isSymbolicLink() || realpathSync(path) !== path) {
    throw new Error(FAILURE_CODE)
  }
  return path
}

function writeActionOutput(name, value) {
  const output = privateEnvironment("GITHUB_OUTPUT")
  if (output === undefined || output.length > 1_024 || /[\u0000\r\n]/u.test(output)) return
  try {
    const descriptor = openSync(output, "a", 0o600)
    try {
      writeSync(descriptor, `${name}=${value}\n`)
    } finally {
      closeSync(descriptor)
    }
  } catch {
    // The workflow finalizer verifies the bounded summary even when outputs are unavailable.
  }
}

function finish(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`)
  if (result.outcome !== "match") process.exitCode = 1
}

function resultSummary(result) {
  const input = isRecord(result) ? result : {}
  const outcome = input.outcome === "match" ? "match" : "blocked"
  return {
    ...baseSummary(outcome, "context"),
    diagnostic_codes: safeCodes(input.diagnosticCodes),
    fields: safeFields(input.fields),
    networkAccess: input.networkAccess === true,
    networkAccessScope: input.networkAccess === true ? "github-actions-oidc-only" : "none",
    oidcClaimRead: input.oidcClaimRead === true,
    oidcRequestAttempted: input.oidcRequestAttempted === true,
  }
}

function failureSummary(stage) {
  const code = stage === "runtime-load"
    ? SUMMARY_CODES.runtimeLoad
    : stage === "runtime"
      ? SUMMARY_CODES.runtime
      : SUMMARY_CODES.bootstrap
  return {
    ...baseSummary("blocked", stage),
    diagnostic_codes: [code],
    fields: [{ code: stage, status: "missing" }],
    networkAccess: false,
    networkAccessScope: "none",
    oidcClaimRead: false,
    oidcRequestAttempted: false,
  }
}

function baseSummary(outcome, failureStage) {
  return {
    artifactProducer: false,
    authorityEligible: false,
    diagnosticOnly: true,
    diagnostic_status: outcome,
    failure_stage: failureStage,
    outcome,
    predicateCreated: false,
    receiptCreated: false,
    registryAccess: false,
    schemaVersion: SUMMARY_SCHEMA,
    signing: false,
  }
}

function safeCodes(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((code) => typeof code === "string" && SAFE_CODE.test(code)))].slice(0, 32)
}

function safeFields(value) {
  if (!Array.isArray(value)) return []
  const fields = []
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.code !== "string" || !SAFE_CODE.test(candidate.code)) continue
    if (typeof candidate.status !== "string" || !FIELD_STATUS.has(candidate.status)) continue
    if (fields.some((field) => field.code === candidate.code)) continue
    fields.push({ code: candidate.code, status: candidate.status })
    if (fields.length === 32) break
  }
  return fields
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

await main().catch(() => {
  process.stdout.write(`${JSON.stringify(failureSummary("bootstrap"))}\n`)
  process.exitCode = 1
})
