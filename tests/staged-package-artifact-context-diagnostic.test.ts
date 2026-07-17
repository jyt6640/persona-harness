import { spawnSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  assessStagedProducerContextDiagnostic,
  STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA,
  STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_WORKFLOW_REF,
} from "../scripts/staged-package-artifact-context-diagnostic-core.mjs"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "staged-producer-context-diagnostic.yml")
const scriptPath = join(root, "scripts", "diagnose-staged-package-artifact-context.mjs")

type DiagnosticContext = {
  readonly event: string
  readonly githubActions: string
  readonly ref: string
  readonly repository: string
  readonly repositoryId: string
  readonly runnerEnvironment: string
  readonly runnerOs: string
  readonly workflowRef: string
}

type DiagnosticMismatchCase = readonly [
  label: string,
  buildContext: () => DiagnosticContext,
  code: string,
  status: "mismatch" | "missing",
]

describe("staged producer context diagnostic", () => {
  it("distinguishes a workflow reference mismatch from a hosted runner mismatch without reflecting either value", () => {
    const expected = assessStagedProducerContextDiagnostic(expectedContext())
    const workflowMismatch = assessStagedProducerContextDiagnostic({
      ...expectedContext(),
      workflowRef: "jyt6640/persona-harness/.github/workflows/feature-secret.yml@refs/heads/feature/secret",
    })
    const runnerMismatch = assessStagedProducerContextDiagnostic({
      ...expectedContext(),
      runnerEnvironment: "self-hosted",
    })

    expect(expected).toMatchObject({
      artifactCreated: false,
      authorityEligible: false,
      diagnosticOnly: true,
      networkAccess: false,
      outcome: "match",
      producerPredicateCreated: false,
      registryAccess: false,
      schemaVersion: STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA,
      signing: false,
    })
    expect(workflowMismatch).toMatchObject({
      outcome: "blocked",
    })
    expect(runnerMismatch).toMatchObject({
      outcome: "blocked",
    })
    expect(workflowMismatch.fields).toContainEqual({ code: "workflow-ref", status: "mismatch" })
    expect(runnerMismatch.fields).toContainEqual({ code: "runner-environment", status: "mismatch" })
    expect(JSON.stringify(workflowMismatch)).not.toContain("feature-secret")
    expect(JSON.stringify(runnerMismatch)).not.toContain("self-hosted")
  })

  const mismatchCases: readonly DiagnosticMismatchCase[] = [
    ["missing GitHub Actions marker", () => ({ ...expectedContext(), githubActions: "" }), "github-actions", "missing"],
    ["fork repository", () => ({ ...expectedContext(), repository: "attacker/repository" }), "repository", "mismatch"],
    ["feature ref", () => ({ ...expectedContext(), ref: "refs/heads/feature/context" }), "ref", "mismatch"],
    ["reusable event", () => ({ ...expectedContext(), event: "workflow_call" }), "event", "mismatch"],
    ["legacy workflow", () => ({ ...expectedContext(), workflowRef: "jyt6640/persona-harness/.github/workflows/legacy.yml@refs/heads/main" }), "workflow-ref", "mismatch"],
    ["self-hosted runner", () => ({ ...expectedContext(), runnerEnvironment: "self-hosted" }), "runner-environment", "mismatch"],
    ["non-Linux runner", () => ({ ...expectedContext(), runnerOs: "Windows" }), "runner-os", "mismatch"],
  ]

  it.each(mismatchCases)("fails closed for %s without reflecting the supplied context", (_label, buildContext, code, status) => {
    const supplied = buildContext()
    const result = assessStagedProducerContextDiagnostic(supplied)

    expect(result.outcome).toBe("blocked")
    expect(result.fields).toContainEqual({ code, status })
    expect(JSON.stringify(result)).not.toContain(supplied.repository)
    expect(JSON.stringify(result)).not.toContain(supplied.workflowRef)
  })

  it("executes a bounded diagnostic-only CLI surface without creating a predicate or artifact", () => {
    const accepted = runDiagnostic(expectedContext())
    const hostileWorkflowRef = "jyt6640/persona-harness/.github/workflows/PH_CONTEXT_SECRET_sk-live-aaaaaaaaaaaaaaaaaaaaaaaa.yml@refs/heads/private/tmp"
    const rejected = runDiagnostic({
      ...expectedContext(),
      workflowRef: hostileWorkflowRef,
    })

    expect(accepted.status).toBe(0)
    expect(accepted.stderr).toBe("")
    expect(parseDiagnostic(accepted.stdout)).toMatchObject({
      outcome: "match",
      schemaVersion: STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA,
    })
    expect(rejected.status).toBe(1)
    expect(rejected.stderr).toBe("")
    expect(parseDiagnostic(rejected.stdout)).toMatchObject({
      outcome: "blocked",
    })
    expect(rejected.stdout).not.toContain("PH_CONTEXT_SECRET")
    expect(rejected.stdout).not.toContain("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")
    expect(rejected.stdout).not.toContain("private/tmp")
    expect(rejected.stderr).not.toContain("PH_CONTEXT_SECRET")
    expect(rejected.stderr).not.toContain("sk-live-aaaaaaaaaaaaaaaaaaaaaaaa")
    expect(rejected.stderr).not.toContain("private/tmp")
    expect(existsSync(join(root, ".ci", "staged-package-artifact-attestation"))).toBe(false)
  })

  it("declares a protected-main-only read-only workflow with no inputs, signing, registry, or artifact actions", () => {
    const workflow = readFileSync(workflowPath, "utf8")

    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).toContain("github.repository == 'jyt6640/persona-harness'")
    expect(workflow).toContain("github.ref == 'refs/heads/main'")
    expect(workflow).toContain("contents: read")
    expect(workflow).toContain("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5")
    expect(workflow).toContain("node scripts/diagnose-staged-package-artifact-context.mjs")
    expect(workflow).not.toContain("inputs:")
    expect(workflow).not.toContain("id-token:")
    expect(workflow).not.toContain("attestations:")
    expect(workflow).not.toContain("artifact-metadata:")
    expect(workflow).not.toContain("actions/attest")
    expect(workflow).not.toContain("actions/upload-artifact")
    expect(workflow).not.toContain("npm ")
    expect(workflow).not.toContain("registry")
    expect(workflow).not.toContain("git tag")
    expect(workflow).not.toContain("git push")
  })
})

function expectedContext(): DiagnosticContext {
  return {
    event: "workflow_dispatch",
    githubActions: "true",
    ref: "refs/heads/main",
    repository: "jyt6640/persona-harness",
    repositoryId: "1272008570",
    runnerEnvironment: "github-hosted",
    runnerOs: "Linux",
    workflowRef: STAGED_PRODUCER_CONTEXT_DIAGNOSTIC_WORKFLOW_REF,
  }
}

function runDiagnostic(context: DiagnosticContext) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: root,
    encoding: "utf8",
    env: {
      GITHUB_ACTIONS: context.githubActions,
      GITHUB_EVENT_NAME: context.event,
      GITHUB_REF: context.ref,
      GITHUB_REPOSITORY: context.repository,
      GITHUB_REPOSITORY_ID: context.repositoryId,
      GITHUB_WORKFLOW_REF: context.workflowRef,
      RUNNER_ENVIRONMENT: context.runnerEnvironment,
      RUNNER_OS: context.runnerOs,
    },
  })
}

function parseDiagnostic(value: string): unknown {
  return JSON.parse(value)
}
