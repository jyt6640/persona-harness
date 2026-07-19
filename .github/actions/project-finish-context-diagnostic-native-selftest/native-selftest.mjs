import {
  closeSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  openSync,
  realpathSync,
  writeSync,
} from "node:fs"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { runNativeProjectFinishContextSelftest } from "../project-finish-context-diagnostic-selftest/native.mjs"

const FAILURE_CODE = "project-finish-producer-context-diagnostic-selftest-failed"
const OUTPUT_DIRECTORY = "project-finish-context-diagnostic-selftest"
const SUMMARY_FILENAME = "summary.json"
const CONTEXT_CODES = new Set([
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
])

export async function runRequiredNativeProjectFinishContextSelftest(options = {}) {
  const { getIdToken } = options
  const ownsWriter = options.summaryWriter === undefined
  const summaryWriter = options.summaryWriter ?? createSummaryWriter(canonicalRunnerTemp())
  try {
    summaryWriter.replace(fallbackSummary())
    const token = Object.hasOwn(options, "githubActionsCoreToken")
      ? boundedToken(options.githubActionsCoreToken)
      : await readCoreToken(getIdToken)
    const nativeCase = token === undefined
      ? nativeCaseFor("capability")
      : await runNativeProjectFinishContextSelftest({
        githubActionsCoreToken: token,
        sourceRoot: sourceRoot(),
      })
    const summary = nativeCase.status === "match"
      ? matchedSummary(nativeCase)
      : blockedSummary(nativeCase)
    summaryWriter.replace(summary)
    return summary
  } finally {
    if (ownsWriter) summaryWriter.close()
  }
}

async function readCoreToken(getIdToken) {
  if (typeof getIdToken !== "function") return undefined
  try {
    return boundedToken(await getIdToken())
  } catch {
    return undefined
  }
}

function canonicalRunnerTemp() {
  const runnerTemp = privateEnvironment("PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP")
  if (runnerTemp === undefined || !isAbsolute(runnerTemp) || runnerTemp !== resolve(runnerTemp)) {
    throw new Error(FAILURE_CODE)
  }
  const entry = lstatSync(runnerTemp)
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error(FAILURE_CODE)
  const root = realpathSync(runnerTemp)
  if (root !== runnerTemp) throw new Error(FAILURE_CODE)
  return root
}

function createDirectory(root, name) {
  const directory = join(root, name)
  if (relative(root, directory) !== name) throw new Error(FAILURE_CODE)
  mkdirSync(directory, { mode: 0o700 })
  const entry = lstatSync(directory)
  if (!entry.isDirectory() || entry.isSymbolicLink() || realpathSync(directory) !== directory) {
    throw new Error(FAILURE_CODE)
  }
  return directory
}

function createSummaryWriter(root) {
  const summaryDirectory = createDirectory(root, OUTPUT_DIRECTORY)
  const summaryPath = join(summaryDirectory, SUMMARY_FILENAME)
  const descriptor = openSync(summaryPath, "wx", 0o600)
  let closed = false
  return {
    replace(value) {
      if (closed) throw new Error(FAILURE_CODE)
      const bytes = Buffer.from(`${JSON.stringify(value)}\n`, "utf8")
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

function fallbackSummary() {
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

function blockedSummary(nativeCase) {
  const stage = nativeStage(nativeCase)
  const diagnosticCodes = stage === "context"
    ? nativeContextCodes(nativeCase).map(
      (code) => `project-finish-producer-context-diagnostic-native-context-${code}-blocked`,
    )
    : [{
    bridge: "project-finish-producer-context-diagnostic-native-bridge-invocation-unavailable",
    capability: "project-finish-producer-context-diagnostic-native-oidc-capability-unavailable",
    validation: "project-finish-producer-context-diagnostic-native-oidc-validation-blocked",
  }[stage]]
  return {
    artifactProducer: false,
    authorityEligible: false,
    cases: [nativeCase],
    diagnosticCodes,
    diagnosticOnly: true,
    failure_stage: "native-oidc",
    nativeRunnerOidc: {
      evidence: "required",
      requirement: "required",
      stage,
      status: "mismatch",
      ...(stage === "context" ? { contextCodes: nativeContextCodes(nativeCase) } : {}),
    },
    outcome: "blocked",
    signing: false,
  }
}

function nativeContextCodes(value) {
  const codes = Array.isArray(value?.contextCodes)
    ? value.contextCodes.filter((code) => typeof code === "string" && CONTEXT_CODES.has(code))
    : []
  return codes.length > 0 ? codes : ["unknown"]
}

function matchedSummary(nativeCase) {
  return {
    artifactProducer: false,
    authorityEligible: false,
    cases: [nativeCase],
    diagnosticOnly: true,
    nativeRunnerOidc: {
      evidence: "collected",
      requirement: "required",
      stage: "match",
      status: "match",
    },
    outcome: "match",
    signing: false,
  }
}

function nativeCaseFor(stage) {
  return {
    id: "native-runner-context",
    stage,
    status: "mismatch",
  }
}

function nativeStage(value) {
  return value?.stage === "bridge" ||
    value?.stage === "capability" ||
    value?.stage === "context" ||
    value?.stage === "validation"
    ? value.stage
    : "bridge"
}

function boundedToken(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 16 * 1024 && !/[\u0000\r\n]/u.test(value)
    ? value
    : undefined
}

function privateEnvironment(name) {
  const value = process.env[name]
  return typeof value === "string" && value.length > 0 && value.length <= 1_024 && !/[\u0000\r\n]/u.test(value)
    ? value
    : undefined
}

function sourceRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
}
