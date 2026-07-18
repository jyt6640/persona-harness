import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const diagnosticScript = join(root, "scripts", "diagnose-project-finish-producer-context.mjs")
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish-context-diagnostic.yml")
const producerSha = gitHead()

describe("project finish context diagnostic workflow pin resolver", () => {
  it("resolves the sole diagnostic pin when the called job differs from the caller job", () => {
    const result = resolveDiagnosticPin(callerWorkflow(producerSha), "diagnose")

    expect(result).toEqual({
      output: producerSha,
      status: 0,
    })
  })

  it("advances past caller pin resolution into the bounded diagnostic layer without signing", () => {
    const pin = resolveDiagnosticPin(callerWorkflow(producerSha), "diagnose")
    const workspace = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-diagnostic-workflow-")))
    try {
      const result = spawnSync(process.execPath, [diagnosticScript], {
        cwd: root,
        encoding: "utf8",
        env: {
          PROJECT_FINISH_DIAGNOSTIC_ACTIONS: "true",
          PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_REF:
            "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
          PROJECT_FINISH_DIAGNOSTIC_CALLER_WORKFLOW_SHA:
            "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8",
          PROJECT_FINISH_DIAGNOSTIC_EVENT_NAME: "push",
          PROJECT_FINISH_DIAGNOSTIC_PRODUCER_SHA: pin.output,
          PROJECT_FINISH_DIAGNOSTIC_REF: "refs/heads/main",
          PROJECT_FINISH_DIAGNOSTIC_REPOSITORY: "example/public-gradle-app",
          PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_ID: "987654321",
          PROJECT_FINISH_DIAGNOSTIC_REPOSITORY_VISIBILITY: "public",
          PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_REF:
            "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@refs/heads/main",
          PROJECT_FINISH_DIAGNOSTIC_REUSABLE_WORKFLOW_SHA: pin.output,
          PROJECT_FINISH_DIAGNOSTIC_RUN_ATTEMPT: "1",
          PROJECT_FINISH_DIAGNOSTIC_RUN_ID: "1001",
          PROJECT_FINISH_DIAGNOSTIC_RUNNER_ENVIRONMENT: "github-hosted",
          PROJECT_FINISH_DIAGNOSTIC_RUNNER_OS: "Linux",
          PROJECT_FINISH_DIAGNOSTIC_SOURCE_HEAD:
            "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8",
          PROJECT_FINISH_DIAGNOSTIC_RUNNER_TEMP: workspace,
        },
      })
      const output = `${result.stdout}${result.stderr}`

      expect(result.status).toBe(1)
      expect(output).toContain("oidc-claims-missing")
      expect(output).not.toContain("project-finish-producer-caller-pin")
      expect(existsSync(join(workspace, ".ci", "project-finish-attestation", "receipt.json"))).toBe(false)
      expect(existsSync(join(workspace, ".ci", "project-finish-attestation", "predicate.json"))).toBe(false)
    } finally {
      rmSync(workspace, { force: true, recursive: true })
    }
  })

  it.each([
    ["mutable ref", callerWorkflow("main")],
    ["wrong repository", callerWorkflow(producerSha, "example/other")],
    ["wrong path", callerWorkflow(producerSha, "jyt6640/persona-harness", ".github/workflows/other.yml")],
    ["duplicate invocation", `${callerWorkflow(producerSha)}
  second:
    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@${producerSha}
`],
    ["malformed caller workflow", "jobs:\n  attest:\n    uses: ["],
  ])("fails closed for %s", (_label, caller) => {
    const result = resolveDiagnosticPin(caller, "diagnose")

    expect(result).toEqual({
      output: "",
      status: 1,
    })
  })

  it("does not select a caller SHA or expose a signing route", () => {
    const workflow = readFileSync(workflowPath, "utf8")

    expect(workflow).not.toContain("GITHUB_JOB:")
    expect(workflow).toContain("diagnostic-caller-workflow-sha: ${{ github.workflow_sha }}")
    expect(workflow).not.toContain("ref: ${{ github.workflow_sha }}")
    expect(workflow).toContain("matching.length !== 1")
    expect(workflow).toContain("needs.resolve.outputs.producer-sha")
    expect(workflow).toContain("needs.resolve.outputs.producer-checkout")
    expect(workflow).toContain("uses: ./.persona-harness-producer/.github/actions/project-finish-context-diagnostic")
    expect(workflow).toContain("contents: read")
    expect(workflow).toContain("id-token: write")
    expect(workflow).not.toContain("attestations:")
    expect(workflow).not.toContain("artifact-metadata:")
    expect(workflow).not.toContain("actions/attest")
    expect(workflow).not.toContain("npm ")
  })
})

function callerWorkflow(
  revision: string,
  repository = "jyt6640/persona-harness",
  workflow = ".github/workflows/persona-harness-project-finish-context-diagnostic.yml",
): string {
  return `name: Caller
jobs:
  attest:
    uses: ${repository}/${workflow}@${revision}
`
}

function resolveDiagnosticPin(caller: string, calledJob: string): { readonly output: string; readonly status: number | null } {
  const fixture = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-diagnostic-pin-")))
  const callerPath = join(fixture, ".github", "workflows", "research-attestation.yml")
  const outputPath = join(fixture, "output")
  const resolverPath = join(fixture, "resolver.cjs")
  mkdirSync(join(fixture, ".github", "workflows"), { recursive: true })
  writeFileSync(callerPath, caller)
  writeFileSync(resolverPath, diagnosticResolver())

  try {
    const result = spawnSync(process.execPath, [resolverPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        CALLER_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/research-attestation.yml@refs/heads/main",
        GITHUB_JOB: calledJob,
        GITHUB_OUTPUT: outputPath,
        GITHUB_REPOSITORY: "example/public-gradle-app",
        GITHUB_SHA: "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8",
        GITHUB_WORKSPACE: fixture,
      },
    })
    return {
      output: existsSync(outputPath) ? readFileSync(outputPath, "utf8").trim().replace("sha=", "") : "",
      status: result.status,
    }
  } finally {
    rmSync(fixture, { force: true, recursive: true })
  }
}

function diagnosticResolver(): string {
  const workflow = readFileSync(workflowPath, "utf8")
  const match = /node <<'NODE'\n(?<resolver>[\s\S]+?)\n\s*NODE\n\n      - name: Checkout immutable Persona Harness diagnostic source/u.exec(workflow)
  if (match?.groups?.resolver === undefined) throw new Error("diagnostic resolver is unavailable")
  const lines = match.groups.resolver.split("\n")
  const indentation = lines
    .filter((line) => line.trim().length > 0)
    .reduce((minimum, line) => Math.min(minimum, line.length - line.trimStart().length), Number.POSITIVE_INFINITY)
  return lines.map((line) => line.slice(indentation)).join("\n")
}

function gitHead(): string {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" })
  if (result.status !== 0) throw new Error("git head is unavailable")
  return result.stdout.trim()
}
