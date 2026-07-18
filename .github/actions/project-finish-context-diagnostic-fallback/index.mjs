import { closeSync, lstatSync, mkdirSync, openSync, realpathSync, writeSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"

const FAILURE_CODE = "project-finish-producer-context-diagnostic-fallback-failed"
const OUTPUT_DIRECTORY = "project-finish-attestation-context-diagnostic"
const SUMMARY_FILENAME = "summary.json"
const SUMMARY_SCHEMA = "project-finish-attestation-context-diagnostic-summary.1"

function main() {
  const summaryPath = createSummaryPath()
  const descriptor = openSync(summaryPath, "wx", 0o600)
  try {
    const bytes = Buffer.from(`${JSON.stringify(fallbackSummary())}\n`, "utf8")
    writeSync(descriptor, bytes, 0, bytes.length, 0)
  } finally {
    closeSync(descriptor)
  }
}

function createSummaryPath() {
  const root = canonicalRunnerTemp()
  const directory = join(root, OUTPUT_DIRECTORY)
  if (relative(root, directory) !== OUTPUT_DIRECTORY) throw new Error(FAILURE_CODE)
  mkdirSync(directory, { mode: 0o700 })
  const entry = lstatSync(directory)
  if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(directory) !== directory) {
    throw new Error(FAILURE_CODE)
  }
  return join(directory, SUMMARY_FILENAME)
}

function canonicalRunnerTemp() {
  const runnerTemp = actionInput("DIAGNOSTIC_RUNNER_TEMP")
  if (typeof runnerTemp !== "string" || !isAbsolute(runnerTemp) || runnerTemp !== resolve(runnerTemp)) {
    throw new Error(FAILURE_CODE)
  }
  const entry = lstatSync(runnerTemp)
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(FAILURE_CODE)
  const root = realpathSync(runnerTemp)
  if (root !== runnerTemp) throw new Error(FAILURE_CODE)
  return root
}

function actionInput(name) {
  const value = process.env[`INPUT_${name.replaceAll("_", "-")}`]
  return typeof value === "string" ? value : undefined
}

function fallbackSummary() {
  return {
    artifactProducer: false,
    authorityEligible: false,
    diagnostic_codes: ["project-finish-attestation-context-diagnostic-fallback-pending"],
    diagnosticOnly: true,
    diagnostic_status: "blocked",
    failure_stage: "fallback",
    fields: [{ code: "fallback", status: "missing" }],
    networkAccess: false,
    networkAccessScope: "none",
    oidcClaimRead: false,
    oidcRequestAttempted: false,
    outcome: "blocked",
    predicateCreated: false,
    receiptCreated: false,
    registryAccess: false,
    schemaVersion: SUMMARY_SCHEMA,
    signing: false,
  }
}

try {
  main()
} catch {
  process.stderr.write(`${FAILURE_CODE}\n`)
  process.exitCode = 1
}
