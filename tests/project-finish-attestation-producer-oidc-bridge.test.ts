import { copyFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"

import { afterEach, describe, expect, it } from "vitest"

import {
  runProjectFinishAttestationBuilder,
  readProjectFinishAttestationProducerContextFromToken,
} from "../scripts/build-project-finish-attestation.mjs"
import {
  runProjectFinishAttestationProducerWithCore,
} from "../scripts/project-finish-attestation-producer-oidc-capability-bridge.cjs"

const temporaryDirectories: string[] = []
const AUDIENCE = "persona-harness-project-finish-attestation"
const CALLER_SHA = "a".repeat(40)
const PRODUCER_SHA = "b".repeat(40)

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("project finish producer OIDC capability bridge", () => {
  it("blocks a raw-env-free builder before it can create receipt or predicate bytes", async () => {
    const workspace = createWorkspace()
    const result = await runProjectFinishAttestationBuilder({
      environment: producerEnvironment(workspace),
      oidcToken: undefined,
    })

    expect(result).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(existsSync(join(workspace, ".ci", "project-finish-attestation", "receipt.json"))).toBe(false)
    expect(existsSync(join(workspace, ".ci", "project-finish-attestation", "predicate.json"))).toBe(false)
    expect(readDiagnostic(workspace)).toEqual({
      code: "project-finish-producer-oidc",
      schemaVersion: "project-finish-attestation-producer-diagnostic.1",
    })
  })

  it("uses only the fixed audience and keeps an unavailable core token bounded", async () => {
    const workspace = createWorkspace()
    const marker = "PH_SECRET_TOKEN=producer-oidc-bridge"
    const calls: string[] = []
    const result = await runProjectFinishAttestationProducerWithCore({
      core: {
        getIDToken: async (audience: string) => {
          calls.push(audience)
          throw new Error(marker)
        },
      },
      environment: producerEnvironment(workspace),
    })

    expect(calls).toEqual([AUDIENCE])
    expect(result).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(JSON.stringify(result)).not.toContain(marker)
    expect(existsSync(join(workspace, ".ci", "project-finish-attestation", "receipt.json"))).toBe(false)
    expect(existsSync(join(workspace, ".ci", "project-finish-attestation", "predicate.json"))).toBe(false)
  })

  it("does not acquire a token when the fixed producer module cannot load", async () => {
    const fixture = createWorkspace()
    const bridgePath = join(fixture, "project-finish-attestation-producer-oidc-capability-bridge.cjs")
    copyFileSync(
      join(process.cwd(), "scripts", "project-finish-attestation-producer-oidc-capability-bridge.cjs"),
      bridgePath,
    )
    const bridge = await import(pathToFileURL(bridgePath).href)
    let calls = 0
    const result = await bridge.runProjectFinishAttestationProducerWithCore({
      core: {
        getIDToken: async () => {
          calls += 1
          return oidcToken(claims())
        },
      },
    })

    expect(calls).toBe(0)
    expect(result).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
  })

  it("advances a canonical token past the former OIDC boundary without writing receipt artifacts", async () => {
    const workspace = createWorkspace()
    const result = await runProjectFinishAttestationProducerWithCore({
      core: {
        getIDToken: async () => oidcToken(claims()),
      },
      environment: producerEnvironment(workspace),
    })

    expect(result).toEqual({ code: "project-finish-producer-checkout", kind: "blocked" })
    expect(readDiagnostic(workspace)).toEqual({
      code: "project-finish-producer-checkout",
      schemaVersion: "project-finish-attestation-producer-diagnostic.1",
    })
    expect(existsSync(join(workspace, ".ci", "project-finish-attestation", "receipt.json"))).toBe(false)
    expect(existsSync(join(workspace, ".ci", "project-finish-attestation", "predicate.json"))).toBe(false)
  })

  it("keeps invalid audience or issuer tokens blocked and accepts the authentic distinct caller and producer shape", () => {
    const workspace = createWorkspace()
    const invalid = readProjectFinishAttestationProducerContextFromToken(
      oidcToken({ ...claims(), aud: "caller-controlled" }),
      producerEnvironment(workspace),
    )
    const wrongIssuer = readProjectFinishAttestationProducerContextFromToken(
      oidcToken({ ...claims(), iss: "https://untrusted.example" }),
      producerEnvironment(workspace),
    )
    const valid = readProjectFinishAttestationProducerContextFromToken(
      oidcToken(claims()),
      producerEnvironment(workspace),
    )

    expect(invalid).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(wrongIssuer).toEqual({ code: "project-finish-producer-oidc", kind: "blocked" })
    expect(valid).toMatchObject({
      kind: "ready",
      value: {
        callerWorkflowSha: CALLER_SHA,
        reusableWorkflowSha: PRODUCER_SHA,
        sourceHead: CALLER_SHA,
      },
    })
  })

  it("does not route hostile aliases or raw OIDC request fields into the bridge", () => {
    const bridge = readFileSync(
      join(process.cwd(), "scripts", "project-finish-attestation-producer-oidc-capability-bridge.cjs"),
      "utf8",
    )

    expect(bridge).toContain("PRODUCER_ENVIRONMENT_KEYS")
    expect(bridge).not.toContain("ACTIONS_ID_TOKEN_REQUEST_")
    expect(bridge).not.toContain("process.env.PATH")
    expect(bridge).not.toContain("core.setOutput")
  })
})

function producerEnvironment(workspace: string): NodeJS.ProcessEnv {
  return {
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "push",
    GITHUB_REF: "refs/heads/main",
    GITHUB_REPOSITORY: "example/public-gradle-app",
    GITHUB_REPOSITORY_ID: "123",
    GITHUB_REPOSITORY_VISIBILITY: "public",
    GITHUB_RUN_ATTEMPT: "1",
    GITHUB_RUN_ID: "42",
    GITHUB_SHA: CALLER_SHA,
    GITHUB_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
    GITHUB_WORKFLOW_SHA: CALLER_SHA,
    GITHUB_WORKSPACE: workspace,
    PERSONA_HARNESS_PRODUCER_SHA: PRODUCER_SHA,
  }
}

function claims(): Record<string, string> {
  return {
    aud: AUDIENCE,
    event_name: "push",
    iss: "https://token.actions.githubusercontent.com",
    job_workflow_ref: `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${PRODUCER_SHA}`,
    job_workflow_sha: PRODUCER_SHA,
    ref: "refs/heads/main",
    repository: "example/public-gradle-app",
    repository_id: "123",
    repository_visibility: "public",
    run_attempt: "1",
    run_id: "42",
    runner_environment: "github-hosted",
    workflow_ref: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
    workflow_sha: CALLER_SHA,
  }
}

function oidcToken(payload: Record<string, string>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`
}

function readDiagnostic(workspace: string): unknown {
  return JSON.parse(readFileSync(join(workspace, ".ci", "project-finish-attestation", "failure-diagnostic.json"), "utf8"))
}

function createWorkspace(): string {
  const directory = mkdtempSync(join(tmpdir(), "project-finish-producer-oidc-bridge-"))
  temporaryDirectories.push(directory)
  return realpathSync(directory)
}
