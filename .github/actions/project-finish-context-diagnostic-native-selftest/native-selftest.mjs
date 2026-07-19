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

export async function runRequiredNativeProjectFinishContextSelftest({ getIdToken } = {}) {
  const runnerTemp = canonicalRunnerTemp()
  const summaryDirectory = createDirectory(runnerTemp, OUTPUT_DIRECTORY)
  const summaryPath = join(summaryDirectory, SUMMARY_FILENAME)
  writeJson(summaryPath, fallbackSummary())

  const nativeCase = await runNativeProjectFinishContextSelftest({
    githubActionsCoreToken: await readCoreToken(getIdToken),
    sourceRoot: sourceRoot(),
  }).catch(() => ({
    id: "native-runner-context",
    status: "mismatch",
  }))
  if (nativeCase.status !== "match") {
    replaceJson(summaryPath, blockedSummary(nativeCase))
    throw new Error(FAILURE_CODE)
  }

  replaceJson(summaryPath, {
    artifactProducer: false,
    authorityEligible: false,
    cases: [nativeCase],
    diagnosticOnly: true,
    nativeRunnerOidc: {
      evidence: "collected",
      requirement: "required",
      status: "match",
    },
    outcome: "match",
    signing: false,
  })
}

async function readCoreToken(getIdToken) {
  if (typeof getIdToken !== "function") return undefined
  try {
    const token = await getIdToken()
    return typeof token === "string" && token.length > 0 && token.length <= 16 * 1024 && !/[\u0000\r\n]/u.test(token)
      ? token
      : undefined
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

function writeJson(path, value) {
  const descriptor = openSync(path, "wx", 0o600)
  try {
    const bytes = Buffer.from(`${JSON.stringify(value)}\n`, "utf8")
    writeSync(descriptor, bytes, 0, bytes.length, 0)
  } finally {
    closeSync(descriptor)
  }
}

function replaceJson(path, value) {
  const entry = lstatSync(path)
  if (!entry.isFile() || entry.isSymbolicLink() || realpathSync(path) !== path) throw new Error(FAILURE_CODE)
  const descriptor = openSync(path, "r+")
  try {
    const bytes = Buffer.from(`${JSON.stringify(value)}\n`, "utf8")
    ftruncateSync(descriptor, 0)
    writeSync(descriptor, bytes, 0, bytes.length, 0)
  } finally {
    closeSync(descriptor)
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
  return {
    artifactProducer: false,
    authorityEligible: false,
    cases: [nativeCase],
    diagnosticCodes: [
      "project-finish-producer-context-diagnostic-native-oidc-unavailable",
    ],
    diagnosticOnly: true,
    failure_stage: "native-oidc",
    nativeRunnerOidc: {
      evidence: "required",
      requirement: "required",
      status: "mismatch",
    },
    outcome: "blocked",
    signing: false,
  }
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
