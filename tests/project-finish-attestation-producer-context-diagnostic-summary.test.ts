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
const actionSource = join(root, ".github", "actions", "project-finish-context-diagnostic", "index.mjs")
const bridgeSource = join(root, ".github", "actions", "project-finish-context-diagnostic", "oidc-capability-bridge.cjs")
const fallbackActionSource = join(root, ".github", "actions", "project-finish-context-diagnostic-fallback", "index.mjs")
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish-context-diagnostic.yml")
const secret = "PH_SUMMARY_SECRET_sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
const callerSha = "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8"
const producerSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
const runtimeSources = [
  "diagnose-project-finish-producer-context.mjs",
  "project-finish-attestation-oidc.mjs",
  "project-finish-attestation-producer-context-diagnostic.mjs",
  "project-finish-attestation-producer-context.mjs",
  "verify-project-finish-producer-checkout.mjs",
] as const

describe("project finish context diagnostic summary bootstrap", () => {
  it("writes a bounded summary only to canonical runner temp when caller .ci is symlinked", () => {
    const fixture = createActionCheckout([])
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-workspace-")))
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-temp-")))
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-outside-")))
    try {
      symlinkSync(outside, join(workspace, ".ci"))
      const result = runAction(fixture, workspace, runnerTemp)
      const summary = readFileSync(summaryPath(runnerTemp), "utf8")
      const rendered = `${result.stdout}${result.stderr}${summary}`

      expect(result.status).toBe(1)
      expect(JSON.parse(summary)).toMatchObject({
        authorityEligible: false,
        diagnostic_status: "blocked",
        failure_stage: "fallback",
        outcome: "blocked",
        predicateCreated: false,
        receiptCreated: false,
        registryAccess: false,
        signing: false,
      })
      expect(existsSync(summaryPath(workspace))).toBe(false)
      expect(existsSync(summaryPath(outside))).toBe(false)
      expect(rendered).not.toContain(secret)
      expect(rendered).not.toContain(workspace)
      expect(rendered).not.toContain(runnerTemp)
      expect(rendered).not.toContain(outside)
      expect(rendered).not.toContain(fixture)
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(workspace, { force: true, recursive: true })
      rmSync(runnerTemp, { force: true, recursive: true })
      rmSync(outside, { force: true, recursive: true })
    }
  })

  it("runs canonical synthetic context from an action-like checkout without node_modules", () => {
    const fixture = createActionCheckout(runtimeSources)
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-workspace-")))
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-temp-")))
    const token = `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
    try {
      const result = runAction(fixture, workspace, runnerTemp, token)
      const summary = readFileSync(summaryPath(runnerTemp), "utf8")
      const rendered = `${result.stdout}${result.stderr}${summary}`

      expect(existsSync(join(fixture, "node_modules"))).toBe(false)
      expect(result.status).toBe(0)
      expect(JSON.parse(summary)).toMatchObject({
        authorityEligible: false,
        diagnostic_status: "match",
        failure_stage: "context",
        outcome: "match",
        predicateCreated: false,
        receiptCreated: false,
        registryAccess: false,
        signing: false,
      })
      expect(rendered).not.toContain(secret)
      expect(rendered).not.toContain(token)
      expect(rendered).not.toContain(workspace)
      expect(rendered).not.toContain(runnerTemp)
      expect(rendered).not.toContain(fixture)
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(workspace, { force: true, recursive: true })
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("does not follow a caller leaf summary symlink when the evaluator throws", () => {
    const fixture = createActionCheckout([], "runtime-error")
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-workspace-")))
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-temp-")))
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-outside-")))
    try {
      const callerDirectory = join(workspace, ".ci", "project-finish-attestation-context-diagnostic")
      mkdirSync(callerDirectory, { recursive: true })
      symlinkSync(join(outside, "summary.json"), join(callerDirectory, "summary.json"))
      const result = runAction(fixture, workspace, runnerTemp)
      const summary = readFileSync(summaryPath(runnerTemp), "utf8")
      const rendered = `${result.stdout}${result.stderr}${summary}`

      expect(result.status).toBe(1)
      expect(JSON.parse(summary)).toMatchObject({
        diagnostic_status: "blocked",
        failure_stage: "fallback",
        outcome: "blocked",
      })
      expect(existsSync(join(outside, "summary.json"))).toBe(false)
      expect(rendered).not.toContain(secret)
      expect(rendered).not.toContain(workspace)
      expect(rendered).not.toContain(runnerTemp)
      expect(rendered).not.toContain(outside)
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(workspace, { force: true, recursive: true })
      rmSync(runnerTemp, { force: true, recursive: true })
      rmSync(outside, { force: true, recursive: true })
    }
  })

  it("blocks hostile runner temp roots without a caller-workspace summary", () => {
    const fixture = createActionCheckout([])
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-workspace-")))
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-temp-")))
    const outside = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-outside-")))
    const symlinkedTemp = join(workspace, "runner-temp")
    try {
      symlinkSync(outside, symlinkedTemp)
      symlinkSync(outside, join(runnerTemp, "project-finish-attestation-context-diagnostic"))
      for (const hostileRunnerTemp of ["relative-runner-temp", symlinkedTemp, runnerTemp]) {
        const result = runAction(fixture, workspace, hostileRunnerTemp)
        const rendered = `${result.stdout}${result.stderr}`

        expect(result.status).toBe(1)
        expect(existsSync(summaryPath(workspace))).toBe(false)
        expect(existsSync(summaryPath(outside))).toBe(false)
        expect(rendered).not.toContain(secret)
        expect(rendered).not.toContain(workspace)
        expect(rendered).not.toContain(outside)
      }
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(workspace, { force: true, recursive: true })
      rmSync(runnerTemp, { force: true, recursive: true })
      rmSync(outside, { force: true, recursive: true })
    }
  })

  it("writes a bounded summary when the trusted OIDC capability is unavailable without reflecting hostile aliases", () => {
    const fixture = createActionCheckout(runtimeSources)
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-workspace-")))
    const runnerTemp = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-temp-")))
    try {
      const result = runAction(fixture, workspace, runnerTemp, undefined, {
        PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN: secret,
        PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL: `https://untrusted.example/${secret}`,
      })
      const summary = readFileSync(summaryPath(runnerTemp), "utf8")
      const rendered = `${result.stdout}${result.stderr}${summary}`

      expect(result.status).toBe(1)
      expect(JSON.parse(summary)).toMatchObject({
        diagnostic_status: "blocked",
        failure_stage: "context",
        outcome: "blocked",
      })
      expect(rendered).not.toContain(secret)
      expect(rendered).not.toContain("untrusted.example")
      expect(rendered).not.toContain(workspace)
      expect(rendered).not.toContain(runnerTemp)
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(workspace, { force: true, recursive: true })
      rmSync(runnerTemp, { force: true, recursive: true })
    }
  })

  it("uploads the fixed summary path after every diagnostic result", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const action = readFileSync(actionSource, "utf8")
    const evaluatorImport = action.indexOf('await import("../../../scripts/diagnose-project-finish-producer-context.mjs")')

    expect(workflow).toContain("if: always()")
    expect(workflow).toContain("Create bounded project producer context fallback")
    expect(workflow).toContain("continue-on-error: true")
    expect(workflow).toContain("Finalize bounded project producer context diagnostic")
    expect(workflow).toContain("Report bounded project producer context diagnostic outcome")
    expect(workflow).toContain("diagnostic-runner-temp: ${{ runner.temp }}")
    expect(workflow).toContain("${{ runner.temp }}/project-finish-attestation-context-diagnostic/summary.json")
    expect(workflow).toContain("uses: actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd")
    expect(workflow).toContain("runProjectFinishContextDiagnosticWithCore")
    expect(workflow).not.toContain("diagnostic-workspace: ${{ github.workspace }}")
    expect(evaluatorImport).toBeGreaterThanOrEqual(0)
    expect(action).toContain('SUMMARY_SCHEMA = "project-finish-attestation-context-diagnostic-summary.1"')
    expect(action).not.toContain("node:child_process")
    expect(action).not.toContain("node_modules")
    expect(action).not.toContain("npm install")
    expect(action).toContain('const OUTPUT_DIRECTORY = "project-finish-attestation-context-diagnostic"')
    expect(action).toContain('privateEnvironment("PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP")')
    expect(action).not.toContain("INPUT_")
    expect(action).not.toContain("ACTIONS_ID_TOKEN_REQUEST_")
    expect(action).not.toContain("PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_")
    expect(action).toContain("replaceFallbackSummary(summary)")
    expect(action).toContain('writeActionOutput("summary-status", summary.outcome)')
    expect(action).not.toContain('summary.write(failureSummary("bootstrap"))')
    expect(action).not.toContain("DIAGNOSTIC_WORKSPACE")
    const bridge = readFileSync(bridgeSource, "utf8")
    expect(bridge).toContain("core.getIDToken")
    expect(bridge).not.toContain("process.env")
    expect(bridge).not.toContain("node:child_process")
  })
})

function createActionCheckout(sources: readonly string[], evaluator: "missing" | "runtime-error" = "missing"): string {
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-action-")))
  const actionDirectory = join(fixture, ".github", "actions", "project-finish-context-diagnostic")
  const scriptsDirectory = join(fixture, "scripts")
  mkdirSync(actionDirectory, { recursive: true })
  mkdirSync(scriptsDirectory, { recursive: true })
  copyFileSync(actionSource, join(actionDirectory, "index.mjs"))
  copyFileSync(bridgeSource, join(actionDirectory, "oidc-capability-bridge.cjs"))
  for (const source of sources) {
    copyFileSync(join(root, "scripts", source), join(scriptsDirectory, source))
  }
  if (evaluator === "runtime-error") {
    writeFileSync(
      join(scriptsDirectory, "diagnose-project-finish-producer-context.mjs"),
      'export async function runProjectFinishProducerContextDiagnostic() { throw new Error("runtime") }\n',
    )
  }
  return fixture
}

function runAction(
  fixture: string,
  workspace: string,
  runnerTemp: string,
  oidcToken: string | undefined = undefined,
  overrides: Readonly<Record<string, string>> = {},
) {
  const actionEnvironment = {
    ...environment(workspace, runnerTemp),
    ...overrides,
  }
  spawnSync(process.execPath, [fallbackActionSource], {
    cwd: fixture,
    encoding: "utf8",
    env: githubActionEnvironment({
      INPUT_DIAGNOSTIC_RUNNER_TEMP: runnerTemp,
    }),
  })
  const bridgePath = join(fixture, ".github", "actions", "project-finish-context-diagnostic", "oidc-capability-bridge.cjs")
  const script = `
const bridge = require(${JSON.stringify(bridgePath)})
const core = {
  getIDToken: async (audience) => {
    if (audience !== "persona-harness-project-finish-attestation") throw new Error("audience")
    return ${JSON.stringify(oidcToken)}
  },
}
bridge.runProjectFinishContextDiagnosticWithCore({ core })
  .then((summary) => {
    process.stdout.write(JSON.stringify(summary) + "\\n")
    process.exitCode = summary.outcome === "match" ? 0 : 1
  })
  .catch(() => {
    process.stderr.write("project-finish-producer-context-diagnostic-failed\\n")
    process.exitCode = 1
  })
`
  return spawnSync(process.execPath, ["--input-type=commonjs", "--eval", script], {
    cwd: fixture,
    encoding: "utf8",
    env: actionEnvironment,
  })
}

function environment(workspace: string, runnerTemp: string): Record<string, string> {
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
    NODE_PATH: "",
  }
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

function summaryPath(runnerTemp: string): string {
  return join(runnerTemp, "project-finish-attestation-context-diagnostic", "summary.json")
}

function claims(): Record<string, string> {
  return {
    event_name: "push",
    job_workflow_ref: "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
    job_workflow_sha: producerSha,
    ref: "refs/heads/main",
    repository: "example/public-gradle-app",
    repository_id: "987654321",
    repository_visibility: "public",
    run_attempt: "1",
    run_id: "1001",
    runner_environment: "github-hosted",
    workflow_ref: "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
    workflow_sha: callerSha,
  }
}
