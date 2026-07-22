import { createHash } from "node:crypto"
import { execFileSync, spawn } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { isAbsolute, join, normalize, relative, sep } from "node:path"
import { fileURLToPath } from "node:url"

import { captureSourceIdentity } from "./build-clean-ci-source-identity.mjs"

export const BUILDER_SCHEMA = "finish-attestation.1"
export const BUILDER_PREDICATE_TYPE = "https://github.com/jyt6640/persona-harness/attestations/finish-attestation.1"
export const COMMAND_CATALOG_ID = "persona-harness-clean-ci-builder.1"
export const FAILURE_DIAGNOSTIC_SCHEMA = "clean-ci-builder-failure.1"
export const CANONICAL_REPOSITORY = "jyt6640/persona-harness"
export const CANONICAL_REPOSITORY_ID = 1272008570
export const CANONICAL_WORKFLOW_PATH = ".github/workflows/canonical-clean-ci-attestation-builder.yml"
export const CANONICAL_WORKFLOW_REF = `${CANONICAL_REPOSITORY}/${CANONICAL_WORKFLOW_PATH}@refs/heads/main`
export const CANONICAL_RUNNER_LABEL = "ubuntu-latest"
const CANONICAL_RUNNER_ENVIRONMENT = "github-hosted"
const CANONICAL_RUNNER_OS = "Linux"
const COMMAND_TIMEOUT_MS = 300_000
const COMMAND_TERMINATION_GRACE_MS = 5_000
const COMMAND_MAX_STDOUT_BYTES = 1024 * 1024
const COMMAND_MAX_STDERR_BYTES = 1024 * 1024
const COMMAND_MAX_TOTAL_OUTPUT_BYTES = 1024 * 1024
const OUTPUT_DIRECTORY = ".ci/canonical-clean-ci-attestation-builder"
const TEST_REPORT_PATH = `${OUTPUT_DIRECTORY}/test-results.json`

export const FIXED_COMMANDS = [
  { id: "scope", executable: "npm", args: ["run", "check:scope:strict"] },
  { id: "docs", executable: "npm", args: ["run", "check:docs"] },
  { id: "release-workflow", executable: "npm", args: ["run", "check:release-workflows"] },
  { id: "injection", executable: "npm", args: ["run", "check:injection-value"] },
  { id: "typecheck", executable: "npm", args: ["run", "typecheck"] },
  {
    id: "tests",
    executable: "node",
    args: ["node_modules/vitest/vitest.mjs", "run", "--reporter=json", `--outputFile=${TEST_REPORT_PATH}`, "--testTimeout=15000"],
  },
  { id: "build", executable: "npm", args: ["run", "build"] },
  { id: "pack", executable: "npm", args: ["pack", "--dry-run", "--json"] },
]

async function main() {
  let context
  let outputDir
  try {
    context = readGitHubContext()
    outputDir = join(context.workspaceRoot, OUTPUT_DIRECTORY)
    mkdirSync(join(context.workspaceRoot, ".ci"), { recursive: true })
    mkdirSync(outputDir, { recursive: false })

    const commandResults = []
    for (const command of FIXED_COMMANDS) {
      commandResults.push(await runBoundedBuilderCommand(command, context.workspaceRoot))
    }
    const testReportPath = join(context.workspaceRoot, TEST_REPORT_PATH)
    const testReport = readJson(testReportPath)
    const testFacts = readTestFacts(testReport, testReportPath)
    const packFacts = readPackFacts(commandResults.find((result) => result.id === "pack")?.stdout ?? "")
    const packageJson = readJson(join(context.workspaceRoot, "package.json"))
    const receipt = createReceipt(context, commandResults, testFacts, packFacts, packageJson.version)
    const receiptBytes = Buffer.from(`${canonicalJson(receipt)}\n`)
    const predicate = {
      authorityEligible: true,
      authorityBoundary: "external-attested",
      predicateType: BUILDER_PREDICATE_TYPE,
      receiptDigest: `sha256:${sha256(receiptBytes)}`,
      receipt,
    }

    writeFileSync(join(outputDir, "receipt.json"), receiptBytes, { flag: "wx" })
    writeFileSync(join(outputDir, "predicate.json"), `${canonicalJson(predicate)}\n`, { flag: "wx" })
    process.stdout.write(`Clean CI builder receipt written to ${OUTPUT_DIRECTORY}\n`)
  } catch (error) {
    if (context !== undefined && outputDir !== undefined && error instanceof BuilderCommandFailure) {
      try {
        writeFailureDiagnostic(outputDir, error.details, join(context.workspaceRoot, TEST_REPORT_PATH), context.workspaceRoot)
      } catch {
        process.stderr.write("failed to persist builder failure diagnostic\n")
      }
    }

    const message = error instanceof Error ? error.message : "clean-CI builder failed"
    process.stderr.write(`${message}\n`)
    process.exitCode = 1
  }
}

function readGitHubContext() {
  if (process.env.GITHUB_ACTIONS !== "true") fail("clean-CI builder requires GitHub Actions")

  const workspaceRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const runnerContext = readCanonicalRunnerContext(process.env)
  const context = {
    repository: requiredEnv("GITHUB_REPOSITORY"),
    repositoryId: requiredEnv("GITHUB_REPOSITORY_ID"),
    ref: requiredEnv("GITHUB_REF"),
    event: requiredEnv("GITHUB_EVENT_NAME"),
    sourceHead,
    contextHead: requiredEnv("GITHUB_SHA"),
    workflowSha: requiredEnv("GITHUB_WORKFLOW_SHA"),
    workflowRef: requiredEnv("GITHUB_WORKFLOW_REF"),
    runId: requiredEnv("GITHUB_RUN_ID"),
    runAttempt: requiredEnv("GITHUB_RUN_ATTEMPT"),
    runnerEnvironment: runnerContext.environment,
    runnerLabel: runnerContext.label,
    runnerOs: runnerContext.os,
    workspaceRoot,
  }

  if (sourceHead !== context.contextHead) fail("checked out HEAD does not match GitHub SHA")
  if (workspaceRoot !== process.cwd()) fail("builder must run at the repository root")
  if (
    context.event !== "push"
    || context.ref !== "refs/heads/main"
    || context.repository !== CANONICAL_REPOSITORY
    || context.repositoryId !== String(CANONICAL_REPOSITORY_ID)
    || context.workflowRef !== CANONICAL_WORKFLOW_REF
    || context.runnerEnvironment !== CANONICAL_RUNNER_ENVIRONMENT
    || context.runnerLabel !== CANONICAL_RUNNER_LABEL
    || context.runnerOs !== CANONICAL_RUNNER_OS
  ) {
    fail("clean-CI builder requires the canonical protected-main GitHub context")
  }

  const cleanStatus = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    encoding: "buffer",
  })
  if (cleanStatus.byteLength !== 0) fail("clean-CI source status is not empty")

  return {
    ...context,
    cleanStatusDigest: `sha256:${sha256(cleanStatus)}`,
    sourceIdentity: captureSourceIdentity(workspaceRoot),
  }
}

export function readCanonicalRunnerContext(env = process.env) {
  const environment = requiredEnvFrom(env, "RUNNER_ENVIRONMENT")
  const os = requiredEnvFrom(env, "RUNNER_OS")
  if (environment !== CANONICAL_RUNNER_ENVIRONMENT || os !== CANONICAL_RUNNER_OS) {
    fail("clean-CI builder requires the canonical protected-main GitHub context")
  }
  return {
    environment,
    label: CANONICAL_RUNNER_LABEL,
    os,
  }
}

export function runBoundedBuilderCommand(command, workspaceRoot, options = {}) {
  const executable = command.executable === "node" ? process.execPath : command.executable
  const timeoutMs = positiveInteger(options.timeoutMs, COMMAND_TIMEOUT_MS)
  const graceMs = positiveInteger(options.graceMs, COMMAND_TERMINATION_GRACE_MS)

  return new Promise((resolve, reject) => {
    let child
    let closeSignal = null
    let closeStatus = null
    let directChildClosed = false
    let graceTimer
    let outputLimited = false
    let settled = false
    let terminationEscalated = false
    let terminationStarted = false
    let timeoutTimer
    let timedOut = false
    let totalOutputBytes = 0
    const stdout = createBoundedOutputCapture(COMMAND_MAX_STDOUT_BYTES)
    const stderr = createBoundedOutputCapture(COMMAND_MAX_STDERR_BYTES)

    const clearTimers = () => {
      clearTimeout(timeoutTimer)
      if (graceTimer !== undefined) clearTimeout(graceTimer)
    }
    const failCommand = (exitCode, exitState) => {
      reject(new BuilderCommandFailure({ commandId: command.id, exitCode, exitState }))
    }
    const complete = () => {
      if (settled || !directChildClosed || (terminationStarted && !terminationEscalated)) return
      settled = true
      clearTimers()
      const exitCode = typeof closeStatus === "number" ? closeStatus : signalExitCode(closeSignal)
      if (outputLimited) {
        failCommand(exitCode, "output-limit")
        return
      }
      if (timedOut) {
        failCommand(exitCode, "timeout")
        return
      }
      if (exitCode !== 0) {
        failCommand(exitCode, closeSignal === null ? "exit-nonzero" : "signal")
        return
      }

      resolve({
        id: command.id,
        argv: [command.executable, ...command.args],
        exitCode,
        stderrDigest: stderr.digest(),
        stdout: stdout.text(),
        stdoutDigest: stdout.digest(),
      })
    }
    const terminate = () => {
      if (terminationStarted || child === undefined) return
      terminationStarted = true
      terminateProcessTree(child.pid, "SIGTERM")
      graceTimer = setTimeout(() => {
        terminationEscalated = true
        graceTimer = undefined
        terminateProcessTree(child.pid, "SIGKILL")
        complete()
      }, graceMs)
    }
    const capture = (stream, chunk) => {
      if (settled || outputLimited) return
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      totalOutputBytes += bytes.byteLength
      const streamExceeded = stream.append(bytes)
      if (streamExceeded || totalOutputBytes > COMMAND_MAX_TOTAL_OUTPUT_BYTES) {
        outputLimited = true
        terminate()
      }
    }

    try {
      child = spawn(executable, command.args, {
        cwd: workspaceRoot,
        detached: process.platform !== "win32",
        env: process.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      })
    } catch {
      settled = true
      failCommand(null, "spawn-failure")
      return
    }

    timeoutTimer = setTimeout(() => {
      timedOut = true
      terminate()
    }, timeoutMs)
    child.stdout.on("data", (chunk) => capture(stdout, chunk))
    child.stderr.on("data", (chunk) => capture(stderr, chunk))
    child.on("error", () => {
      if (settled) return
      settled = true
      clearTimers()
      failCommand(null, "spawn-failure")
    })
    child.on("close", (status, signal) => {
      if (settled) return
      closeSignal = signal
      closeStatus = status
      directChildClosed = true
      complete()
    })
  })
}

function createReceipt(context, commandResults, testFacts, packFacts, phVersion) {
  const commandCatalog = FIXED_COMMANDS.map((command) => ({
    args: command.args,
    executable: command.executable,
    id: command.id,
  }))

  return {
    authorityBoundary: "external-attested",
    authorityEligible: true,
    command: {
      argvDigest: `sha256:${sha256(canonicalJson(commandCatalog))}`,
      catalogId: COMMAND_CATALOG_ID,
      commands: commandCatalog,
      results: commandResults.map(({ id, argv, exitCode, stderrDigest, stdoutDigest }) => ({
        argv,
        exitCode,
        id,
        stderrDigest,
        stdoutDigest,
      })),
    },
    event: context.event,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    finishId: `clean-ci-builder-finish-${context.runId}-${context.runAttempt}`,
    issuedAt: new Date().toISOString(),
    nonce: `clean-ci-builder-${context.runId}-${context.runAttempt}-${context.sourceHead}`,
    phVersion,
    predicateType: BUILDER_PREDICATE_TYPE,
    ref: context.ref,
    repository: context.repository,
    repositoryId: Number(context.repositoryId),
    replayState: "unconsumed",
    runAttempt: Number(context.runAttempt),
    runId: context.runId,
    schemaVersion: BUILDER_SCHEMA,
    sessionId: `clean-ci-builder-session-${context.runId}-${context.runAttempt}`,
    source: {
      clean: true,
      dirtyWorktreeDigest: context.cleanStatusDigest,
      head: context.sourceHead,
      identity: context.sourceIdentity,
    },
    test: testFacts,
    workflow: {
      path: CANONICAL_WORKFLOW_PATH,
      ref: context.workflowRef,
      sha: context.workflowSha,
    },
    runner: {
      environment: context.runnerEnvironment,
      label: context.runnerLabel,
      os: context.runnerOs,
    },
    attemptId: `clean-ci-builder-attempt-${context.runId}-${context.runAttempt}`,
    pack: packFacts,
  }
}

function readTestFacts(value, reportPath) {
  const total = numberField(value, "numTotalTests")
  const passed = numberField(value, "numPassedTests")
  const failed = numberField(value, "numFailedTests")
  const skipped = numberField(value, "numPendingTests") + numberField(value, "numTodoTests") + numberField(value, "numSkippedTests")
  if (total < 1 || passed < 1 || failed !== 0) {
    throw new BuilderCommandFailure({
      commandId: "tests",
      exitCode: 0,
      exitState: "invalid-test-report",
    })
  }

  return {
    artifactDigest: `sha256:${sha256(readFileSync(reportPath))}`,
    count: total,
    failed,
    identity: "vitest:repository",
    passed,
    skipped,
  }
}

function readPackFacts(stdout) {
  let parsed
  try {
    parsed = JSON.parse(stdout)
  } catch {
    fail("fixed package dry run did not produce JSON")
  }
  const entry = Array.isArray(parsed) ? parsed[0] : undefined
  if (entry === undefined || typeof entry !== "object" || entry === null) fail("fixed package dry run had no package entry")

  return {
    fileCount: Array.isArray(entry.files) ? entry.files.length : 0,
    name: typeof entry.name === "string" ? entry.name : "unknown",
    version: typeof entry.version === "string" ? entry.version : "unknown",
  }
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"))
  } catch {
    fail("required JSON output is unavailable")
  }
}

function numberField(value, field) {
  const candidate = value?.[field]
  return typeof candidate === "number" ? candidate : 0
}

function canonicalJson(value) {
  return JSON.stringify(sortKeys(value))
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortKeys(item)]))
  }
  return value
}

function requiredEnv(name) {
  return requiredEnvFrom(process.env, name)
}

function requiredEnvFrom(env, name) {
  const value = env[name]
  if (value === undefined || value.length === 0) fail(`missing GitHub context: ${name}`)
  return value
}

function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function createBoundedOutputCapture(limit) {
  const chunks = []
  const hash = createHash("sha256")
  let byteLength = 0

  return {
    append(chunk) {
      byteLength += chunk.byteLength
      if (byteLength > limit) return true
      hash.update(chunk)
      chunks.push(Buffer.from(chunk))
      return false
    },
    digest() {
      return `sha256:${hash.digest("hex")}`
    },
    text() {
      return Buffer.concat(chunks, byteLength).toString("utf8")
    },
  }
}

function terminateProcessTree(pid, signal) {
  if (pid === undefined) return
  try {
    if (process.platform === "win32") process.kill(pid, signal)
    else process.kill(-pid, signal)
  } catch {
    try {
      process.kill(pid, signal)
    } catch {}
  }
}

function signalExitCode(signal) {
  const signalCodes = {
    SIGABRT: 6,
    SIGBUS: 7,
    SIGFPE: 8,
    SIGHUP: 1,
    SIGILL: 4,
    SIGINT: 2,
    SIGKILL: 9,
    SIGPIPE: 13,
    SIGQUIT: 3,
    SIGSEGV: 11,
    SIGTERM: 15,
    SIGTRAP: 5,
    SIGUSR1: 10,
    SIGUSR2: 12,
  }
  return signal === null ? null : 128 + (signalCodes[signal] ?? 1)
}

function createFailureDiagnostic(failure, reportPath, workspaceRoot) {
  const report = readFailureReportSummary(reportPath, workspaceRoot)
  return {
    authorityBoundary: "builder-output-is-non-authoritative",
    authorityEligible: false,
    commandId: failure.commandId,
    diagnosticCodes: ["fixed-command-failed"],
    exitCode: failure.exitCode,
    exitState: failure.exitState,
    rawOutputIncluded: false,
    report,
    schemaVersion: FAILURE_DIAGNOSTIC_SCHEMA,
  }
}

export { createFailureDiagnostic }

function readFailureReportSummary(reportPath, workspaceRoot) {
  const report = {
    available: existsSync(reportPath),
    digest: null,
    failedTestFiles: [],
    path: TEST_REPORT_PATH,
    summary: null,
  }
  if (!report.available) return report

  let bytes
  try {
    bytes = readFileSync(reportPath)
  } catch {
    return report
  }

  report.digest = `sha256:${sha256(bytes)}`
  try {
    const parsed = JSON.parse(bytes.toString("utf8"))
    report.summary = {
      failed: numberField(parsed, "numFailedTests"),
      passed: numberField(parsed, "numPassedTests"),
      skipped: numberField(parsed, "numPendingTests") + numberField(parsed, "numTodoTests") + numberField(parsed, "numSkippedTests"),
      total: numberField(parsed, "numTotalTests"),
    }
    report.failedTestFiles = safeFailedTestFiles(parsed, workspaceRoot)
  } catch {
    return report
  }
  return report
}

function writeFailureDiagnostic(outputDir, failure, reportPath, workspaceRoot) {
  const diagnostic = createFailureDiagnostic(failure, reportPath, workspaceRoot)
  writeFileSync(join(outputDir, "failure-diagnostic.json"), `${canonicalJson(diagnostic)}\n`, { flag: "wx" })
}

function safeFailedTestFiles(report, workspaceRoot) {
  const testResults = Array.isArray(report?.testResults) ? report.testResults : []
  return [...new Set(testResults.flatMap((entry) => {
    if (!isRecord(entry) || !failedTestFile(entry)) return []
    const candidate = typeof entry.name === "string" ? entry.name : undefined
    const safePath = candidate === undefined ? undefined : safeTestFilePath(candidate, workspaceRoot)
    return safePath === undefined ? [] : [safePath]
  }))].sort()
}

function failedTestFile(entry) {
  if (entry.status === "failed" || numberField(entry, "numFailingTests") > 0) return true
  const assertions = Array.isArray(entry.assertionResults) ? entry.assertionResults : []
  return assertions.some((assertion) => isRecord(assertion) && assertion.status === "failed")
}

function safeTestFilePath(candidate, workspaceRoot) {
  if (candidate.length === 0 || candidate.includes("\u0000") || candidate.includes("\\")) return undefined
  if (candidate.split("/").some((segment) => segment === "..")) return undefined

  let repoRelative = candidate
  if (isAbsolute(candidate)) {
    repoRelative = relative(workspaceRoot, candidate)
    if (repoRelative.length === 0 || isAbsolute(repoRelative) || repoRelative === ".." || repoRelative.startsWith(`..${sep}`)) {
      return undefined
    }
  }

  const normalized = normalize(repoRelative)
  const displayPath = normalized.split(sep).join("/")
  if (displayPath === "tests" || !displayPath.startsWith("tests/")) return undefined
  if (!/^tests(?:\/[A-Za-z0-9._-]+)*\.(?:js|ts|mjs|mts|tsx)$/u.test(displayPath)) return undefined
  return displayPath
}

function isRecord(value) {
  return value !== null && typeof value === "object"
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

class BuilderCommandFailure extends Error {
  constructor(details) {
    super(`fixed command failed: ${details.commandId}`)
    this.name = "BuilderCommandFailure"
    this.details = details
  }
}

function fail(message) {
  throw new Error(message)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  void main()
}
