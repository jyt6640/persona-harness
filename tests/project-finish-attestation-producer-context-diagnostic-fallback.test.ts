import { spawnSync } from "node:child_process"
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
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish-context-diagnostic.yml")
const selftestWorkflowPath = join(root, ".github", "workflows", "project-finish-context-diagnostic-selftest.yml")
const outputDirectory = "project-finish-attestation-context-diagnostic"
const summaryName = "summary.json"
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
      expect(readFileSync(selftestActionPath, "utf8")).toContain('name.replaceAll("_", "-")')
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

function runSelftest(runnerTemp: string) {
  return run(selftestActionPath, {
    INPUT_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
  })
}

function run(path: string, environment: Readonly<Record<string, string>>) {
  return spawnSync(process.execPath, [path], {
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
