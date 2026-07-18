import { closeSync, ftruncateSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeSync } from "node:fs"
import { isAbsolute, join, relative, resolve } from "node:path"

const FAILURE_CODE = "project-finish-producer-context-diagnostic-finalizer-failed"
const OUTPUT_DIRECTORY = "project-finish-attestation-context-diagnostic"
const SUMMARY_FILENAME = "summary.json"
const SUMMARY_SCHEMA = "project-finish-attestation-context-diagnostic-summary.1"
const SAFE_CODE = /^[a-z0-9][a-z0-9.-]{0,159}$/u
const FIELD_STATUS = new Set(["match", "mismatch", "missing"])

function main() {
  const root = canonicalRunnerTemp()
  const stepOutcome = boundedInput("DIAGNOSTIC_STEP_OUTCOME")
  const summaryStatus = boundedInput("DIAGNOSTIC_SUMMARY_STATUS")
  const existing = readSummary(root)
  const preserved = canPreserve(existing, stepOutcome, summaryStatus)
  const summary = preserved ? existing : fallbackSummary("finalizer")
  if (!preserved) writeSummary(root, summary)
  const outcome =
    summary.outcome === "match" && stepOutcome === "success" && summaryStatus === "match"
      ? "match"
      : "blocked"
  writeOutput("outcome", outcome)
}

function canPreserve(summary, stepOutcome, summaryStatus) {
  if (!isSafeSummary(summary)) return false
  if (summary.outcome === "match") return stepOutcome === "success" && summaryStatus === "match"
  if (summaryStatus === "blocked") return true
  return summary.failure_stage === "fallback" && summaryStatus === undefined
}

function readSummary(root) {
  const path = summaryPath(root)
  try {
    const entry = lstatSync(path)
    if (!entry.isFile() || entry.isSymbolicLink() || realpathSync(path) !== path || entry.size > 16 * 1024) {
      return undefined
    }
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return undefined
  }
}

function writeSummary(root, summary) {
  const directory = summaryDirectory(root, true)
  const path = join(directory, SUMMARY_FILENAME)
  let descriptor
  try {
    const entry = lstatSync(path)
    if (!entry.isFile() || entry.isSymbolicLink() || realpathSync(path) !== path) throw new Error(FAILURE_CODE)
    descriptor = openSync(path, "r+")
  } catch (error) {
    if (error instanceof Error && error.code !== "ENOENT") throw error
    descriptor = openSync(path, "wx", 0o600)
  }
  try {
    const bytes = Buffer.from(`${JSON.stringify(summary)}\n`, "utf8")
    ftruncateSync(descriptor, 0)
    writeSync(descriptor, bytes, 0, bytes.length, 0)
  } finally {
    closeSync(descriptor)
  }
}

function summaryPath(root) {
  return join(summaryDirectory(root, false), SUMMARY_FILENAME)
}

function summaryDirectory(root, create) {
  const directory = join(root, OUTPUT_DIRECTORY)
  if (relative(root, directory) !== OUTPUT_DIRECTORY) throw new Error(FAILURE_CODE)
  if (create) {
    try {
      mkdirSync(directory, { mode: 0o700 })
    } catch (error) {
      if (!(error instanceof Error) || error.code !== "EEXIST") throw error
    }
  }
  const entry = lstatSync(directory)
  if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(directory) !== directory) {
    throw new Error(FAILURE_CODE)
  }
  return directory
}

function canonicalRunnerTemp() {
  const runnerTemp = boundedInput("DIAGNOSTIC_RUNNER_TEMP")
  if (runnerTemp === undefined || !isAbsolute(runnerTemp) || runnerTemp !== resolve(runnerTemp)) {
    throw new Error(FAILURE_CODE)
  }
  const entry = lstatSync(runnerTemp)
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(FAILURE_CODE)
  const root = realpathSync(runnerTemp)
  if (root !== runnerTemp) throw new Error(FAILURE_CODE)
  return root
}

function isSafeSummary(value) {
  if (!isRecord(value)) return false
  if (
    value.schemaVersion !== SUMMARY_SCHEMA ||
    (value.outcome !== "match" && value.outcome !== "blocked") ||
    value.diagnostic_status !== value.outcome ||
    typeof value.failure_stage !== "string" ||
    !SAFE_CODE.test(value.failure_stage)
  ) {
    return false
  }
  for (const key of [
    "artifactProducer",
    "authorityEligible",
    "predicateCreated",
    "receiptCreated",
    "registryAccess",
    "signing",
  ]) {
    if (value[key] !== false) return false
  }
  if (value.diagnosticOnly !== true) return false
  if (typeof value.networkAccess !== "boolean") return false
  if (value.networkAccessScope !== "none" && value.networkAccessScope !== "github-actions-oidc-only") return false
  if (typeof value.oidcClaimRead !== "boolean" || typeof value.oidcRequestAttempted !== "boolean") return false
  if (!Array.isArray(value.diagnostic_codes) || !value.diagnostic_codes.every((code) => typeof code === "string" && SAFE_CODE.test(code))) {
    return false
  }
  return Array.isArray(value.fields) && value.fields.every((field) =>
    isRecord(field) &&
    typeof field.code === "string" &&
    SAFE_CODE.test(field.code) &&
    typeof field.status === "string" &&
    FIELD_STATUS.has(field.status),
  )
}

function fallbackSummary(stage) {
  return {
    artifactProducer: false,
    authorityEligible: false,
    diagnostic_codes: ["project-finish-attestation-context-diagnostic-finalizer-blocked"],
    diagnosticOnly: true,
    diagnostic_status: "blocked",
    failure_stage: stage,
    fields: [{ code: stage, status: "missing" }],
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

function writeOutput(name, value) {
  const path = process.env.GITHUB_OUTPUT
  if (typeof path !== "string" || path.length === 0 || path.length > 1_024 || /[\u0000\r\n]/u.test(path)) return
  try {
    const descriptor = openSync(path, "a", 0o600)
    try {
      writeSync(descriptor, `${name}=${value}\n`)
    } finally {
      closeSync(descriptor)
    }
  } catch {
    // GitHub output is optional for local test execution; the summary is authoritative for this workflow.
  }
}

function boundedInput(name) {
  const value = process.env[`INPUT_${name}`]
  return typeof value === "string" && value.length > 0 && value.length <= 1_024 && !/[\u0000\r\n]/u.test(value)
    ? value
    : undefined
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

try {
  main()
} catch {
  process.stderr.write(`${FAILURE_CODE}\n`)
  process.exitCode = 1
}
