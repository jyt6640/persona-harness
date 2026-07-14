import { createHash } from "node:crypto"
import { execFileSync, spawnSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const repository = required("GITHUB_REPOSITORY")
const ref = required("GITHUB_REF")
const sourceHead = required("GITHUB_SHA")
const workflowSha = required("GITHUB_WORKFLOW_SHA")
const runId = required("GITHUB_RUN_ID")
const runAttempt = required("GITHUB_RUN_ATTEMPT")
const workflow = ".github/workflows/clean-ci-finish-attestation.yml"
const outputDir = join(process.cwd(), ".ci", "finish-attestation")
const testReportPath = join(outputDir, "test-results.json")
const command = [
  process.execPath,
  "node_modules/vitest/vitest.mjs",
  "run",
  "--reporter=json",
  "--outputFile=.ci/finish-attestation/test-results.json",
]

if (process.env.GITHUB_ACTIONS !== "true") fail("clean-CI attestation issuer requires GitHub Actions")
const cleanStatus = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], { encoding: "buffer" })
if (cleanStatus.byteLength !== 0) fail("clean-CI source status is not empty")

mkdirSync(outputDir, { recursive: true })
const result = spawnSync(command[0], command.slice(1), {
  cwd: process.cwd(),
  encoding: "utf8",
  shell: false,
  stdio: ["ignore", "pipe", "pipe"],
  timeout: 120_000,
})
if (result.status !== 0 || result.error !== undefined) fail("fixed clean-CI test command failed")

const report = JSON.parse(readFileSync(testReportPath, "utf8"))
const testCount = typeof report.numTotalTests === "number" ? report.numTotalTests : 0
const failedCount = typeof report.numFailedTests === "number" ? report.numFailedTests : 1
if (testCount < 1 || failedCount !== 0) fail("fixed clean-CI test command did not produce a nonzero passing test count")

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"))
const receipt = {
  schemaVersion: "finish-attestation.1",
  sourceMode: "clean-ci",
  repository,
  ref,
  workflow,
  workflowRef: `${repository}/${workflow}@${ref}`,
  workflowSha,
  runId,
  runAttempt: Number(runAttempt),
  sourceHead,
  dirtyWorktreeDigest: `sha256:${sha256(cleanStatus)}`,
  workspaceIdentity: {
    kind: "github-hosted-runner",
    runnerEnvironment: "github-hosted",
    identity: `github-actions-run-${runId}-${runAttempt}`,
  },
  command: {
    catalogId: "persona-harness-clean-ci.1",
    argv: command,
    argvDigest: `sha256:${sha256(Buffer.from(JSON.stringify(command)))}`,
  },
  phVersion: packageJson.version,
  attemptId: `clean-ci-attempt-${runId}-${runAttempt}`,
  sessionId: `clean-ci-session-${runId}-${runAttempt}`,
  finishId: `clean-ci-finish-${runId}-${runAttempt}`,
  artifactDigests: [{ name: "vitest-json-report", digest: `sha256:${sha256(readFileSync(testReportPath))}` }],
  test: { identity: "vitest:repository", count: testCount, passed: true },
  result: { status: "pass", testCount },
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  nonce: `clean-ci-${runId}-${runAttempt}-${sourceHead}`,
  replayState: "unconsumed",
}
const receiptBytes = Buffer.from(`${JSON.stringify(receipt, null, 2)}\n`)
const predicate = {
  schemaVersion: "finish-attestation.1",
  receipt,
  receiptDigest: `sha256:${sha256(receiptBytes)}`,
  replayNonce: receipt.nonce,
  replayState: receipt.replayState,
}
writeFileSync(join(outputDir, "receipt.json"), receiptBytes, { flag: "wx" })
writeFileSync(join(outputDir, "predicate.json"), `${JSON.stringify(predicate, null, 2)}\n`, { flag: "wx" })

function required(name) {
  const value = process.env[name]
  if (value === undefined || value.length === 0) fail(`missing GitHub context ${name}`)
  return value
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}
