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
const RUNTIME_SOURCES = [
  "diagnose-project-finish-producer-context.mjs",
  "project-finish-attestation-oidc.mjs",
  "project-finish-attestation-producer-context-diagnostic.mjs",
  "project-finish-attestation-producer-context.mjs",
  "verify-project-finish-producer-checkout.mjs",
]

function main() {
  const runnerTemp = canonicalRunnerTemp()
  const summaryDirectory = createDirectory(runnerTemp, OUTPUT_DIRECTORY)
  const summaryPath = join(summaryDirectory, SUMMARY_FILENAME)
  writeJson(summaryPath, fallbackSummary())
  const cases = [
    runCase("missing-evaluator", "missing"),
    runCase("runtime-error", "runtime-error"),
    runCase("oidc-blocked", "oidc-blocked"),
  ]
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

function runCase(id, kind) {
  const caseRoot = realpathSync(mkdtempSync(join(tmpdir(), `project-finish-context-selftest-${id}-`)))
  try {
    const checkout = join(caseRoot, "checkout")
    const diagnosticTemp = join(caseRoot, "runner-temp")
    mkdirSync(checkout, { recursive: true })
    mkdirSync(diagnosticTemp, { mode: 0o700 })
    createDiagnosticCheckout(checkout, kind)

    const fallback = runAction(fallbackEntrypoint(), {
      INPUT_DIAGNOSTIC_RUNNER_TEMP: diagnosticTemp,
    })
    const outputPath = join(caseRoot, "outputs")
    const diagnostic = runAction(join(checkout, ".github", "actions", "project-finish-context-diagnostic", "index.mjs"), {
      ...diagnosticEnvironment(diagnosticTemp),
      GITHUB_OUTPUT: outputPath,
    })
    const finalizer = runAction(finalizerEntrypoint(), {
      INPUT_DIAGNOSTIC_RUNNER_TEMP: diagnosticTemp,
      INPUT_DIAGNOSTIC_STEP_OUTCOME: diagnostic.status === 0 ? "success" : "failure",
      INPUT_DIAGNOSTIC_SUMMARY_STATUS: actionOutput(outputPath, "summary-status") ?? "",
    })
    const summary = readDiagnosticSummary(diagnosticTemp)
    const expectedStage = kind === "oidc-blocked" ? "context" : "fallback"
    const safe =
      fallback.status === 0 &&
      finalizer.status === 0 &&
      diagnostic.status === 1 &&
      isRecord(summary) &&
      summary.outcome === "blocked" &&
      summary.failure_stage === expectedStage &&
      !existsSync(join(checkout, "node_modules")) &&
      doesNotReflect(`${diagnostic.stdout}${diagnostic.stderr}${finalizer.stdout}${finalizer.stderr}${JSON.stringify(summary)}`)
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
  if (kind === "oidc-blocked") {
    for (const source of RUNTIME_SOURCES) {
      copyFileSync(join(sourceRoot(), "scripts", source), join(scriptsDirectory, source))
    }
  }
}

function diagnosticEnvironment(runnerTemp) {
  return {
    INPUT_DIAGNOSTIC_ACTIONS: "true",
    INPUT_DIAGNOSTIC_CALLER_WORKFLOW_REF:
      "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
    INPUT_DIAGNOSTIC_CALLER_WORKFLOW_SHA: "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8",
    INPUT_DIAGNOSTIC_EVENT_NAME: "push",
    INPUT_DIAGNOSTIC_PRODUCER_CHECKOUT: "match",
    INPUT_DIAGNOSTIC_PRODUCER_SHA: "3bef5f4696769fb11042e881387ff83045a542ef",
    INPUT_DIAGNOSTIC_REF: "refs/heads/main",
    INPUT_DIAGNOSTIC_REPOSITORY: "example/public-gradle-app",
    INPUT_DIAGNOSTIC_REPOSITORY_ID: "987654321",
    INPUT_DIAGNOSTIC_REPOSITORY_VISIBILITY: "public",
    INPUT_DIAGNOSTIC_REUSABLE_WORKFLOW_REF:
      "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
    INPUT_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA: "3bef5f4696769fb11042e881387ff83045a542ef",
    INPUT_DIAGNOSTIC_RUN_ATTEMPT: "1",
    INPUT_DIAGNOSTIC_RUN_ID: "1001",
    INPUT_DIAGNOSTIC_RUNNER_ENVIRONMENT: "github-hosted",
    INPUT_DIAGNOSTIC_RUNNER_OS: "Linux",
    INPUT_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
    INPUT_DIAGNOSTIC_SOURCE_HEAD: "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8",
    NODE_PATH: "",
    UNRELATED_SECRET: "PH_CONTEXT_DIAGNOSTIC_SELFTEST_SECRET",
  }
}

function runAction(path, environment) {
  return spawnSync(process.execPath, [path], {
    cwd: sourceRoot(),
    encoding: "utf8",
    env: environment,
  })
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

function doesNotReflect(value) {
  return !value.includes("PH_CONTEXT_DIAGNOSTIC_SELFTEST_SECRET") && !value.includes(sourceRoot())
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

function input(name) {
  const value = process.env[`INPUT_${name}`]
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

try {
  main()
} catch {
  process.stderr.write(`${FAILURE_CODE}\n`)
  process.exitCode = 1
}
