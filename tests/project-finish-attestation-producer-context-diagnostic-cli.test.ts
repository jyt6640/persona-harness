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
const secret = "PH_CONTEXT_SECRET_sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

describe("project finish producer context diagnostic CLI", () => {
  it("writes only a bounded non-authority diagnostic when OIDC claims are unavailable", () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-diagnostic-")))
    try {
      const result = runDiagnostic(workspace)
      const summary = readFileSync(summaryPath(workspace), "utf8")

      expect(result.status).toBe(1)
      expect(result.stderr).toBe("")
      expect(JSON.parse(summary)).toMatchObject({
        artifactProducer: false,
        authorityEligible: false,
        diagnosticOnly: true,
        networkAccess: true,
        networkAccessScope: "github-actions-oidc-only",
        oidcClaimRead: false,
        oidcRequestAttempted: false,
        outcome: "blocked",
        signing: false,
      })
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(secret)
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(callerSha)
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(producerSha)
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain("example/public-gradle-app")
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(workspace)
      expect(() => readFileSync(join(workspace, ".ci", "project-finish-attestation", "receipt.json"))).toThrow()
      expect(() => readFileSync(join(workspace, ".ci", "project-finish-attestation", "predicate.json"))).toThrow()
    } finally {
      rmSync(workspace, { force: true, recursive: true })
    }
  })

  it("reads a bounded OIDC claim in memory without reflecting the claim or token", () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-diagnostic-")))
    const hookDirectory = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-oidc-hook-")))
    const hookPath = join(hookDirectory, "oidc-hook.mjs")
    const token = `header.${Buffer.from(JSON.stringify(claims())).toString("base64url")}.signature`
    try {
      writeFileSync(hookPath, oidcHook(token))
      const result = runDiagnostic(workspace, ["--import", hookPath], true)
      const summary = readFileSync(summaryPath(workspace), "utf8")

      expect(result.status).toBe(0)
      expect(JSON.parse(summary)).toMatchObject({
        authorityEligible: false,
        diagnosticOnly: true,
        networkAccess: true,
        networkAccessScope: "github-actions-oidc-only",
        oidcClaimRead: true,
        oidcRequestAttempted: true,
        outcome: "match",
        signing: false,
      })
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(secret)
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(callerSha)
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(producerSha)
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain("example/public-gradle-app")
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain("https://token.actions.githubusercontent.com/oidc")
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(token)
      expect(`${result.stdout}${result.stderr}${summary}`).not.toContain(workspace)
    } finally {
      rmSync(workspace, { force: true, recursive: true })
      rmSync(hookDirectory, { force: true, recursive: true })
    }
  })

  it("blocks an untrusted OIDC endpoint without reflecting or requesting it", () => {
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-context-diagnostic-")))
    const endpoint = `https://untrusted.example/${secret}`
    try {
      const result = runDiagnostic(workspace, [], true, endpoint)
      const summary = readFileSync(summaryPath(workspace), "utf8")
      const output = `${result.stdout}${result.stderr}${summary}`

      expect(result.status).toBe(1)
      expect(JSON.parse(summary)).toMatchObject({
        networkAccess: true,
        networkAccessScope: "github-actions-oidc-only",
        oidcClaimRead: false,
        oidcRequestAttempted: false,
        outcome: "blocked",
      })
      expect(JSON.parse(summary).diagnosticCodes).toContain(
        "project-finish-attestation-producer-context-diagnostic.2-oidc-endpoint-mismatch",
      )
      expect(output).not.toContain(secret)
      expect(output).not.toContain("untrusted.example")
    } finally {
      rmSync(workspace, { force: true, recursive: true })
    }
  })

  it("fails with a bounded code when its diagnostic workspace is unusable", () => {
    const result = spawnSync(process.execPath, [diagnosticScript], {
      cwd: root,
      encoding: "utf8",
      env: {
        PROJECT_FINISH_DIAGNOSTIC_ACTIONS: "true",
        PROJECT_FINISH_DIAGNOSTIC_WORKSPACE: `relative-${secret}`,
      },
    })

    expect(result.status).toBe(1)
    expect(result.stdout).toBe("")
    expect(result.stderr).toBe("project-finish-producer-context-diagnostic-failed\n")
    expect(`${result.stdout}${result.stderr}`).not.toContain(secret)
    expect(`${result.stdout}${result.stderr}`).not.toContain(root)
  })

  it("declares a separate reusable, least-privileged, diagnostic-only workflow", () => {
    const workflow = readFileSync(workflowPath, "utf8")

    expect(workflow).toContain("workflow_call:")
    expect(workflow).not.toContain("inputs:")
    expect(workflow).not.toContain("INPUT_")
    expect(workflow).not.toContain("workflow_dispatch:")
    expect(workflow).toContain("github.event_name == 'push'")
    expect(workflow).toContain("github.ref == 'refs/heads/main'")
    expect(workflow).toContain("github.event.repository.private == false")
    expect(workflow).toContain("git fetch origin main --no-tags >/dev/null 2>&1")
    expect(workflow).toContain("git rev-parse refs/remotes/origin/main 2>/dev/null")
    expect(workflow).toContain("contents: read")
    expect(workflow).toContain("id-token: write")
    expect(workflow).toContain("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5")
    expect(workflow).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")
    expect(workflow).toContain("uses: ./.persona-harness-producer/.github/actions/project-finish-context-diagnostic")
    expect(workflow).not.toContain("command -v node")
    expect(workflow).not.toContain("env -i")
    expect(workflow).not.toContain("attestations:")
    expect(workflow).not.toContain("artifact-metadata:")
    expect(workflow).not.toContain("actions/attest")
    expect(workflow).not.toContain("npm ")
    expect(workflow).not.toContain("build-project-finish-attestation.mjs")
    expect(workflow).not.toContain("receipt.json")
    expect(workflow).not.toContain("predicate.json")
  })
})

function runDiagnostic(
  workspace: string,
  nodeArguments: readonly string[] = [],
  includeOidcEndpoint = false,
  oidcEndpoint = "https://pipelines.actions.githubusercontent.com/oidc?api-version=7.1&serviceConnectionId=aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
) {
  return spawnSync(process.execPath, [...nodeArguments, diagnosticScript], {
    cwd: root,
    encoding: "utf8",
    env: {
      PROJECT_FINISH_DIAGNOSTIC_ACTIONS: "true",
      PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF:
        "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
      PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA: callerSha,
      PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME: "push",
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
      ...(includeOidcEndpoint
        ? {
          PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_TOKEN: secret,
          PROJECT_FINISH_DIAGNOSTIC_OIDC_REQUEST_URL: oidcEndpoint,
        }
        : {}),
    },
  })
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
