import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  STAGED_PACKAGE_ARTIFACT_REPOSITORY,
  STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID,
  STAGED_PACKAGE_ARTIFACT_RUNNER_LABEL,
  STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF,
} from "../scripts/staged-package-artifact-attestation-core.mjs"
import {
  assessNativeStagedProducerContext,
  STAGED_PACKAGE_ARTIFACT_NATIVE_CONTEXT_DIAGNOSTIC_SCHEMA,
} from "../scripts/staged-package-artifact-native-context-diagnostic.mjs"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "staged-package-artifact-attestation.yml")
const diagnosticPath = join(root, "scripts", "diagnose-native-staged-package-artifact-context.mjs")
const HEAD = "a".repeat(40)
const SECRET = "PH_NATIVE_CONTEXT_SECRET_sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

type NativeContext = {
  readonly contextHead: string
  readonly event: string
  readonly githubActions: string
  readonly ref: string
  readonly repository: string
  readonly repositoryId: string
  readonly runnerEnvironment: string
  readonly runnerLabel: string
  readonly runnerOs: string
  readonly workflowRef: string
  readonly workflowSha: string
}

describe("native staged producer context diagnostic", () => {
  it("uses the real producer workflow identity and reports only allowlisted context statuses", () => {
    const result = assessNativeStagedProducerContext(expectedContext())

    expect(result).toMatchObject({
      artifactCreated: false,
      authorityEligible: false,
      diagnosticOnly: true,
      networkAccess: false,
      outcome: "match",
      producerPredicateCreated: false,
      registryAccess: false,
      schemaVersion: STAGED_PACKAGE_ARTIFACT_NATIVE_CONTEXT_DIAGNOSTIC_SCHEMA,
      signing: false,
    })
    expect(result.fields).toEqual(expect.arrayContaining([
      { code: "repository-id", status: "match" },
      { code: "runner-environment", status: "match" },
      { code: "runner-os", status: "match" },
      { code: "workflow-ref", status: "match" },
      { code: "workflow-sha-equality", status: "match" },
    ]))
    expect(JSON.stringify(result)).not.toContain("staged-producer-context-diagnostic.yml")
    expect(JSON.stringify(result)).not.toContain("ubuntu-latest")
  })

  it.each([
    ["repository ID", () => ({ ...expectedContext(), repositoryId: "999999" }), "repository-id"],
    ["workflow ref", () => ({ ...expectedContext(), workflowRef: `jyt6640/persona-harness/.github/workflows/${SECRET}.yml@refs/heads/main` }), "workflow-ref"],
    ["runner environment", () => ({ ...expectedContext(), runnerEnvironment: "self-hosted" }), "runner-environment"],
    ["runner OS", () => ({ ...expectedContext(), runnerOs: "Windows" }), "runner-os"],
    ["workflow SHA equality", () => ({ ...expectedContext(), workflowSha: "b".repeat(40) }), "workflow-sha-equality"],
  ] as const)("blocks a mismatched %s without reflecting the supplied value", (_label, buildContext, code) => {
    const supplied = buildContext()
    const result = assessNativeStagedProducerContext(supplied)
    const serialized = JSON.stringify(result)

    expect(result.outcome).toBe("blocked")
    expect(result.fields).toContainEqual({ code, status: "mismatch" })
    expect(serialized).not.toContain(SECRET)
    expect(serialized).not.toContain("self-hosted")
    expect(serialized).not.toContain("999999")
    expect(serialized).not.toContain("Windows")
    expect(serialized).not.toContain("b".repeat(40))
  })

  it("runs diagnostic mode without using caller inputs or creating a predicate artifact", () => {
    const workspace = mkdtempSync(join(tmpdir(), "native-staged-context-diagnostic-"))
    try {
      const accepted = runDiagnostic(workspace, expectedContext(), {
        INPUT_CHANNEL: SECRET,
        INPUT_MODE: "diagnose",
        INPUT_VERSION: "/private/tmp/hostile-version",
      })
      const rejected = runDiagnostic(workspace, {
        ...expectedContext(),
        workflowRef: `jyt6640/persona-harness/.github/workflows/${SECRET}.yml@refs/heads/main`,
      }, {
        INPUT_CHANNEL: SECRET,
        INPUT_MODE: "diagnose",
        INPUT_VERSION: "/private/tmp/hostile-version",
      })

      expect(accepted.status).toBe(0)
      expect(accepted.stderr).toBe("")
      expect(JSON.parse(accepted.stdout)).toMatchObject({
        diagnosticOnly: true,
        networkAccess: false,
        outcome: "match",
        registryAccess: false,
        signing: false,
      })
      expect(rejected.status).toBe(1)
      expect(rejected.stderr).toBe("")
      expect(JSON.parse(rejected.stdout)).toMatchObject({
        outcome: "blocked",
      })
      expect(`${accepted.stdout}${accepted.stderr}${rejected.stdout}${rejected.stderr}`).not.toContain(SECRET)
      expect(`${accepted.stdout}${accepted.stderr}${rejected.stdout}${rejected.stderr}`).not.toContain("/private/tmp")
      expect(`${accepted.stdout}${accepted.stderr}${rejected.stdout}${rejected.stderr}`).not.toContain("ubuntu-latest")
      expect(existsSync(join(workspace, ".ci", "staged-package-artifact-attestation"))).toBe(false)
    } finally {
      rmSync(workspace, { force: true, recursive: true })
    }
  })

  it("splits native diagnostic mode into a least-privileged job before the producer job", () => {
    const workflow = readFileSync(workflowPath, "utf8")
    const diagnosticStart = workflow.indexOf("  diagnose:")
    const attestStart = workflow.indexOf("  attest:")
    const diagnosticJob = workflow.slice(diagnosticStart, attestStart)
    const attestJob = workflow.slice(attestStart)

    expect(workflow).toContain("mode:")
    expect(workflow).toContain("default: produce")
    expect(workflow).toContain("          - produce")
    expect(workflow).toContain("          - diagnose")
    expect(diagnosticStart).toBeGreaterThanOrEqual(0)
    expect(attestStart).toBeGreaterThan(diagnosticStart)
    expect(diagnosticJob).toContain("inputs.mode == 'diagnose'")
    expect(diagnosticJob).toContain("contents: read")
    expect(diagnosticJob).toContain("node scripts/diagnose-native-staged-package-artifact-context.mjs")
    expect(diagnosticJob).not.toContain("id-token:")
    expect(diagnosticJob).not.toContain("attestations:")
    expect(diagnosticJob).not.toContain("artifact-metadata:")
    expect(diagnosticJob).not.toContain("actions/attest")
    expect(diagnosticJob).not.toContain("actions/upload-artifact")
    expect(diagnosticJob).not.toContain("build-staged-package-artifact-attestation")
    expect(diagnosticJob).not.toContain(".ci/staged-package-artifact-attestation")
    expect(diagnosticJob).not.toContain("npm ")
    expect(diagnosticJob).not.toContain("registry")
    expect(attestJob).toContain("inputs.mode == 'produce'")
    expect(attestJob).toContain("id-token: write")
    expect(attestJob).toContain("actions/attest@ce27ba3b4a9a139d9a20a4a07d69fabb52f1e5bc")
    expect(attestJob).toContain("node scripts/build-staged-package-artifact-attestation.mjs")
  })
})

function expectedContext(): NativeContext {
  return {
    contextHead: HEAD,
    event: "workflow_dispatch",
    githubActions: "true",
    ref: "refs/heads/main",
    repository: STAGED_PACKAGE_ARTIFACT_REPOSITORY,
    repositoryId: String(STAGED_PACKAGE_ARTIFACT_REPOSITORY_ID),
    runnerEnvironment: "github-hosted",
    runnerLabel: STAGED_PACKAGE_ARTIFACT_RUNNER_LABEL,
    runnerOs: "Linux",
    workflowRef: STAGED_PACKAGE_ARTIFACT_WORKFLOW_REF,
    workflowSha: HEAD,
  }
}

function runDiagnostic(
  workspace: string,
  context: NativeContext,
  callerInputs: Readonly<Record<string, string>>,
) {
  return spawnSync(process.execPath, [diagnosticPath], {
    cwd: workspace,
    encoding: "utf8",
    env: {
      GITHUB_ACTIONS: context.githubActions,
      GITHUB_EVENT_NAME: context.event,
      GITHUB_REF: context.ref,
      GITHUB_REPOSITORY: context.repository,
      GITHUB_REPOSITORY_ID: context.repositoryId,
      GITHUB_SHA: context.contextHead,
      GITHUB_WORKFLOW_REF: context.workflowRef,
      GITHUB_WORKFLOW_SHA: context.workflowSha,
      RUNNER_ENVIRONMENT: context.runnerEnvironment,
      RUNNER_OS: context.runnerOs,
      ...callerInputs,
    },
  })
}
