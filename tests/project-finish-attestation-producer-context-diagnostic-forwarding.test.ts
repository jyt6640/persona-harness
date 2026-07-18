import { execFileSync, spawnSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
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
const diagnosticScript = join(root, "scripts", "diagnose-project-finish-producer-context.mjs")
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish-context-diagnostic.yml")
const actionDirectory = join(root, ".github", "actions", "project-finish-context-diagnostic")
const actionMetadataPath = join(actionDirectory, "action.yml")
const actionPath = join(actionDirectory, "index.mjs")
const fallbackActionPath = join(root, ".github", "actions", "project-finish-context-diagnostic-fallback", "index.mjs")
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

  it("runs the trusted local action without resolving an ambient launcher before reading OIDC", () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-action-")))
    const hookDirectory = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-action-hook-")))
    const shadowDirectory = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-action-shadow-")))
    const markerPath = join(shadowDirectory, "executed")
    const hookPath = join(hookDirectory, "oidc-hook.mjs")
    const oidcToken = `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
    try {
      writeFileSync(hookPath, oidcHook(oidcToken))
      for (const executable of ["env", "node", "sh", "git"]) {
        const executablePath = join(shadowDirectory, executable)
        writeFileSync(executablePath, shadowExecutable())
        chmodSync(executablePath, 0o700)
      }
      const result = runDiagnosticAction(workspace, ["--import", hookPath], actionEnvironment(workspace, shadowDirectory, markerPath))
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
      expect(existsSync(markerPath)).toBe(false)
      expect(output).not.toContain(secret)
      expect(output).not.toContain(oidcToken)
      expect(output).not.toContain(workspace)
      expect(output).not.toContain(shadowDirectory)
    } finally {
      rmSync(workspace, { force: true, recursive: true })
      rmSync(hookDirectory, { force: true, recursive: true })
      rmSync(shadowDirectory, { force: true, recursive: true })
    }
  })

  it("uses a fixed local Node action and private aliases rather than a token-bearing shell launcher", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const diagnosticStart = workflow.indexOf("      - name: Emit bounded project producer context diagnostic")
    const uploadStart = workflow.indexOf("      - name: Upload bounded project producer context diagnostic")
    const diagnosticStep = diagnosticStart >= 0 && uploadStart > diagnosticStart
      ? workflow.slice(diagnosticStart, uploadStart)
      : ""
    const resolveStart = workflow.indexOf("  resolve:")
    const diagnoseJobStart = workflow.indexOf("  diagnose:")
    const resolve = resolveStart >= 0 && diagnoseJobStart > resolveStart
      ? workflow.slice(resolveStart, diagnoseJobStart)
      : ""
    const diagnosticJob = diagnoseJobStart >= 0 ? workflow.slice(diagnoseJobStart) : ""

    expect(existsSync(actionMetadataPath)).toBe(true)
    expect(existsSync(actionPath)).toBe(true)
    expect(diagnosticStep).toContain("uses: ./.persona-harness-producer/.github/actions/project-finish-context-diagnostic")
    expect(diagnosticStep).not.toContain("run:")
    expect(diagnosticStep).not.toContain("env -i")
    expect(diagnosticStep).not.toContain("command -v node")
    expect(workflow).not.toContain("Setup diagnostic Node")
    expect(resolve).not.toContain("id-token:")
    expect(diagnosticJob).toContain("id-token: write")
    expect(diagnosticJob).not.toMatch(/\n\s+run:/u)
    const actionMetadata = readFileSync(actionMetadataPath, "utf8")
    const action = readFileSync(actionPath, "utf8")
    expect(actionMetadata).toContain("using: node20")
    expect(actionMetadata).toContain("main: index.mjs")
    expect(actionMetadata).toContain("diagnostic-runner-temp:")
    expect(actionMetadata).not.toContain("using: composite")
    expect(actionMetadata).not.toContain("run:")
    expect(actionMetadata).not.toContain("diagnostic-workspace:")
    expect(action).not.toContain("node:child_process")
    expect(action).not.toContain("process.env.PATH")
    for (const name of [
      "diagnostic-caller-workflow-ref",
      "diagnostic-caller-workflow-sha",
      "diagnostic-event-name",
      "diagnostic-producer-checkout",
      "diagnostic-producer-sha",
      "diagnostic-ref",
      "diagnostic-repository",
      "diagnostic-repository-id",
      "diagnostic-repository-visibility",
      "diagnostic-reusable-workflow-ref",
      "diagnostic-reusable-workflow-sha",
      "diagnostic-run-attempt",
      "diagnostic-run-id",
      "diagnostic-runner-environment",
      "diagnostic-runner-os",
      "diagnostic-runner-temp",
      "diagnostic-source-head",
    ]) {
      expect(diagnosticStep).toContain(name)
    }
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

function runDiagnosticAction(
  workspace: string,
  nodeArguments: readonly string[] = [],
  environment = actionEnvironment(workspace, "", ""),
) {
  spawnSync(process.execPath, [fallbackActionPath], {
    cwd: root,
    encoding: "utf8",
    env: environment,
  })
  return spawnSync(process.execPath, [...nodeArguments, actionPath], {
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
    PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP: workspace,
  }
}

function actionEnvironment(workspace: string, shadowDirectory: string, markerPath: string): Record<string, string> {
  const forwarded = forwardedEnvironment(workspace)
  return {
    ACTIONS_ID_TOKEN_REQUEST_TOKEN: secret,
    ACTIONS_ID_TOKEN_REQUEST_URL: forwarded.PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL,
    GITHUB_WORKSPACE: `ambient-${secret}`,
    GIT_CONFIG_GLOBAL: `ambient-${secret}`,
    HOME: `ambient-${secret}`,
    INPUT_DIAGNOSTIC_ACTIONS: forwarded.PROJECT_FINISH_DIAGNOSTIC_ACTIONS,
    INPUT_DIAGNOSTIC_CALLER_WORKFLOW_REF: forwarded.PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF,
    INPUT_DIAGNOSTIC_CALLER_WORKFLOW_SHA: forwarded.PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA,
    INPUT_DIAGNOSTIC_EVENT_NAME: forwarded.PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME,
    INPUT_DIAGNOSTIC_PRODUCER_CHECKOUT: "match",
    INPUT_DIAGNOSTIC_PRODUCER_SHA: forwarded.PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA,
    INPUT_DIAGNOSTIC_REF: forwarded.PROJECT_FINISH_DIAGNOSTIC_REF,
    INPUT_DIAGNOSTIC_REPOSITORY: forwarded.PROJECT_FINISH_DIAGNOSTIC_REPOSITORY,
    INPUT_DIAGNOSTIC_REPOSITORY_ID: forwarded.PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID,
    INPUT_DIAGNOSTIC_REPOSITORY_VISIBILITY: forwarded.PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY,
    INPUT_DIAGNOSTIC_REUSABLE_WORKFLOW_REF: forwarded.PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF,
    INPUT_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA: forwarded.PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA,
    INPUT_DIAGNOSTIC_RUN_ATTEMPT: forwarded.PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT,
    INPUT_DIAGNOSTIC_RUN_ID: forwarded.PROJECT_FINISH_DIAGNOSTIC_RUN_ID,
    INPUT_DIAGNOSTIC_RUNNER_ENVIRONMENT: forwarded.PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT,
    INPUT_DIAGNOSTIC_RUNNER_OS: forwarded.PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS,
    INPUT_DIAGNOSTIC_SOURCE_HEAD: forwarded.PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD,
    INPUT_DIAGNOSTIC_RUNNER_TEMP: forwarded.PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP,
    PATH: shadowDirectory,
    SHADOW_EXECUTION_MARKER: markerPath,
  }
}

function summaryPath(workspace: string): string {
  return join(workspace, "project-finish-attestation-context-diagnostic", "summary.json")
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

function shadowExecutable(): string {
  return `#!/bin/sh
if [ -n "\${ACTIONS_ID_TOKEN_REQUEST_TOKEN-}" ]; then
  : > "$SHADOW_EXECUTION_MARKER"
fi
exit 91
`
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
