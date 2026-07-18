import { execFileSync, spawnSync } from "node:child_process"
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const actionSource = join(root, ".github", "actions", "project-finish-context-diagnostic", "index.mjs")
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
  it("writes a bounded summary when the evaluator module is unavailable before launch", () => {
    const fixture = createActionCheckout([])
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-workspace-")))
    try {
      const result = runAction(fixture, workspace)
      const summary = readFileSync(summaryPath(workspace), "utf8")
      const rendered = `${result.stdout}${result.stderr}${summary}`

      expect(result.status).toBe(1)
      expect(JSON.parse(summary)).toMatchObject({
        authorityEligible: false,
        diagnostic_status: "blocked",
        failure_stage: "runtime-load",
        outcome: "blocked",
        predicateCreated: false,
        receiptCreated: false,
        registryAccess: false,
        signing: false,
      })
      expect(rendered).not.toContain(secret)
      expect(rendered).not.toContain(workspace)
      expect(rendered).not.toContain(fixture)
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(workspace, { force: true, recursive: true })
    }
  })

  it("runs canonical synthetic context from an action-like checkout without node_modules", () => {
    const fixture = createActionCheckout(runtimeSources)
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-workspace-")))
    const hookDirectory = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-hook-")))
    const hookPath = join(hookDirectory, "oidc-hook.mjs")
    const token = `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
    try {
      writeFileSync(hookPath, oidcHook(token))
      const result = runAction(fixture, workspace, ["--import", hookPath], {
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: secret,
        ACTIONS_ID_TOKEN_REQUEST_URL:
          "https://pipelines.actions.githubusercontent.com/oidc?api-version=7.1&serviceConnectionId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      })
      const summary = readFileSync(summaryPath(workspace), "utf8")
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
      expect(rendered).not.toContain(fixture)
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(workspace, { force: true, recursive: true })
      rmSync(hookDirectory, { force: true, recursive: true })
    }
  })

  it("writes a bounded summary for a hostile OIDC endpoint without reflecting it", () => {
    const fixture = createActionCheckout(runtimeSources)
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-workspace-")))
    try {
      const result = runAction(fixture, workspace, [], {
        ACTIONS_ID_TOKEN_REQUEST_TOKEN: secret,
        ACTIONS_ID_TOKEN_REQUEST_URL: `https://untrusted.example/${secret}`,
      })
      const summary = readFileSync(summaryPath(workspace), "utf8")
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
    } finally {
      rmSync(fixture, { force: true, recursive: true })
      rmSync(workspace, { force: true, recursive: true })
    }
  })

  it("uploads the fixed summary path after every diagnostic result", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const action = readFileSync(actionSource, "utf8")
    const bootstrap = action.indexOf('summary.write(failureSummary("bootstrap"))')
    const evaluatorImport = action.indexOf('await import("../../../scripts/diagnose-project-finish-producer-context.mjs")')

    expect(workflow).toContain("if: always()")
    expect(workflow).toContain(".ci/project-finish-attestation-context-diagnostic/summary.json")
    expect(workflow).toContain("uses: ./.persona-harness-producer/.github/actions/project-finish-context-diagnostic")
    expect(bootstrap).toBeGreaterThanOrEqual(0)
    expect(evaluatorImport).toBeGreaterThan(bootstrap)
    expect(action).toContain('SUMMARY_SCHEMA = "project-finish-attestation-context-diagnostic-summary.1"')
    expect(action).not.toContain("node:child_process")
    expect(action).not.toContain("node_modules")
    expect(action).not.toContain("npm install")
  })
})

function createActionCheckout(sources: readonly string[]): string {
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-summary-action-")))
  const actionDirectory = join(fixture, ".github", "actions", "project-finish-context-diagnostic")
  const scriptsDirectory = join(fixture, "scripts")
  mkdirSync(actionDirectory, { recursive: true })
  mkdirSync(scriptsDirectory, { recursive: true })
  copyFileSync(actionSource, join(actionDirectory, "index.mjs"))
  for (const source of sources) {
    copyFileSync(join(root, "scripts", source), join(scriptsDirectory, source))
  }
  return fixture
}

function runAction(
  fixture: string,
  workspace: string,
  nodeArguments: readonly string[] = [],
  overrides: Readonly<Record<string, string>> = {},
) {
  return spawnSync(process.execPath, [...nodeArguments, join(fixture, ".github", "actions", "project-finish-context-diagnostic", "index.mjs")], {
    cwd: fixture,
    encoding: "utf8",
    env: {
      ...environment(workspace),
      ...overrides,
    },
  })
}

function environment(workspace: string): Record<string, string> {
  return {
    INPUT_DIAGNOSTIC_ACTIONS: "true",
    INPUT_DIAGNOSTIC_CALLER_WORKFLOW_REF:
      "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
    INPUT_DIAGNOSTIC_CALLER_WORKFLOW_SHA: callerSha,
    INPUT_DIAGNOSTIC_EVENT_NAME: "push",
    INPUT_DIAGNOSTIC_PRODUCER_CHECKOUT: "match",
    INPUT_DIAGNOSTIC_PRODUCER_SHA: producerSha,
    INPUT_DIAGNOSTIC_REF: "refs/heads/main",
    INPUT_DIAGNOSTIC_REPOSITORY: "example/public-gradle-app",
    INPUT_DIAGNOSTIC_REPOSITORY_ID: "987654321",
    INPUT_DIAGNOSTIC_REPOSITORY_VISIBILITY: "public",
    INPUT_DIAGNOSTIC_REUSABLE_WORKFLOW_REF:
      "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
    INPUT_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA: producerSha,
    INPUT_DIAGNOSTIC_RUN_ATTEMPT: "1",
    INPUT_DIAGNOSTIC_RUN_ID: "1001",
    INPUT_DIAGNOSTIC_RUNNER_ENVIRONMENT: "github-hosted",
    INPUT_DIAGNOSTIC_RUNNER_OS: "Linux",
    INPUT_DIAGNOSTIC_SOURCE_HEAD: callerSha,
    INPUT_DIAGNOSTIC_WORKSPACE: workspace,
    NODE_PATH: "",
  }
}

function summaryPath(workspace: string): string {
  return join(workspace, ".ci", "project-finish-attestation-context-diagnostic", "summary.json")
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

function oidcHook(token: string): string {
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
