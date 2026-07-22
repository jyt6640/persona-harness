import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

import { describe, expect, it } from "vitest"

const callerSha = "7fa113b0d75e3b0f650076949e6178bb4f94dc72"
const producerSha = "937656627e203ccf33e2008ae932f7b431545753"
const secretMarker = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
const contextModule = pathToFileURL(
  `${process.cwd()}/scripts/project-finish-attestation-producer-context.mjs`,
).href

describe("project finish attestation producer context", () => {
  it("keeps the caller workflow SHA distinct from the immutable reusable producer SHA", () => {
    const result = deriveContext(contextInput())

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(JSON.parse(result.stdout)).toMatchObject({
      callerWorkflowSha: callerSha,
      reusableWorkflowSha: producerSha,
      sourceHead: callerSha,
    })
  })

  it.each([
    ["caller workflow SHA", {
      claims: { workflow_sha: "a".repeat(40) },
    }],
    ["observed caller workflow SHA", {
      environment: { GITHUB_WORKFLOW_SHA: "a".repeat(40) },
    }],
    ["observed caller workflow ref", {
      environment: {
        GITHUB_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/other.yml@refs/heads/main",
      },
    }],
    ["event", {
      claims: { event_name: "pull_request" },
    }],
    ["ref", {
      claims: { ref: "refs/heads/feature" },
    }],
    ["reusable workflow identity", {
      claims: {
        job_workflow_ref: "example/other/.github/workflows/persona-harness-project-finish.yml@refs/heads/main",
      },
    }],
    ["reusable workflow ref", {
      claims: {
        job_workflow_ref: "jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@refs/heads/feature",
      },
    }],
    ["unrecognized reusable workflow SHA", {
      claims: { job_workflow_sha: "b".repeat(40) },
    }],
    ["parsed producer SHA", {
      claims: {
        job_workflow_sha: producerSha,
      },
      environment: { PERSONA_HARNESS_PRODUCER_SHA: "c".repeat(40) },
    }],
    ["repository", {
      claims: { repository: "example/private-repository" },
    }],
    ["repository ID", {
      environment: { GITHUB_REPOSITORY_ID: "123" },
    }],
    ["explicit caller visibility", {
      environment: { PERSONA_HARNESS_CALLER_VISIBILITY: "private" },
    }],
    ["secret-shaped explicit caller visibility", {
      environment: { PERSONA_HARNESS_CALLER_VISIBILITY: secretMarker },
    }],
    ["missing explicit caller visibility", {
      environment: { PERSONA_HARNESS_CALLER_VISIBILITY: "" },
    }],
    ["run ID", {
      claims: { run_id: "1002" },
    }],
    ["run attempt", {
      claims: { run_attempt: "2" },
    }],
    ["runner environment", {
      claims: { runner_environment: "self-hosted" },
    }],
    ["observed runner environment", {
      environment: { RUNNER_ENVIRONMENT: "self-hosted" },
    }],
    ["runner OS", {
      environment: { RUNNER_OS: "Windows" },
    }],
    ["secret-shaped caller ref", {
      claims: {
        workflow_ref: `example/public-gradle-app/.github/workflows/${secretMarker}.yml@refs/heads/main`,
      },
    }],
  ])("fails closed for a mismatched %s without reflecting it", (_name, override) => {
    const result = deriveContext(contextInput(override))
    const rendered = `${result.stdout}${result.stderr}`

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("project-finish-producer-context")
    expect(rendered).not.toContain(secretMarker)
  })
})

function contextInput(override: {
  readonly claims?: Record<string, string>
  readonly environment?: Record<string, string>
} = {}): {
  readonly claims: Record<string, string>
  readonly environment: Record<string, string>
} {
  return {
    claims: {
      job_workflow_ref:
        `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${producerSha}`,
      job_workflow_sha: producerSha,
      event_name: "push",
      repository: "example/public-gradle-app",
      repository_id: "987654321",
      repository_visibility: "public",
      ref: "refs/heads/main",
      run_attempt: "1",
      run_id: "1001",
      runner_environment: "github-hosted",
      workflow_ref: "example/public-gradle-app/.github/workflows/research-attestation.yml@refs/heads/main",
      workflow_sha: callerSha,
      ...override.claims,
    },
    environment: {
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: "example/public-gradle-app",
      GITHUB_REPOSITORY_ID: "987654321",
      GITHUB_REPOSITORY_VISIBILITY: "public",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_RUN_ID: "1001",
      GITHUB_SHA: callerSha,
      GITHUB_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/research-attestation.yml@refs/heads/main",
      GITHUB_WORKFLOW_SHA: callerSha,
      PERSONA_HARNESS_CALLER_VISIBILITY: "public",
      PERSONA_HARNESS_PRODUCER_SHA: producerSha,
      RUNNER_ENVIRONMENT: "github-hosted",
      RUNNER_OS: "Linux",
      ...override.environment,
    },
  }
}

function deriveContext(input: ReturnType<typeof contextInput>): {
  readonly status: number | null
  readonly stderr: string
  readonly stdout: string
} {
  const source = [
    `import { deriveProjectFinishProducerContext } from ${JSON.stringify(contextModule)};`,
    "const input = JSON.parse(process.env.PROJECT_FINISH_CONTEXT_INPUT);",
    "try {",
    "  process.stdout.write(JSON.stringify(deriveProjectFinishProducerContext(input.claims, input.environment)));",
    "} catch (error) {",
    "  process.stderr.write(error instanceof Error ? error.message : 'project-finish-producer-context');",
    "  process.exitCode = 1;",
    "}",
  ].join("\n")
  const result = spawnSync(process.execPath, ["--input-type=module", "--eval", source], {
    encoding: "utf8",
    env: {
      ...process.env,
      PROJECT_FINISH_CONTEXT_INPUT: JSON.stringify(input),
    },
  })

  return {
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  }
}
