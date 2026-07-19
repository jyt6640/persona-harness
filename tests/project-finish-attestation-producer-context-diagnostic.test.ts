import { describe, expect, it } from "vitest"

import {
  assessProjectFinishProducerContextDiagnostic,
  PROJECT_FINISH_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA,
} from "../scripts/project-finish-attestation-producer-context-diagnostic.mjs"

const callerSha = "2a8ddd2838bb655219d7f5408ee3c8688eb3f6e8"
const producerSha = "02b590429b559def7fabc7e05a0ced975dc88f86"
const hostedCallerSha = "e171cb0fd5e4b9cff76f235e62a4958c57658210"
const hostedProducerSha = "8a3d6b068ef61b47d9d734b9de8d24a91271388b"
const hostedRepository = "jyt6640/persona-harness-attestation-claim-fixture"
const hostedRepositoryId = "1304576182"
const hostedRunId = "29674006647"
const secret = "PH_CONTEXT_SECRET_sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"

describe("project finish producer context diagnostic", () => {
  it("reports only matching bounded context statuses for the fixed diagnostic identity", () => {
    const result = assessProjectFinishProducerContextDiagnostic(context())

    expect(result).toMatchObject({
      artifactProducer: false,
      authorityEligible: false,
      diagnosticOnly: true,
      networkAccess: true,
      networkAccessScope: "github-actions-oidc-only",
      oidcClaimRead: true,
      oidcRequestAttempted: true,
      outcome: "match",
      predicateCreated: false,
      receiptCreated: false,
      registryAccess: false,
      schemaVersion: PROJECT_FINISH_PRODUCER_CONTEXT_DIAGNOSTIC_SCHEMA,
      signing: false,
    })
    expect(result.fields).toEqual(expect.arrayContaining([
      { code: "caller-workflow-sha", status: "match" },
      { code: "producer-checkout", status: "match" },
      { code: "reusable-workflow-ref", status: "match" },
      { code: "reusable-workflow-sha", status: "match" },
      { code: "runner-environment", status: "match" },
      { code: "runner-os", status: "match" },
      { code: "source-head", status: "match" },
    ]))
    expect(result.fields.every((field) => ["match", "missing", "mismatch"].includes(field.status))).toBe(true)
  })

  it("accepts the immutable reusable workflow ref from the authentic caller shape", () => {
    const result = assessProjectFinishProducerContextDiagnostic(context())

    expect(result.outcome).toBe("match")
    expect(result.fields).toContainEqual({ code: "reusable-workflow-ref", status: "match" })
  })

  it("keeps the observed caller and reusable revision identities distinct", () => {
    const result = assessProjectFinishProducerContextDiagnostic({
      claims: {
        ...context().claims,
        job_workflow_ref:
          `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@${hostedProducerSha}`,
        job_workflow_sha: hostedProducerSha,
        repository: hostedRepository,
        repository_id: hostedRepositoryId,
        run_id: hostedRunId,
        workflow_ref:
          `${hostedRepository}/.github/workflows/research-attestation.yml@refs/heads/main`,
        workflow_sha: hostedCallerSha,
      },
      environment: {
        ...context().environment,
        GITHUB_REPOSITORY: hostedRepository,
        GITHUB_REPOSITORY_ID: hostedRepositoryId,
        GITHUB_RUN_ID: hostedRunId,
        GITHUB_SHA: hostedCallerSha,
        GITHUB_WORKFLOW_REF:
          `${hostedRepository}/.github/workflows/research-attestation.yml@refs/heads/main`,
        GITHUB_WORKFLOW_SHA: hostedCallerSha,
        PERSONA_HARNESS_DIAGNOSTIC_WORKFLOW_REF:
          `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@${hostedProducerSha}`,
        PERSONA_HARNESS_DIAGNOSTIC_WORKFLOW_SHA: hostedProducerSha,
        PERSONA_HARNESS_PRODUCER_SHA: hostedProducerSha,
      },
      producerCheckout: "match" as const,
    })

    expect(result.outcome).toBe("match")
    expect(result.fields).toEqual(expect.arrayContaining([
      { code: "caller-workflow-sha", status: "match" },
      { code: "reusable-workflow-sha", status: "match" },
      { code: "source-head", status: "match" },
    ]))
  })

  it.each([
    ["caller SHA", () => ({ ...context(), claims: { ...context().claims, workflow_sha: "a".repeat(40) } }), "caller-workflow-sha"],
    ["reusable SHA", () => ({ ...context(), claims: { ...context().claims, job_workflow_sha: "b".repeat(40) } }), "reusable-workflow-sha"],
    ["reusable ref", () => ({ ...context(), claims: { ...context().claims, job_workflow_ref: "jyt6640/persona-harness/.github/workflows/other.yml@refs/heads/main" } }), "reusable-workflow-ref"],
    ["repository", () => ({ ...context(), claims: { ...context().claims, repository: "attacker/repository" } }), "repository"],
    ["repository ID", () => ({ ...context(), claims: { ...context().claims, repository_id: "1" } }), "repository-id"],
    ["event", () => ({ ...context(), claims: { ...context().claims, event_name: "pull_request" } }), "event"],
    ["runner environment", () => ({ ...context(), claims: { ...context().claims, runner_environment: "self-hosted" } }), "runner-environment"],
    ["runner OS", () => ({ ...context(), environment: { ...context().environment, RUNNER_OS: "Windows" } }), "runner-os"],
    ["run ID", () => ({ ...context(), claims: { ...context().claims, run_id: "1002" } }), "run-id"],
    ["run attempt", () => ({ ...context(), claims: { ...context().claims, run_attempt: "2" } }), "run-attempt"],
    ["producer checkout", () => ({ ...context(), producerCheckout: "mismatch" as const }), "producer-checkout"],
    ["parsed producer pin", () => ({
      ...context(),
      environment: { ...context().environment, PERSONA_HARNESS_PRODUCER_SHA: "not-an-immutable-sha" },
    }), "producer-pin"],
    ["missing claims", () => ({ ...context(), claims: undefined }), "oidc-claims"],
    ["secret-shaped workflow ref", () => ({
      ...context(),
      claims: {
        ...context().claims,
        workflow_ref: `example/public-gradle-app/.github/workflows/${secret}.yml@refs/heads/main`,
      },
    }), "caller-workflow-ref"],
  ] as const)("blocks %s without reflecting untrusted values", (_label, createContext, code) => {
    const supplied = createContext()
    const result = assessProjectFinishProducerContextDiagnostic(supplied)
    const rendered = JSON.stringify(result)

    expect(result.outcome).toBe("blocked")
    expect(result.fields).toContainEqual({ code, status: expect.any(String) })
    expect(rendered).not.toContain(secret)
    expect(rendered).not.toContain("attacker/repository")
    expect(rendered).not.toContain("self-hosted")
    expect(rendered).not.toContain("Windows")
  })

  it("reports an untrusted OIDC endpoint as a bounded mismatch without reflecting it", () => {
    const result = assessProjectFinishProducerContextDiagnostic({
      ...context(),
      oidcEndpointStatus: "mismatch",
      oidcRequestAttempted: false,
    })
    const rendered = JSON.stringify(result)

    expect(result.outcome).toBe("blocked")
    expect(result.networkAccess).toBe(true)
    expect(result.networkAccessScope).toBe("github-actions-oidc-only")
    expect(result.oidcRequestAttempted).toBe(false)
    expect(result.fields).toContainEqual({ code: "oidc-endpoint", status: "mismatch" })
    expect(rendered).not.toContain(secret)
  })

})

function context(): {
  readonly claims?: Record<string, string>
  readonly environment: Record<string, string>
  readonly producerCheckout: "match"
} {
  return {
    claims: {
      event_name: "push",
      job_workflow_ref:
        "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@02b590429b559def7fabc7e05a0ced975dc88f86",
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
    },
    environment: {
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: "example/public-gradle-app",
      GITHUB_REPOSITORY_ID: "987654321",
      GITHUB_REPOSITORY_VISIBILITY: "public",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_RUN_ID: "1001",
      GITHUB_SHA: callerSha,
      GITHUB_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/project-finish-context-diagnostic.yml@refs/heads/main",
      GITHUB_WORKFLOW_SHA: callerSha,
      PERSONA_HARNESS_DIAGNOSTIC_WORKFLOW_REF:
        "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish-context-diagnostic.yml@02b590429b559def7fabc7e05a0ced975dc88f86",
      PERSONA_HARNESS_DIAGNOSTIC_WORKFLOW_SHA: producerSha,
      PERSONA_HARNESS_PRODUCER_SHA: producerSha,
      RUNNER_ENVIRONMENT: "github-hosted",
      RUNNER_OS: "Linux",
    },
    producerCheckout: "match",
  }
}
