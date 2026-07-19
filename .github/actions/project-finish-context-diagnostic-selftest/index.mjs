import { spawnSync } from "node:child_process"
import {
  closeSync,
  copyFileSync,
  existsSync,
  ftruncateSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const FAILURE_CODE = "project-finish-producer-context-diagnostic-selftest-failed"
const OUTPUT_DIRECTORY = "project-finish-context-diagnostic-selftest"
const SUMMARY_FILENAME = "summary.json"
const DIAGNOSTIC_DIRECTORY = "project-finish-attestation-context-diagnostic"
const SELFTEST_SECRET = "PH_CONTEXT_DIAGNOSTIC_SELFTEST_SECRET"
const RUNTIME_SOURCES = [
  "diagnose-project-finish-producer-context.mjs",
  "project-finish-attestation-oidc.mjs",
  "project-finish-attestation-producer-context-diagnostic.mjs",
  "project-finish-attestation-producer-context.mjs",
  "verify-project-finish-producer-checkout.mjs",
]

async function main() {
  const runnerTemp = canonicalRunnerTemp()
  const summaryDirectory = createDirectory(runnerTemp, OUTPUT_DIRECTORY)
  const summaryPath = join(summaryDirectory, SUMMARY_FILENAME)
  writeJson(summaryPath, fallbackSummary())
  const cases = [
    runCase("canonical-context", "canonical-context"),
    runCase("missing-evaluator", "missing"),
    runCase("runtime-error", "runtime-error"),
    runCase("oidc-blocked", "oidc-blocked"),
  ]
  const nativeCase = await runNativeRunnerCase()
  if (nativeCase !== undefined) cases.push(nativeCase)
  if (cases.some(({ status }) => status !== "match")) throw new Error(FAILURE_CODE)
  replaceJson(summaryPath, {
    artifactProducer: false,
    authorityEligible: false,
    cases,
    diagnosticOnly: true,
    outcome: "match",
    signing: false,
  })
}

async function runNativeRunnerCase() {
  try {
    const { runNativeProjectFinishContextSelftest } =
      await import("./native.mjs")
    return await runNativeProjectFinishContextSelftest({
      sourceRoot: sourceRoot(),
    })
  } catch {
    return {
      id: "native-runner-context",
      status: "mismatch",
    }
  }
}

function runCase(id, kind) {
  const caseRoot = realpathSync(mkdtempSync(join(tmpdir(), `project-finish-context-selftest-${id}-`)))
  try {
    const checkout = join(caseRoot, "checkout")
    const diagnosticTemp = join(caseRoot, "runner-temp")
    mkdirSync(checkout, { recursive: true })
    mkdirSync(diagnosticTemp, { mode: 0o700 })
    createDiagnosticCheckout(checkout, kind)

    const fallback = runInputAction(fallbackEntrypoint(), {
      INPUT_DIAGNOSTIC_RUNNER_TEMP: diagnosticTemp,
    })
    const outputPath = join(caseRoot, "outputs")
    const oidcToken = kind === "canonical-context"
      ? `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
      : undefined
    const hookPath = join(caseRoot, "oidc-hook.mjs")
    if (oidcToken !== undefined) writeFileSyncSafe(hookPath, oidcHook(oidcToken))
    const diagnostic = runAction(
      join(checkout, ".github", "actions", "project-finish-context-diagnostic", "index.mjs"),
      {
        ...diagnosticEnvironment(diagnosticTemp),
        INPUT_DIAGNOSTIC_EVENT_NAME: `hostile-${SELFTEST_SECRET}`,
        INPUT_DIAGNOSTIC_RUNNER_TEMP: `hostile-${SELFTEST_SECRET}`,
        PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN: `hostile-${SELFTEST_SECRET}`,
        PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL: `https://untrusted.example/${SELFTEST_SECRET}`,
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: oidcToken === undefined ? `ambient-${SELFTEST_SECRET}` : SELFTEST_SECRET,
        ACTIONS_ID_TOKEN_REQUEST_URL: oidcToken === undefined
          ? `https://untrusted.example/${SELFTEST_SECRET}`
          : "https://pipelines.actions.githubusercontent.com/oidc?api-version=7.1&serviceConnectionId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        GITHUB_OUTPUT: outputPath,
      },
      oidcToken === undefined ? [] : ["--import", hookPath],
    )
    const finalizer = runInputAction(finalizerEntrypoint(), {
      INPUT_DIAGNOSTIC_RUNNER_TEMP: diagnosticTemp,
      INPUT_DIAGNOSTIC_STEP_OUTCOME: diagnostic.status === 0 ? "success" : "failure",
      INPUT_DIAGNOSTIC_SUMMARY_STATUS: actionOutput(outputPath, "summary-status") ?? "",
    })
    const summary = readDiagnosticSummary(diagnosticTemp)
    const expectsMatch = kind === "canonical-context"
    const expectedStage = kind === "oidc-blocked" || expectsMatch ? "context" : "fallback"
    const safe =
      fallback.status === 0 &&
      finalizer.status === 0 &&
      diagnostic.status === (expectsMatch ? 0 : 1) &&
      isRecord(summary) &&
      summary.outcome === (expectsMatch ? "match" : "blocked") &&
      summary.failure_stage === expectedStage &&
      (!expectsMatch || hasOnlyMatchingFields(summary)) &&
      !existsSync(join(checkout, "node_modules")) &&
      doesNotReflect(`${diagnostic.stdout}${diagnostic.stderr}${finalizer.stdout}${finalizer.stderr}${JSON.stringify(summary)}`, oidcToken)
    return { id, status: safe ? "match" : "mismatch" }
  } finally {
    rmSync(caseRoot, { force: true, recursive: true })
  }
}

function createDiagnosticCheckout(checkout, kind) {
  const actionDirectory = join(checkout, ".github", "actions", "project-finish-context-diagnostic")
  const scriptsDirectory = join(checkout, "scripts")
  mkdirSync(actionDirectory, { recursive: true })
  mkdirSync(scriptsDirectory, { recursive: true })
  copyFileSync(diagnosticEntrypoint(), join(actionDirectory, "index.mjs"))
  if (kind === "runtime-error") {
    writeFileSyncSafe(
      join(scriptsDirectory, "diagnose-project-finish-producer-context.mjs"),
      'export async function runProjectFinishProducerContextDiagnostic() { throw new Error("runtime") }\n',
    )
    return
  }
  if (kind === "oidc-blocked" || kind === "canonical-context") {
    for (const source of RUNTIME_SOURCES) {
      copyFileSync(join(sourceRoot(), "scripts", source), join(scriptsDirectory, source))
    }
  }
}

function diagnosticEnvironment(runnerTemp) {
  return {
    PROJECT_FINISH_DIAGNOSTIC_ACTIONS: "true",
    PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF:
      "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
    PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA: "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8",
    PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME: "push",
    PROJECT_FINISH_DIAGNOSTIC_PRODUCER_CHECKOUT: "match",
    PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA: "3bef5f4696769fb11042e881387ff83045a542ef",
    PROJECT_FINISH_DIAGNOSTIC_REF: "refs/heads/main",
    PROJECT_FINISH_DIAGNOSTIC_REPOSITORY: "example/public-gradle-app",
    PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID: "987654321",
    PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY: "public",
    PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF:
      "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
    PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA: "3bef5f4696769fb11042e881387ff83045a542ef",
    PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT: "1",
    PROJECT_FINISH_DIAGNOSTIC_RUN_ID: "1001",
    PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT: "github-hosted",
    PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS: "Linux",
    PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
    PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD: "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8",
    NODE_PATH: "",
    UNRELATED_SECRET: SELFTEST_SECRET,
  }
}

function runAction(path, environment, nodeArguments = []) {
  return spawnSync(process.execPath, [...nodeArguments, path], {
    cwd: sourceRoot(),
    encoding: "utf8",
    env: environment,
  })
}

function runInputAction(path, environment) {
  return runAction(path, githubActionEnvironment(environment))
}

function githubActionEnvironment(environment) {
  return Object.fromEntries(
    Object.entries(environment).map(([name, value]) => [
      name.startsWith("INPUT_")
        ? `INPUT_${name.slice("INPUT_".length).replaceAll("_", "-")}`
        : name,
      value,
    ]),
  )
}

function actionOutput(path, name) {
  if (!existsSync(path)) return undefined
  const prefix = `${name}=`
  const line = readFileSync(path, "utf8").split(/\r?\n/u).find((candidate) => candidate.startsWith(prefix))
  return line?.slice(prefix.length)
}

function readDiagnosticSummary(runnerTemp) {
  const path = join(runnerTemp, DIAGNOSTIC_DIRECTORY, SUMMARY_FILENAME)
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    return undefined
  }
}

function canonicalRunnerTemp() {
  const runnerTemp = input("DIAGNOSTIC_RUNNER_TEMP")
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

function writeFileSyncSafe(path, value) {
  const descriptor = openSync(path, "wx", 0o600)
  try {
    const bytes = Buffer.from(value, "utf8")
    writeSync(descriptor, bytes, 0, bytes.length, 0)
  } finally {
    closeSync(descriptor)
  }
}

function hasOnlyMatchingFields(summary) {
  return Array.isArray(summary.diagnostic_codes) &&
    summary.diagnostic_codes.length === 0 &&
    Array.isArray(summary.fields) &&
    summary.fields.length > 0 &&
    summary.fields.every((field) => isRecord(field) && field.status === "match")
}

function doesNotReflect(value, token) {
  return !value.includes(SELFTEST_SECRET) &&
    !value.includes(sourceRoot()) &&
    (token === undefined || !value.includes(token))
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

function claims() {
  return {
    event_name: "push",
    job_workflow_ref: "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
    job_workflow_sha: "3bef5f4696769fb11042e881387ff83045a542ef",
    ref: "refs/heads/main",
    repository: "example/public-gradle-app",
    repository_id: "987654321",
    repository_visibility: "public",
    run_attempt: "1",
    run_id: "1001",
    runner_environment: "github-hosted",
    workflow_ref: "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
    workflow_sha: "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8",
  }
}

function oidcHook(token) {
  return `import { createRequire, syncBuiltinESMExports } from "node:module"
import { EventEmitter } from "node:events"

const require = createRequire(import.meta.url)
const https = require("node:https")

https.get = (_url, _options, callback) => {
  const request = new EventEmitter()
  request.setTimeout = () => request
  request.destroy = () => request
  queueMicrotask(() => {
    const response = new EventEmitter()
    response.headers = {}
    response.resume = () => undefined
    response.statusCode = 200
    callback(response)
    response.emit("data", Buffer.from(JSON.stringify({ value: ${JSON.stringify(token)} })))
    response.emit("end")
  })
  return request
}

syncBuiltinESMExports()
`
}

function input(name) {
  const value = process.env[`INPUT_${name.replaceAll("_", "-")}`]
  return typeof value === "string" && value.length > 0 && value.length <= 1_024 && !/[\u0000\r\n]/u.test(value)
    ? value
    : undefined
}

function sourceRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), "../../..")
}

function diagnosticEntrypoint() {
  return join(sourceRoot(), ".github", "actions", "project-finish-context-diagnostic", "index.mjs")
}

function fallbackEntrypoint() {
  return join(sourceRoot(), ".github", "actions", "project-finish-context-diagnostic-fallback", "index.mjs")
}

function finalizerEntrypoint() {
  return join(sourceRoot(), ".github", "actions", "project-finish-context-diagnostic-finalizer", "index.mjs")
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

await main().catch(() => {
  process.stderr.write(`${FAILURE_CODE}\n`)
  process.exitCode = 1
})
