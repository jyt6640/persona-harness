import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish.yml")
const scriptPath = join(root, "scripts", "build-project-finish-attestation.mjs")
const callerFixturePath = join(root, "tests", "fixtures", "project-finish-attestation", "caller-workflow.yml")

describe("project finish attestation producer workflow contract", () => {
  it("declares a pinned reusable producer with no caller-controlled inputs", () => {
    expect(existsSync(workflowPath)).toBe(true)
    expect(existsSync(scriptPath)).toBe(true)

    const workflow = readFileSync(workflowPath, "utf8")

    expect(workflow).toContain("workflow_call:")
    expect(workflow).not.toContain("workflow_dispatch:")
    expect(workflow).not.toContain("\n  inputs:")
    expect(workflow).toContain("github.event_name == 'push'")
    expect(workflow).toContain("github.ref == 'refs/heads/main'")
    expect(workflow).toContain("github.event.repository.private == false")
    expect(workflow).toContain("actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5")
    expect(workflow).toContain("actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020")
    expect(workflow).toContain("actions/attest@ce27ba3b4a9a139d9a20a4a07d69fabb52f1e5bc")
    expect(workflow).toContain("actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02")
    expect(workflow).toContain("subject-path: .ci/project-finish-attestation/receipt.json")
    expect(workflow).toContain("predicate-path: .ci/project-finish-attestation/predicate.json")
    expect(workflow).toContain("project-finish-attestation.1")
    expect(workflow).toContain("if: always()")
    expect(workflow).toContain("failure-diagnostic.json")
    expect(workflow).toContain("contents: read")
    expect(workflow).toContain("id-token: write")
    expect(workflow).toContain("attestations: write")
    expect(workflow).toContain("artifact-metadata: write")
    expect(workflow).not.toContain("contents: write")
    expect(workflow).not.toContain("npm publish")
    expect(workflow).not.toContain("git tag")
    expect(workflow).not.toContain("git push")
    expect(workflow).not.toContain("workflow finish")
    expect(workflow).toContain("id: producer-pin")
    expect(workflow).toContain("ref: ${{ steps.producer-pin.outputs.sha }}")
    expect(workflow).not.toContain("ref: ${{ github.workflow_sha }}")
  })

  it("uses only platform-derived OIDC workflow claims in the bounded artifact builder", () => {
    const source = readFileSync(scriptPath, "utf8")

    expect(source).toContain("ACTIONS_ID_TOKEN_REQUEST_URL")
    expect(source).toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    expect(source).toContain("job_workflow_ref")
    expect(source).toContain("job_workflow_sha")
    expect(source).toContain("workflow_ref")
    expect(source).toContain("workflow_sha")
    expect(source).toContain("PERSONA_HARNESS_PRODUCER_SHA")
    expect(source).not.toContain('requiredEnv("GITHUB_WORKFLOW_SHA")')
    expect(source).toContain("runProjectFinishAttestationProducer")
    expect(source).not.toContain("--repository")
    expect(source).not.toContain("--workflow")
    expect(source).not.toContain("--command")
    expect(source).not.toContain("npm publish")
  })

  it("keeps the postmerge caller path pinned to an immutable reusable workflow SHA", () => {
    expect(existsSync(callerFixturePath)).toBe(true)

    const caller = readFileSync(callerFixturePath, "utf8")

    expect(caller).toContain("push:")
    expect(caller).toContain("- main")
    expect(caller).toMatch(
      /uses: jyt6640\/persona-harness\/\.github\/workflows\/persona-harness-project-finish\.yml@[a-f0-9]{40}/u,
    )
    expect(caller).not.toContain("@main")
  })

  it.each([
    ["caller SHA differs from the producer pin", callerWorkflow("b".repeat(40)), "b".repeat(40)],
    ["a full immutable producer pin", callerWorkflow("c".repeat(40)), "c".repeat(40)],
  ])("derives the producer checkout SHA from %s", (_name, caller, expectedSha) => {
    expect(resolveProducerPin(caller)).toBe(expectedSha)
  })

  it.each([
    ["mutable branch", callerWorkflow("main")],
    ["mutable tag", callerWorkflow("v0.7.0")],
    ["wrong producer repository", callerWorkflow("d".repeat(40), "example/other")],
    ["wrong workflow path", callerWorkflow("e".repeat(40), "jyt6640/persona-harness", ".github/workflows/other.yml")],
    ["duplicate producer invocation", `${callerWorkflow("f".repeat(40))}
  duplicate:
    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"f".repeat(40)}
`],
    ["duplicate uses mapping key", `jobs:
  attest:
    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"0".repeat(40)}
    uses: jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${"1".repeat(40)}
`],
    ["malformed caller workflow", "jobs:\n  attest:\n    uses: ["],
  ])("fails closed for %s caller workflow declarations", (_name, caller) => {
    expect(() => resolveProducerPin(caller)).toThrow("project-finish-producer-caller-pin")
  })
})

function callerWorkflow(
  revision: string,
  repository = "jyt6640/persona-harness",
  workflow = ".github/workflows/persona-harness-project-finish.yml",
): string {
  return `name: Caller
jobs:
  attest:
    uses: ${repository}/${workflow}@${revision}
`
}

function resolveProducerPin(callerWorkflowSource: string): string {
  const workflow = readFileSync(workflowPath, "utf8")
  const resolver = rubyResolver(workflow)
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "project-finish-producer-caller-pin-"))
  const fixtureRoot = realpathSync(fixtureDirectory)
  const callerPath = join(fixtureRoot, ".github", "workflows", "caller.yml")
  const outputPath = join(fixtureRoot, "output")
  const resolverPath = join(fixtureRoot, "resolver.rb")
  mkdirSync(join(fixtureRoot, ".github", "workflows"), { recursive: true })
  writeFileSync(callerPath, callerWorkflowSource)
  writeFileSync(resolverPath, resolver)

  try {
    execFileSync("ruby", [resolverPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        CALLER_WORKFLOW_PATH: callerPath,
        GITHUB_REPOSITORY: "example/public-gradle-app",
        GITHUB_JOB: "attest",
        GITHUB_OUTPUT: outputPath,
        CALLER_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/caller.yml@refs/heads/main",
        GITHUB_WORKSPACE: fixtureRoot,
      },
    })
    return readFileSync(outputPath, "utf8").trim().replace("sha=", "")
  } catch {
    throw new Error("project-finish-producer-caller-pin")
  } finally {
    rmSync(fixtureDirectory, { force: true, recursive: true })
  }
}

function rubyResolver(workflow: string): string {
  const match = /# BEGIN PRODUCER_PIN_RESOLVER\n(?<resolver>[\s\S]+?)# END PRODUCER_PIN_RESOLVER/u.exec(workflow)
  if (match?.groups?.resolver === undefined) {
    throw new Error("project-finish-producer-caller-pin")
  }
  const lines = match.groups.resolver.split("\n")
  const indentation = lines
    .filter((line) => line.trim().length > 0)
    .reduce((minimum, line) => Math.min(minimum, line.length - line.trimStart().length), Number.POSITIVE_INFINITY)
  return lines.map((line) => line.slice(indentation)).join("\n")
}
