const {
  closeSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  writeSync,
} = require("node:fs")
const { isAbsolute, join, relative, resolve } = require("node:path")

const CONTEXT_DIRECTORY = "project-finish-attestation-context-diagnostic"
const CONTEXT_SCHEMA = "project-finish-attestation-context-diagnostic-summary.1"
const NATIVE_DIRECTORY = "project-finish-context-diagnostic-selftest"
const SUMMARY_FILENAME = "summary.json"

function createContextBridgeSummaryWriter(runnerTemp) {
  return createSummaryWriter(runnerTemp, CONTEXT_DIRECTORY, true)
}

function createNativeBridgeSummaryWriter(runnerTemp) {
  return createSummaryWriter(runnerTemp, NATIVE_DIRECTORY, false)
}

function contextBridgeFailure(stage) {
  const value = stage === "capability"
    ? {
      code: "project-finish-producer-context-diagnostic-oidc-capability-unavailable",
      field: "oidc-capability",
      failureStage: "oidc-capability",
    }
    : {
      code: "project-finish-producer-context-diagnostic-bridge-invocation-unavailable",
      field: "bridge",
      failureStage: "bridge",
    }
  return {
    artifactProducer: false,
    authorityEligible: false,
    diagnosticOnly: true,
    diagnostic_codes: [value.code],
    diagnostic_status: "blocked",
    failure_stage: value.failureStage,
    fields: [{ code: value.field, status: "missing" }],
    networkAccess: false,
    networkAccessScope: "none",
    oidcClaimRead: false,
    oidcRequestAttempted: false,
    outcome: "blocked",
    predicateCreated: false,
    receiptCreated: false,
    registryAccess: false,
    schemaVersion: CONTEXT_SCHEMA,
    signing: false,
  }
}

function nativeBridgeFailure(stage) {
  const code = stage === "capability"
    ? "project-finish-producer-context-diagnostic-native-oidc-capability-unavailable"
    : "project-finish-producer-context-diagnostic-native-bridge-invocation-unavailable"
  return {
    artifactProducer: false,
    authorityEligible: false,
    cases: [{ id: "native-runner-context", stage, status: "mismatch" }],
    diagnosticCodes: [code],
    diagnosticOnly: true,
    failure_stage: "native-oidc",
    nativeRunnerOidc: {
      evidence: "required",
      requirement: "required",
      stage,
      status: "mismatch",
    },
    outcome: "blocked",
    signing: false,
  }
}

function nativeFallbackSummary() {
  return {
    artifactProducer: false,
    authorityEligible: false,
    cases: [],
    diagnosticOnly: true,
    failure_stage: "bootstrap",
    outcome: "blocked",
    signing: false,
  }
}

function createSummaryWriter(runnerTemp, outputDirectory, requireExisting) {
  const root = canonicalRunnerTemp(runnerTemp)
  const directory = summaryDirectory(root, outputDirectory, !requireExisting)
  const path = join(directory, SUMMARY_FILENAME)
  const descriptor = requireExisting ? openExisting(path) : openNew(path)
  let closed = false

  return {
    replace(summary) {
      if (closed) throw new Error("project-finish-producer-context-diagnostic-summary-closed")
      const bytes = Buffer.from(`${JSON.stringify(summary)}\n`, "utf8")
      ftruncateSync(descriptor, 0)
      writeSync(descriptor, bytes, 0, bytes.length, 0)
    },
    close() {
      if (closed) return
      closed = true
      closeSync(descriptor)
    },
  }
}

function canonicalRunnerTemp(runnerTemp) {
  if (
    typeof runnerTemp !== "string" ||
    runnerTemp.length === 0 ||
    runnerTemp.length > 1_024 ||
    /[\u0000\r\n]/u.test(runnerTemp) ||
    !isAbsolute(runnerTemp) ||
    runnerTemp !== resolve(runnerTemp)
  ) {
    throw new Error("project-finish-producer-context-diagnostic-summary-root")
  }
  const entry = lstatSync(runnerTemp)
  if (!entry.isDirectory() || entry.isSymbolicLink()) {
    throw new Error("project-finish-producer-context-diagnostic-summary-root")
  }
  const root = realpathSync(runnerTemp)
  if (root !== runnerTemp) throw new Error("project-finish-producer-context-diagnostic-summary-root")
  return root
}

function summaryDirectory(root, name, create) {
  const directory = join(root, name)
  if (relative(root, directory) !== name) {
    throw new Error("project-finish-producer-context-diagnostic-summary-directory")
  }
  if (create) {
    mkdirSync(directory, { mode: 0o700 })
  }
  const entry = lstatSync(directory)
  if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(directory) !== directory) {
    throw new Error("project-finish-producer-context-diagnostic-summary-directory")
  }
  return directory
}

function openExisting(path) {
  const entry = lstatSync(path)
  if (!entry.isFile() || entry.isSymbolicLink() || realpathSync(path) !== path) {
    throw new Error("project-finish-producer-context-diagnostic-summary-file")
  }
  return openSync(path, "r+")
}

function openNew(path) {
  return openSync(path, "wx", 0o600)
}

module.exports = {
  contextBridgeFailure,
  createContextBridgeSummaryWriter,
  createNativeBridgeSummaryWriter,
  nativeBridgeFailure,
  nativeFallbackSummary,
}
