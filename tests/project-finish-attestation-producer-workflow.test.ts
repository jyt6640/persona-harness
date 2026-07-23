import { execFileSync } from "node:child_process"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { resolveProjectFinishAttestationCallerWorkspace } from "../scripts/build-project-finish-attestation.mjs"

const root = process.cwd()
const workflowPath = join(root, ".github", "workflows", "persona-harness-project-finish.yml")
const scriptPath = join(root, "scripts", "build-project-finish-attestation.mjs")
const artifactOutputPath = join(root, "scripts", "project-finish-attestation-artifact-output.mjs")
const contextPath = join(root, "scripts", "project-finish-attestation-producer-context.mjs")
const oidcPath = join(root, "scripts", "project-finish-attestation-oidc.mjs")
const callerFixturePath = join(root, "tests", "fixtures", "project-finish-attestation", "caller-workflow.yml")
const diagnosticPath = join(root, "scripts", "project-finish-attestation-producer-context-diagnostic.mjs")
const producerGuidePath = join(root, "docs", "current", "release", "project-finish-attestation-producer.md")

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
    expect(workflow).toContain("path: .project-finish-caller")
    expect(workflow).toContain("working-directory: .project-finish-caller")
    expect(workflow).toContain("subject-path: .project-finish-attestation-artifacts/receipt.json")
    expect(workflow).toContain("predicate-path: .project-finish-attestation-artifacts/predicate.json")
    expect(workflow).toContain("include-hidden-files: true")
    expect(workflow).toContain(".project-finish-attestation-artifacts/receipt.json")
    expect(workflow).toContain(".project-finish-attestation-artifacts/predicate.json")
    expect(workflow).toContain(".project-finish-attestation-artifacts/bundle.json")
    expect(workflow).toContain("project-finish-attestation-artifact-handoff.mjs")
    expect(workflow).not.toContain('run: cp "${{ steps.attest.outputs.bundle-path }}"')
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
    expect(workflow).toContain("node <<'NODE'")
    expect(workflow).toContain("ref: ${{ steps.producer-pin.outputs.sha }}")
    expect(workflow).toContain("working-directory: .persona-harness-producer")
    expect(workflow).toContain("node scripts/verify-project-finish-producer-checkout.mjs")
    expect(workflow).not.toContain("ref: ${{ github.workflow_sha }}")
    expect(workflow).not.toContain("ruby <<")
  })

  it("uses only platform-derived OIDC workflow claims in the bounded artifact builder", () => {
    const source = readFileSync(scriptPath, "utf8")
    const context = readFileSync(contextPath, "utf8")
    const oidc = readFileSync(oidcPath, "utf8")
    const diagnostic = readFileSync(diagnosticPath, "utf8")
    const workflow = readFileSync(workflowPath, "utf8")

    expect(oidc).toContain("ACTIONS_ID_TOKEN_REQUEST_URL")
    expect(oidc).toContain("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    expect(oidc).toContain("pipelines.actions.githubusercontent.com")
    expect(oidc).not.toContain("followRedirect")
    expect(diagnostic).toContain("networkAccess: true")
    expect(diagnostic).toContain('networkAccessScope: "github-actions-oidc-only"')
    expect(diagnostic).not.toContain("networkAccess: false")
    expect(context).toContain("job_workflow_ref")
    expect(context).toContain("job_workflow_sha")
    expect(context).toContain("workflow_ref")
    expect(context).toContain("workflow_sha")
    expect(context).toContain("PERSONA_HARNESS_PRODUCER_SHA")
    expect(source).toContain("deriveProjectFinishProducerContext")
    expect(source).toContain("readProjectFinishAttestationProducerOidcClaims")
    expect(source).toContain("verifyProjectFinishProducerCheckout")
    expect(source).not.toContain('requiredEnv("GITHUB_WORKFLOW_SHA")')
    expect(source).toContain("runProjectFinishAttestationProducer")
    expect(source).not.toContain("--repository")
    expect(source).not.toContain("--workflow")
    expect(source).not.toContain("--command")
    expect(source).not.toContain("npm publish")
    expect(source).not.toContain("ACTIONS_ID_TOKEN_REQUEST_")
    expect(workflow).toContain("actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd")
    expect(workflow).toContain("project-finish-attestation-producer-oidc-capability-bridge.cjs")
    expect(workflow).toContain("runProjectFinishAttestationProducerWithCore({ core })")
    expect(workflow).toContain("PERSONA_HARNESS_CALLER_VISIBILITY: ${{ github.event.repository.visibility }}")
    expect(workflow).toContain("PERSONA_HARNESS_PRODUCER_SHA: ${{ steps.producer-pin.outputs.sha }}")
    expect(workflow).not.toContain("run: node scripts/build-project-finish-attestation.mjs")
  })

  it("reserves the fixed output before caller execution and never promotes a pathname staging directory", () => {
    const builder = readFileSync(scriptPath, "utf8")
    const output = readFileSync(artifactOutputPath, "utf8")

    expect(builder).toContain("reserveProjectFinishAttestationArtifactOutput(workspace.runner.realpath)")
    expect(builder).toContain("materializeProjectFinishAttestationArtifactReservation")
    expect(builder).not.toContain("renameSync(")
    expect(builder).not.toContain("ARTIFACT_STAGING_DIRECTORY")
    expect(output).toContain("constants.O_DIRECTORY")
    expect(output).toContain("constants.O_NOFOLLOW")
    expect(output).toContain("writeFileSync(file.descriptor, bytes)")
  })

  it("documents the producer OIDC bridge as an in-memory, fail-closed source boundary", () => {
    const guide = readFileSync(producerGuidePath, "utf8")

    expect(guide).toContain("## Producer OIDC Capability Boundary")
    expect(guide).toContain("immutable `actions/github-script` Toolkit capability bridge")
    expect(guide).toContain("project-finish-producer-oidc")
    expect(guide).toMatch(/creates no receipt, predicate, signed\s+bundle, or authority result/u)
    expect(guide).toMatch(/does not\s+assert that a producer invocation has successfully signed an artifact/u)
  })

  it("documents explicit platform visibility and distinct caller and reusable bindings", () => {
    const guide = readFileSync(producerGuidePath, "utf8")

    expect(guide).toContain("PERSONA_HARNESS_CALLER_VISIBILITY")
    expect(guide).toContain("not accepted from a raw runner variable")
    expect(guide).toContain("caller workflow reference and SHA must independently match")
    expect(guide).toContain("reusable workflow reference and SHA must")
  })

  it("documents runner-owned caller, producer, and artifact isolation", () => {
    const guide = readFileSync(producerGuidePath, "utf8")

    expect(guide).toContain("`.project-finish-caller`")
    expect(guide).toContain("`.persona-harness-producer`")
    expect(guide).toContain("`.project-finish-attestation-artifacts`")
    expect(guide).toMatch(/never broadens\s+the caller source exclusion list/u)
    expect(guide).toMatch(/creates no accepted receipt, predicate, bundle, signature, authority,\s+or Finish result/u)
    expect(guide).toContain("no-follow descriptors")
    expect(guide).toMatch(/performs no\s+pathname staging-to-final rename/u)
    expect(guide).toContain("Replacing the reserved output parent")
  })

  it("documents the exact hidden signed-artifact handoff without granting authority", () => {
    const guide = readFileSync(producerGuidePath, "utf8")

    expect(guide).toContain("## Signed Artifact Handoff")
    expect(guide).toContain("`receipt.json` and `predicate.json`")
    expect(guide).toContain("`bundle.json`")
    expect(guide).toContain("`include-hidden-files: true`")
    expect(guide).toContain("does not validate a signature or create any authority result")
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

  it("derives a valid producer pin without a host Ruby executable", () => {
    expect(resolveProducerPin(callerWorkflow("d".repeat(40)), { PATH: "" })).toBe("d".repeat(40))
  })

  it("isolates the fixed caller checkout from trusted producer symlinks and rejects caller aliases", () => {
    const runnerRoot = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-producer-runner-root-")))
    const callerRoot = join(runnerRoot, ".project-finish-caller")
    const producerBin = join(runnerRoot, ".persona-harness-producer", "node_modules", ".bin")
    const outside = join(runnerRoot, "outside-caller")
    mkdirSync(callerRoot)
    mkdirSync(producerBin, { recursive: true })
    mkdirSync(outside)
    symlinkSync("../outside-caller", join(producerBin, "node"))

    try {
      expect(resolveProjectFinishAttestationCallerWorkspace({ GITHUB_WORKSPACE: runnerRoot })).toBe(callerRoot)
      const runnerAlias = join(outside, "runner")
      symlinkSync(runnerRoot, runnerAlias)
      expect(() => resolveProjectFinishAttestationCallerWorkspace({ GITHUB_WORKSPACE: runnerAlias }))
        .toThrow("project-finish-producer-workspace")
      rmSync(callerRoot, { force: true, recursive: true })
      symlinkSync("outside-caller", callerRoot)
      expect(() => resolveProjectFinishAttestationCallerWorkspace({ GITHUB_WORKSPACE: runnerRoot }))
        .toThrow("project-finish-producer-workspace")
    } finally {
      rmSync(runnerRoot, { force: true, recursive: true })
    }
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

function resolveProducerPin(callerWorkflowSource: string, environment: NodeJS.ProcessEnv = {}): string {
  const workflow = readFileSync(workflowPath, "utf8")
  const resolver = nodeResolver(workflow)
  const fixtureDirectory = mkdtempSync(join(tmpdir(), "project-finish-producer-caller-pin-"))
  const fixtureRoot = realpathSync(fixtureDirectory)
  const callerPath = join(fixtureRoot, ".github", "workflows", "caller.yml")
  const outputPath = join(fixtureRoot, "output")
  const resolverPath = join(fixtureRoot, "resolver.cjs")
  mkdirSync(join(fixtureRoot, ".github", "workflows"), { recursive: true })
  writeFileSync(callerPath, callerWorkflowSource)
  writeFileSync(resolverPath, resolver)

  try {
    execFileSync(process.execPath, [resolverPath], {
      encoding: "utf8",
      cwd: fixtureRoot,
      env: {
        ...process.env,
        ...environment,
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

function nodeResolver(workflow: string): string {
  const match = /\/\/ BEGIN PRODUCER_PIN_RESOLVER\n(?<resolver>[\s\S]+?)\/\/ END PRODUCER_PIN_RESOLVER/u.exec(workflow)
  if (match?.groups?.resolver === undefined) {
    throw new Error("project-finish-producer-caller-pin")
  }
  const lines = match.groups.resolver.split("\n")
  const indentation = lines
    .filter((line) => line.trim().length > 0)
    .reduce((minimum, line) => Math.min(minimum, line.length - line.trimStart().length), Number.POSITIVE_INFINITY)
  return lines.map((line) => line.slice(indentation)).join("\n")
}
