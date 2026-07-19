import { execFileSync, spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const actionPath = join(root, ".github", "actions", "project-finish-context-diagnostic", "index.mjs")
const fallbackActionPath = join(root, ".github", "actions", "project-finish-context-diagnostic-fallback", "index.mjs")
const finalizerActionPath = join(root, ".github", "actions", "project-finish-context-diagnostic-finalizer", "index.mjs")
const outcomeActionPath = join(root, ".github", "actions", "project-finish-context-diagnostic-outcome", "index.mjs")
const selftestActionPath = join(root, ".github", "actions", "project-finish-context-diagnostic-selftest", "index.mjs")
const selftestCorePath = join(root, ".github", "actions", "project-finish-context-diagnostic-selftest", "selftest.mjs")
const nativeSelftestActionPath = join(root, ".github", "actions", "project-finish-context-diagnostic-native-selftest", "index.mjs")
const nativeSelftestCorePath = join(root, ".github", "actions", "project-finish-context-diagnostic-native-selftest", "native-selftest.mjs")
const nativeSelftestMetadataPath = join(root, ".github", "actions", "project-finish-context-diagnostic-native-selftest", "action.yml")
const oidcCapabilityBridgePath = join(root, ".github", "actions", "project-finish-context-diagnostic", "oidc-capability-bridge.cjs")
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish-context-diagnostic.yml")
const selftestWorkflowPath = join(root, ".github", "workflows", "project-finish-context-diagnostic-selftest.yml")
const outputDirectory = "project-finish-attestation-context-diagnostic"
const summaryName = "summary.json"
const callerSha = "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8"
const producerSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
const secret = "PH_NATIVE_OIDC_SELFTEST_SECRET_sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
const runtimeSources = [
  "diagnose-project-finish-producer-context.mjs",
  "project-finish-attestation-oidc.mjs",
  "project-finish-attestation-producer-context-diagnostic.mjs",
  "project-finish-attestation-producer-context.mjs",
  "verify-project-finish-producer-checkout.mjs",
] as const

describe("project finish context diagnostic workflow fallback", () => {
  it("reads GitHub's hyphenated local-action input name before creating the fallback", () => {
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-fallback-temp-")))
    try {
      const fallback = run(fallbackActionPath, {
        "INPUT_DIAGNOSTIC-RUNNER-TEMP": runnerTemp,
      })

      expect(fallback.status).toBe(0)
      expect(readSummary(runnerTemp)).toMatchObject({
        failure_stage: "fallback",
        outcome: "blocked",
      })
    } finally {
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("preserves the trusted fallback when the exact action entrypoint cannot load its evaluator", () => {
    const fixture = createActionCheckout()
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-fallback-temp-")))
    try {
      expect(runFallback(runnerTemp).status).toBe(0)

      const diagnostic = runDiagnostic(fixture, runnerTemp)
      const finalizer = runFinalizer(runnerTemp, "failure", "")
      const summary = readSummary(runnerTemp)

      expect(diagnostic.status).toBe(1)
      expect(finalizer.status).toBe(0)
      expect(summary).toMatchObject({
        authorityEligible: false,
        diagnostic_status: "blocked",
        failure_stage: "fallback",
        outcome: "blocked",
        signing: false,
      })
      expect(summary.diagnostic_codes).toEqual([
        "project-finish-attestation-context-diagnostic-fallback-pending",
      ])
      expect(rendered(diagnostic, finalizer, summary)).not.toContain(fixture)
      expect(rendered(diagnostic, finalizer, summary)).not.toContain(runnerTemp)
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("replaces the fallback only after the exact action entrypoint writes a valid bounded result", () => {
    const fixture = createActionCheckout(runtimeSources)
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-fallback-temp-")))
    try {
      expect(runFallback(runnerTemp).status).toBe(0)
      const diagnostic = runDiagnostic(fixture, runnerTemp, {
        PROJECT_FINISH_DIAGNOSTIC_ACTIONS: "true",
        PROJECT_FINISH_DIAGNOSTIC_PRODUCER_CHECKOUT: "match",
      })
      const finalizer = runFinalizer(runnerTemp, "failure", "blocked")
      const summary = readSummary(runnerTemp)

      expect(diagnostic.status).toBe(1)
      expect(finalizer.status).toBe(0)
      expect(summary).toMatchObject({
        authorityEligible: false,
        diagnostic_status: "blocked",
        failure_stage: "context",
        outcome: "blocked",
        signing: false,
      })
      expect(summary.failure_stage).not.toBe("fallback")
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("rejects a symlinked runner temp for fallback and finalization without an outside write", () => {
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-fallback-temp-")))
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-fallback-outside-")))
    const hostileRoot = join(runnerTemp, "hostile")
    try {
      symlinkSync(outside, hostileRoot)
      const fallback = runFallback(hostileRoot)
      const finalizer = runFinalizer(hostileRoot, "failure", "")

      expect(fallback.status).toBe(1)
      expect(finalizer.status).toBe(1)
      expect(existsSync(join(outside, outputDirectory, summaryName))).toBe(false)
      expect(`${fallback.stdout}${fallback.stderr}${finalizer.stdout}${finalizer.stderr}`).not.toContain(outside)
      expect(`${fallback.stdout}${fallback.stderr}${finalizer.stdout}${finalizer.stderr}`).not.toContain(runnerTemp)
    } finally {
      rmSync(runnerTemp, { force: true, recursive: true })
      rmSync(outside, { force: true, recursive: true })
    }
  })

  it("fails only after the summary upload boundary when the final outcome is blocked", () => {
    expect(run(outcomeActionPath, { INPUT_DIAGNOSTIC_OUTCOME: "match" }).status).toBe(0)
    const blocked = run(outcomeActionPath, { INPUT_DIAGNOSTIC_OUTCOME: "blocked" })
    expect(blocked.status).toBe(1)
    expect(`${blocked.stdout}${blocked.stderr}`).toContain(
      "project-finish-producer-context-diagnostic-blocked",
    )
  })

  it("uses a no-dependency exact-entrypoint selftest and a workflow fallback before the OIDC action", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const selftestWorkflow = readFileSync(selftestWorkflowPath, "utf8")
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-fallback-selftest-")))
    try {
      const selftest = runSelftest(runnerTemp)
      const summary = JSON.parse(readFileSync(join(runnerTemp, "project-finish-context-diagnostic-selftest", "summary.json"), "utf8"))

      expect(selftest.status).toBe(0)
      expect(summary).toMatchObject({
        authorityEligible: false,
        diagnosticOnly: true,
        outcome: "match",
        signing: false,
      })
      expect(summary.cases).toEqual([
        { id: "canonical-context", status: "match" },
        { id: "missing-evaluator", status: "match" },
        { id: "runtime-error", status: "match" },
        { id: "oidc-blocked", status: "match" },
      ])
      expect(workflow).toContain("Create bounded project producer context fallback")
      expect(workflow).toContain('ACTIONS_ID_TOKEN_REQUEST_TOKEN: ""')
      expect(workflow).toContain('ACTIONS_ID_TOKEN_REQUEST_URL: ""')
      expect(workflow).toContain("continue-on-error: true")
      expect(workflow).toContain("Finalize bounded project producer context diagnostic")
      expect(workflow).toContain("Report bounded project producer context diagnostic outcome")
      expect(workflow).toContain("if-no-files-found: error")
      expect(workflow).toContain("hosted-selftest:")
      expect(workflow).toContain("Exercise required native runner OIDC diagnostic context")
      expect(workflow).toContain("Upload native runner OIDC diagnostic context summary")
      expect(workflow).toContain("Report native runner OIDC diagnostic selftest outcome")
      expect(workflow.indexOf("Create bounded project producer context fallback")).toBeLessThan(
        workflow.indexOf("Emit bounded project producer context diagnostic"),
      )
      expect(workflow.indexOf("Upload bounded project producer context diagnostic")).toBeLessThan(
        workflow.indexOf("Report bounded project producer context diagnostic outcome"),
      )
      expect(selftestWorkflow).toContain("runs-on: ubuntu-latest")
      expect(selftestWorkflow).toContain("uses: ./.github/actions/project-finish-context-diagnostic-selftest")
      expect(selftestWorkflow).toContain("ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true")
      expect(selftestWorkflow).not.toContain("id-token:")
      expect(selftestWorkflow).not.toContain("npm install")
      expect(selftestWorkflow).not.toContain("npm ci")
      expect(readFileSync(fallbackActionPath, "utf8")).toContain('name.replaceAll("_", "-")')
      expect(readFileSync(finalizerActionPath, "utf8")).toContain('name.replaceAll("_", "-")')
      expect(readFileSync(actionPath, "utf8")).toContain('privateEnvironment("PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP")')
      expect(readFileSync(actionPath, "utf8")).not.toContain("INPUT_")
      expect(readFileSync(selftestCorePath, "utf8")).toContain('name.replaceAll("_", "-")')
      expect(readFileSync(selftestActionPath, "utf8")).toContain("runProjectFinishContextDiagnosticSelftest()")
      expect(readFileSync(nativeSelftestActionPath, "utf8")).toContain("runRequiredNativeProjectFinishContextSelftest()")
      expect(readFileSync(nativeSelftestMetadataPath, "utf8")).not.toContain("inputs:")
      expect(readFileSync(nativeSelftestCorePath, "utf8")).not.toContain("node:child_process")
      expect(readFileSync(nativeSelftestCorePath, "utf8")).not.toContain("spawnSync")
      expect(readFileSync(nativeSelftestCorePath, "utf8")).not.toContain("INPUT_")
    } finally {
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("requires native runner OIDC for the reusable selftest and labels the id-token-free selftest", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-native-selftest-requirement-")))
    try {
      const selftest = runSelftest(runnerTemp)
      const summary = JSON.parse(
        readFileSync(join(runnerTemp, "project-finish-context-diagnostic-selftest", "summary.json"), "utf8"),
      )

      expect(selftest.status).toBe(0)
      expect(summary.nativeRunnerOidc).toEqual({
        evidence: "not-collected",
        requirement: "not-required",
      })
      expect(workflow).toContain(
        "uses: actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd",
      )
      expect(workflow).toContain("runRequiredNativeProjectFinishContextSelftestWithCore")
      expect(workflow).toContain("continue-on-error: true")
      expect(workflow.indexOf("Upload native runner OIDC diagnostic context summary")).toBeLessThan(
        workflow.indexOf("Report native runner OIDC diagnostic selftest outcome"),
      )
    } finally {
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("uses native runner OIDC values for an all-match reusable diagnostic selftest", () => {
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-native-selftest-")))
    const token = `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
    try {
      const selftest = runNativeSelftest(runnerTemp, token, {
        PROJECT_FINISH_DIAGNOSTIC_ACTIONS: "true",
        PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF:
          "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
        PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA: callerSha,
        PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME: "push",
        PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN: `hostile-${secret}`,
        PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL: `https://untrusted.example/${secret}`,
        PROJECT_FINISH_DIAGNOSTIC_PRODUCER_CHECKOUT: "match",
        PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA: producerSha,
        PROJECT_FINISH_DIAGNOSTIC_REF: "refs/heads/main",
        PROJECT_FINISH_DIAGNOSTIC_REPOSITORY: "example/public-gradle-app",
        PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID: "987654321",
        PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY: "public",
        PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF:
          "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
        PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA: producerSha,
        PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT: "1",
        PROJECT_FINISH_DIAGNOSTIC_RUN_ID: "1001",
        PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT: "github-hosted",
        PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS: "Linux",
        PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
        PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD: callerSha,
      })
      const summary = JSON.parse(
        readFileSync(join(runnerTemp, "project-finish-context-diagnostic-selftest", "summary.json"), "utf8"),
      )
      const output = `${selftest.stdout}${selftest.stderr}${JSON.stringify(summary)}`

      expect(selftest.status).toBe(0)
      expect(summary.cases).toContainEqual({
        id: "native-runner-context",
        status: "match",
      })
      expect(summary.nativeRunnerOidc).toEqual({
        evidence: "collected",
        requirement: "required",
        status: "match",
      })
      expect(output).not.toContain(secret)
      expect(output).not.toContain(token)
      expect(output).not.toContain(runnerTemp)
    } finally {
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("writes only a bounded native mismatch before the reusable workflow reports failure when runner OIDC is absent", () => {
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-native-selftest-missing-")))
    const nativeSecret = `PH_NATIVE_OIDC_REQUIRED_SECRET_${secret}`
    try {
      const selftest = runNativeSelftest(runnerTemp, undefined, {
        ...nativeContext(runnerTemp),
        PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN: nativeSecret,
        PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL: `https://untrusted.example/${nativeSecret}`,
      })
      const summary = JSON.parse(
        readFileSync(join(runnerTemp, "project-finish-context-diagnostic-selftest", "summary.json"), "utf8"),
      )
      const output = `${selftest.stdout}${selftest.stderr}${JSON.stringify(summary)}`

      expect(selftest.status).toBe(1)
      expect(summary).toEqual({
        artifactProducer: false,
        authorityEligible: false,
        cases: [{ id: "native-runner-context", status: "mismatch" }],
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
      })
      expect(output).not.toContain(nativeSecret)
      expect(output).not.toContain(runnerTemp)
    } finally {
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it.each([
    undefined,
    "",
    `malformed-${secret}`,
  ])("fails closed when the trusted native OIDC capability is unavailable", (token) => {
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-native-selftest-partial-")))
    try {
      const selftest = runNativeSelftest(runnerTemp, token, nativeContext(runnerTemp))
      const summary = JSON.parse(
        readFileSync(join(runnerTemp, "project-finish-context-diagnostic-selftest", "summary.json"), "utf8"),
      )
      const output = `${selftest.stdout}${selftest.stderr}${JSON.stringify(summary)}`

      expect(selftest.status).toBe(1)
      expect(summary.cases).toEqual([{ id: "native-runner-context", status: "mismatch" }])
      expect(summary.nativeRunnerOidc).toEqual({
        evidence: "required",
        requirement: "required",
        status: "mismatch",
      })
      expect(output).not.toContain(secret)
      expect(output).not.toContain("malformed-")
      expect(output).not.toContain(runnerTemp)
    } finally {
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("does not turn an id-token-free selftest into native OIDC evidence", () => {
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-id-token-free-selftest-")))
    try {
      const selftest = runSelftest(runnerTemp)
      const summary = JSON.parse(
        readFileSync(join(runnerTemp, "project-finish-context-diagnostic-selftest", "summary.json"), "utf8"),
      )
      const output = `${selftest.stdout}${selftest.stderr}${JSON.stringify(summary)}`

      expect(selftest.status).toBe(0)
      expect(summary.nativeRunnerOidc).toEqual({
        evidence: "not-collected",
        requirement: "not-required",
      })
      expect(summary.cases).not.toContainEqual({
        id: "native-runner-context",
        status: "match",
      })
      expect(output).not.toContain(secret)
      expect(output).not.toContain(runnerTemp)
    } finally {
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })
})

function createActionCheckout(scripts: readonly string[] = []): string {
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-fallback-action-")))
  const actionDirectory = join(fixture, ".github", "actions", "project-finish-context-diagnostic")
  const scriptsDirectory = join(fixture, "scripts")
  writeDirectory(actionDirectory)
  writeDirectory(scriptsDirectory)
  copyFileSync(actionPath, join(actionDirectory, "index.mjs"))
  for (const script of scripts) {
    copyFileSync(join(root, "scripts", script), join(scriptsDirectory, script))
  }
  return fixture
}

function runFallback(runnerTemp: string) {
  return run(fallbackActionPath, {
    INPUT_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
  })
}

function runDiagnostic(fixture: string, runnerTemp: string, overrides: Readonly<Record<string, string>> = {}) {
  return run(join(fixture, ".github", "actions", "project-finish-context-diagnostic", "index.mjs"), {
    PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
    ...overrides,
  })
}

function runFinalizer(runnerTemp: string, stepOutcome: string, summaryStatus: string) {
  return run(finalizerActionPath, {
    INPUT_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
    INPUT_DIAGNOSTIC_STEP_OUTCOME: stepOutcome,
    INPUT_DIAGNOSTIC_SUMMARY_STATUS: summaryStatus,
  })
}

function runSelftest(
  runnerTemp: string,
  nodeArguments: readonly string[] = [],
  overrides: Readonly<Record<string, string>> = {},
) {
  return run(selftestActionPath, {
    INPUT_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
    ...overrides,
  }, nodeArguments)
}

function runNativeSelftest(
  runnerTemp: string,
  oidcToken: string | undefined = undefined,
  overrides: Readonly<Record<string, string>> = {},
) {
  const script = `
const bridge = require(${JSON.stringify(oidcCapabilityBridgePath)})
const core = {
  getIDToken: async (audience) => {
    if (audience !== "persona-harness-project-finish-attestation") throw new Error("audience")
    return ${JSON.stringify(oidcToken)}
  },
}
bridge.runRequiredNativeProjectFinishContextSelftestWithCore({ core })
  .then(() => {
    process.exitCode = 0
  })
  .catch(() => {
    process.stderr.write("project-finish-producer-context-diagnostic-selftest-failed\\n")
    process.exitCode = 1
  })
`
  return spawnSync(process.execPath, ["--input-type=commonjs", "--eval", script], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...githubActionEnvironment({
        PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
        ...overrides,
      }),
      NODE_PATH: "",
    },
  })
}

function nativeContext(runnerTemp: string): Record<string, string> {
  return {
    PROJECT_FINISH_DIAGNOSTIC_ACTIONS: "true",
    PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF:
      "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
    PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA: callerSha,
    PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME: "push",
    PROJECT_FINISH_DIAGNOSTIC_PRODUCER_CHECKOUT: "match",
    PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA: producerSha,
    PROJECT_FINISH_DIAGNOSTIC_REF: "refs/heads/main",
    PROJECT_FINISH_DIAGNOSTIC_REPOSITORY: "example/public-gradle-app",
    PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID: "987654321",
    PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY: "public",
    PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF:
      "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
    PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA: producerSha,
    PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT: "1",
    PROJECT_FINISH_DIAGNOSTIC_RUN_ID: "1001",
    PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT: "github-hosted",
    PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS: "Linux",
    PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
    PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD: callerSha,
  }
}

function run(
  path: string,
  environment: Readonly<Record<string, string>>,
  nodeArguments: readonly string[] = [],
) {
  return spawnSync(process.execPath, [...nodeArguments, path], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...githubActionEnvironment(environment),
      NODE_PATH: "",
    },
  })
}

function githubActionEnvironment(environment: Readonly<Record<string, string>>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(environment).map(([name, value]) => [
      name.startsWith("INPUT_")
        ? `INPUT_${name.slice("INPUT_".length).replaceAll("_", "-")}`
        : name,
      value,
    ]),
  )
}

function readSummary(runnerTemp: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(runnerTemp, outputDirectory, summaryName), "utf8")) as Record<string, unknown>
}

function rendered(
  first: { readonly stderr: string | Buffer; readonly stdout: string | Buffer },
  second: { readonly stderr: string | Buffer; readonly stdout: string | Buffer },
  summary: Record<string, unknown>,
): string {
  return `${first.stdout}${first.stderr}${second.stdout}${second.stderr}${JSON.stringify(summary)}`
}

function writeDirectory(path: string): void {
  mkdirSync(path, { recursive: true })
}

function claims(): Record<string, string> {
  return {
    event_name: "push",
    job_workflow_ref:
      "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
    job_workflow_sha: producerSha,
    ref: "refs/heads/main",
    repository: "example/public-gradle-app",
    repository_id: "987654321",
    repository_visibility: "public",
    run_attempt: "1",
    run_id: "1001",
    runner_environment: "github-hosted",
    workflow_ref:
      "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
    workflow_sha: callerSha,
  }
}
