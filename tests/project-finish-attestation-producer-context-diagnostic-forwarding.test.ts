import { execFileSync, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const diagnosticScript = join(root, "scripts", "diagnose-project-finish-producer-context.mjs")
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish-context-diagnostic.yml")
const callerSha = "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8"
const producerSha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim()
const secret = "PH_CONTEXT_FORWARDING_SECRET_sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

describe("project finish context diagnostic forwarding", () => {
  it("uses private allowlisted context aliases instead of ambient GitHub environment values", () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-forwarding-")))
    const hookDirectory = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-forwarding-hook-")))
    const hookPath = join(hookDirectory, "oidc-hook.mjs")
    const oidcToken = `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
    try {
      writeFileSync(hookPath, oidcHook(oidcToken))
      const environment = forwardedEnvironment(workspace)
      environment.ACTIONS_ID_TOKEN_REQUEST_TOKEN = `ambient-github-context-${secret}`
      environment.ACTIONS_ID_TOKEN_REQUEST_URL = `https://untrusted.example/${secret}`
      environment.GITHUB_WORKSPACE = `ambient-github-context-${secret}`
      const result = runForwardedDiagnostic(workspace, ["--import", hookPath], environment)
      const summary = readFileSync(summaryPath(workspace), "utf8")
      const output = `${result.stdout}${result.stderr}${summary}`

      expect(result.status).toBe(0)
      expect(JSON.parse(summary)).toMatchObject({
        authorityEligible: false,
        diagnosticOnly: true,
        oidcClaimRead: true,
        oidcRequestAttempted: true,
        outcome: "match",
        signing: false,
      })
      expect(output).not.toContain(secret)
      expect(output).not.toContain("ambient-github-context")
      expect(output).not.toContain(workspace)
      expect(output).not.toContain(oidcToken)
    } finally {
      rmSync(workspace, { force: true, recursive: true })
      rmSync(hookDirectory, { force: true, recursive: true })
    }
  })

  it("reports a bounded missing status when a required forwarded field is absent", () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-forwarding-")))
    const hookDirectory = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-forwarding-hook-")))
    const hookPath = join(hookDirectory, "oidc-hook.mjs")
    const oidcToken = `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
    try {
      writeFileSync(hookPath, oidcHook(oidcToken))
      const environment = forwardedEnvironment(workspace)
      delete environment.PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF
      const result = runForwardedDiagnostic(workspace, ["--import", hookPath], environment)
      const summary = readFileSync(summaryPath(workspace), "utf8")
      const output = `${result.stdout}${result.stderr}${summary}`

      expect(result.status).toBe(1)
      expect(JSON.parse(summary).diagnosticCodes).toContain(
        "project-finish-attestation-producer-context-diagnostic.2-caller-workflow-ref-missing",
      )
      expect(output).not.toContain(secret)
      expect(output).not.toContain(oidcToken)
      expect(output).not.toContain(workspace)
    } finally {
      rmSync(workspace, { force: true, recursive: true })
      rmSync(hookDirectory, { force: true, recursive: true })
    }
  })

  it("blocks a hostile forwarded value without reflecting it", () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-forwarding-")))
    const hookDirectory = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-forwarding-hook-")))
    const hookPath = join(hookDirectory, "oidc-hook.mjs")
    const oidcToken = `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
    try {
      writeFileSync(hookPath, oidcHook(oidcToken))
      const environment = forwardedEnvironment(workspace)
      environment.PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF =
        `example/public-gradle-app/.github/workflows/${secret}.yml@refs/heads/main`
      const result = runForwardedDiagnostic(workspace, ["--import", hookPath], environment)
      const summary = readFileSync(summaryPath(workspace), "utf8")
      const output = `${result.stdout}${result.stderr}${summary}`

      expect(result.status).toBe(1)
      expect(JSON.parse(summary).diagnosticCodes).toContain(
        "project-finish-attestation-producer-context-diagnostic.2-caller-workflow-ref-mismatch",
      )
      expect(output).not.toContain(secret)
      expect(output).not.toContain(oidcToken)
      expect(output).not.toContain(workspace)
    } finally {
      rmSync(workspace, { force: true, recursive: true })
      rmSync(hookDirectory, { force: true, recursive: true })
    }
  })

  it("forwards only fixed private context aliases into an environment-cleared evaluator", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const diagnosticStart = workflow.indexOf("      - name: Emit bounded project producer context diagnostic")
    const uploadStart = workflow.indexOf("      - name: Upload bounded project producer context diagnostic")
    const diagnosticStep = diagnosticStart >= 0 && uploadStart > diagnosticStart
      ? workflow.slice(diagnosticStart, uploadStart)
      : ""

    expect(diagnosticStep).toContain("env -i")
    for (const name of [
      "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF",
      "PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA",
      "PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME",
      "PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN",
      "PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL",
      "PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA",
      "PROJECT_FINISH_DIAGNOSTIC_REF",
      "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY",
      "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID",
      "PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY",
      "PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF",
      "PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA",
      "PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT",
      "PROJECT_FINISH_DIAGNOSTIC_RUN_ID",
      "PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT",
      "PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS",
      "PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD",
      "PROJECT_FINISH_DIAGNOSTIC_WORKSPACE",
    ]) {
      expect(diagnosticStep).toContain(name)
    }
    expect(diagnosticStep).not.toContain("$PATH")
    expect(diagnosticStep).not.toContain("$HOME")
    expect(diagnosticStep).not.toContain("$GIT_CONFIG_GLOBAL")
  })
})

function runForwardedDiagnostic(
  workspace: string,
  nodeArguments: readonly string[] = [],
  environment = forwardedEnvironment(workspace),
) {
  return spawnSync(process.execPath, [...nodeArguments, diagnosticScript], {
    cwd: root,
    encoding: "utf8",
    env: environment,
  })
}

function forwardedEnvironment(workspace: string): Record<string, string> {
  return {
    PROJECT_FINISH_DIAGNOSTIC_ACTIONS: "true",
    PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF:
      "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
    PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA: callerSha,
    PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME: "push",
    PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN: secret,
    PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL:
      "https://pipelines.actions.githubusercontent.com/oidc?api-version=7.1&serviceConnectionId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
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
    PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD: callerSha,
    PROJECT_FINISH_DIAGNOSTIC_WORKSPACE: workspace,
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
