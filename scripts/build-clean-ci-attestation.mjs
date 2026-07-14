import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export const BUILDER_SCHEMA = "clean-ci-builder.1"
export const BUILDER_PREDICATE_TYPE = "https://github.com/jyt6640/persona-harness/attestations/clean-ci-builder.1"
export const COMMAND_CATALOG_ID = "persona-harness-clean-ci-builder.1"
const COMMAND_TIMEOUT_MS = 300_000
const OUTPUT_DIRECTORY = ".ci/canonical-clean-ci-attestation-builder"
const TEST_REPORT_PATH = `${OUTPUT_DIRECTORY}/test-results.json`

const FIXED_COMMANDS = [
  { id: "scope", executable: "npm", args: ["run", "check:scope:strict"] },
  { id: "docs", executable: "npm", args: ["run", "check:docs"] },
  { id: "release-workflow", executable: "npm", args: ["run", "check:release-workflows"] },
  { id: "injection", executable: "npm", args: ["run", "check:injection-value"] },
  { id: "typecheck", executable: "npm", args: ["run", "typecheck"] },
  {
    id: "tests",
    executable: "node",
    args: ["node_modules/vitest/vitest.mjs", "run", "--reporter=json", `--outputFile=${TEST_REPORT_PATH}`],
  },
  { id: "build", executable: "npm", args: ["run", "build"] },
  { id: "pack", executable: "npm", args: ["pack", "--dry-run", "--json"] },
]

function main() {
  const context = readGitHubContext()
  const outputDir = join(context.workspaceRoot, OUTPUT_DIRECTORY)
  mkdirSync(join(context.workspaceRoot, ".ci"), { recursive: true })
  mkdirSync(outputDir, { recursive: false })

  const commandResults = FIXED_COMMANDS.map((command) => runCommand(command, context.workspaceRoot))
  const testReport = readJson(join(context.workspaceRoot, TEST_REPORT_PATH))
  const testFacts = readTestFacts(testReport, join(context.workspaceRoot, TEST_REPORT_PATH))
  const packFacts = readPackFacts(commandResults.find((result) => result.id === "pack")?.stdout ?? "")
  const packageJson = readJson(join(context.workspaceRoot, "package.json"))
  const receipt = createReceipt(context, commandResults, testFacts, packFacts, packageJson.version)
  const receiptBytes = Buffer.from(`${canonicalJson(receipt)}\n`)
  const predicate = {
    authorityEligible: false,
    authorityBoundary: "builder-output-is-non-authoritative",
    predicateType: BUILDER_PREDICATE_TYPE,
    receiptDigest: `sha256:${sha256(receiptBytes)}`,
    receipt,
  }

  writeFileSync(join(outputDir, "receipt.json"), receiptBytes, { flag: "wx" })
  writeFileSync(join(outputDir, "predicate.json"), `${canonicalJson(predicate)}\n`, { flag: "wx" })
  process.stdout.write(`Clean CI builder receipt written to ${OUTPUT_DIRECTORY}\n`)
}

function readGitHubContext() {
  if (process.env.GITHUB_ACTIONS !== "true") fail("clean-CI builder requires GitHub Actions")

  const workspaceRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim()
  const sourceHead = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()
  const context = {
    repository: requiredEnv("GITHUB_REPOSITORY"),
    ref: requiredEnv("GITHUB_REF"),
    sourceHead,
    contextHead: requiredEnv("GITHUB_SHA"),
    workflowSha: requiredEnv("GITHUB_WORKFLOW_SHA"),
    workflowRef: requiredEnv("GITHUB_WORKFLOW_REF"),
    runId: requiredEnv("GITHUB_RUN_ID"),
    runAttempt: requiredEnv("GITHUB_RUN_ATTEMPT"),
    workspaceRoot,
  }

  if (sourceHead !== context.contextHead) fail("checked out HEAD does not match GitHub SHA")
  if (workspaceRoot !== process.cwd()) fail("builder must run at the repository root")

  const cleanStatus = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    encoding: "buffer",
  })
  if (cleanStatus.byteLength !== 0) fail("clean-CI source status is not empty")

  return {
    ...context,
    cleanStatusDigest: `sha256:${sha256(cleanStatus)}`,
  }
}

function runCommand(command, workspaceRoot) {
  const executable = command.executable === "node" ? process.execPath : command.executable
  const result = spawnSync(executable, command.args, {
    cwd: workspaceRoot,
    encoding: "utf8",
    env: process.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    timeout: COMMAND_TIMEOUT_MS,
  })

  if (result.error !== undefined || result.status !== 0) {
    fail(`fixed command failed: ${command.id}`)
  }

  return {
    id: command.id,
    argv: [command.executable, ...command.args],
    exitCode: result.status,
    stderrDigest: `sha256:${sha256(result.stderr ?? "")}`,
    stdout: result.stdout ?? "",
    stdoutDigest: `sha256:${sha256(result.stdout ?? "")}`,
  }
}

function createReceipt(context, commandResults, testFacts, packFacts, phVersion) {
  const builderStatus = context.ref === "refs/heads/main" ? "canonical-main-builder-candidate" : "staging-non-authoritative"
  const commandCatalog = FIXED_COMMANDS.map((command) => ({
    args: command.args,
    executable: command.executable,
    id: command.id,
  }))

  return {
    authorityBoundary: "builder-output-is-non-authoritative",
    authorityEligible: false,
    builderStatus,
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
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    finishId: `clean-ci-builder-finish-${context.runId}-${context.runAttempt}`,
    issuedAt: new Date().toISOString(),
    nonce: `clean-ci-builder-${context.runId}-${context.runAttempt}-${context.sourceHead}`,
    phVersion,
    predicateType: BUILDER_PREDICATE_TYPE,
    ref: context.ref,
    repository: context.repository,
    replayState: "unconsumed",
    runAttempt: Number(context.runAttempt),
    runId: context.runId,
    schemaVersion: BUILDER_SCHEMA,
    sessionId: `clean-ci-builder-session-${context.runId}-${context.runAttempt}`,
    source: {
      clean: true,
      dirtyWorktreeDigest: context.cleanStatusDigest,
      head: context.sourceHead,
    },
    test: testFacts,
    workflow: {
      jobWorkflowRef: context.workflowRef,
      workflowSha: context.workflowSha,
    },
    workspaceIdentity: {
      identityDigest: `sha256:${sha256(context.workspaceRoot)}`,
      kind: "github-hosted-runner",
    },
    attemptId: `clean-ci-builder-attempt-${context.runId}-${context.runAttempt}`,
    pack: packFacts,
  }
}

function readTestFacts(value, reportPath) {
  const total = numberField(value, "numTotalTests")
  const passed = numberField(value, "numPassedTests")
  const failed = numberField(value, "numFailedTests")
  if (total < 1 || passed !== total || failed !== 0) fail("fixed test command did not produce a nonzero passing test count")

  return {
    artifactDigest: `sha256:${sha256(readFileSync(reportPath))}`,
    count: total,
    failed,
    identity: "vitest:repository",
    passed,
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
    fail(`required JSON output is unavailable: ${path}`)
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
  const value = process.env[name]
  if (value === undefined || value.length === 0) fail(`missing GitHub context: ${name}`)
  return value
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

if (fileURLToPath(import.meta.url) === process.argv[1]) main()
