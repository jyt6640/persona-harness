import { execFileSync } from "node:child_process"
import fs, {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { syncBuiltinESMExports } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  runProjectFinishAttestationBuilder,
} from "../scripts/build-project-finish-attestation.mjs"
import {
  verifyProjectFinishAttestationArtifactHandoff,
} from "../scripts/project-finish-attestation-artifact-handoff.mjs"

const temporaryDirectories: string[] = []

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true })
  }
})

describe("project finish attestation builder output lifecycle", () => {
  it("materializes an unsigned handoff only through the real builder's reserved output path", async () => {
    const fixture = createFixture()

    const result = await runProjectFinishAttestationBuilder({
      environment: fixture.environment,
      oidcToken: fixture.oidcToken,
      producerRoot: fixture.producerRoot,
    })

    expect(result).toEqual({ kind: "passed" })
    expect(existsSync(join(fixture.output, "receipt.json"))).toBe(true)
    expect(existsSync(join(fixture.output, "predicate.json"))).toBe(true)
  })

  it("does not use a caller-controlled legacy staging alias during the real builder path", async () => {
    const fixture = createFixture()
    const legacyStaging = join(fixture.runner, ".project-finish-attestation-artifacts-staging")
    symlinkSync(fixture.outside, legacyStaging)

    const result = await runProjectFinishAttestationBuilder({
      environment: fixture.environment,
      oidcToken: fixture.oidcToken,
      producerRoot: fixture.producerRoot,
    })

    expect(result).toEqual({ kind: "passed" })
    expect(existsSync(join(fixture.outside, "receipt.json"))).toBe(false)
    expect(existsSync(join(fixture.outside, "predicate.json"))).toBe(false)
  })

  it("leaves a blocked producer with no accepted artifact, bundle, or authority-bearing handoff", async () => {
    const fixture = createFixture("blocked")

    const result = await runProjectFinishAttestationBuilder({
      environment: fixture.environment,
      oidcToken: fixture.oidcToken,
      producerRoot: fixture.producerRoot,
    })

    expect(result).toEqual({ code: "project-finish-producer-profile", kind: "blocked" })
    expect(lstatSync(join(fixture.output, "receipt.json")).size).toBe(0)
    expect(lstatSync(join(fixture.output, "predicate.json")).size).toBe(0)
    expect(existsSync(join(fixture.output, "bundle.json"))).toBe(false)
    expect(verifyProjectFinishAttestationArtifactHandoff({
      environment: { GITHUB_WORKSPACE: fixture.environment.GITHUB_WORKSPACE },
      phase: "unsigned",
    })).toEqual({ code: "project-finish-producer-artifact-handoff", kind: "blocked" })
  })

  it.each([
    ["staging parent", "output-root-first-write"],
    ["final output root", "output-root-second-write"],
    ["receipt leaf", "receipt-leaf-first-write"],
  ] as const)("blocks a replaced %s without external receipt or predicate bytes", async (_label, replacement) => {
    const fixture = createFixture()

    const result = await withOutputReplacement(fixture, replacement, () => runProjectFinishAttestationBuilder({
      environment: fixture.environment,
      oidcToken: fixture.oidcToken,
      producerRoot: fixture.producerRoot,
    }))

    expect(result).toEqual({ code: "project-finish-producer-workspace", kind: "blocked" })
    expect(existsSync(join(fixture.outside, "receipt.json"))).toBe(false)
    expect(existsSync(join(fixture.outside, "predicate.json"))).toBe(false)
    expect(existsSync(join(fixture.outside, "bundle.json"))).toBe(false)
  })
})

async function withOutputReplacement<T>(
  fixture: ReturnType<typeof createFixture>,
  replacement: "output-root-first-write" | "output-root-second-write" | "receipt-leaf-first-write",
  action: () => Promise<T>,
): Promise<T> {
  const originalWriteFileSync = fs.writeFileSync
  let descriptorWrites = 0
  let replaced = false
  fs.writeFileSync = ((...args: Parameters<typeof fs.writeFileSync>) => {
    if (typeof args[0] === "number") {
      descriptorWrites += 1
      if (!replaced && shouldReplace(replacement, descriptorWrites)) {
        replaced = true
        replaceOutputPath(fixture, replacement)
      }
    }
    return originalWriteFileSync(...args)
  }) as typeof fs.writeFileSync
  syncBuiltinESMExports()
  try {
    const result = await action()
    expect(replaced).toBe(true)
    return result
  } finally {
    fs.writeFileSync = originalWriteFileSync
    syncBuiltinESMExports()
  }
}

function shouldReplace(
  replacement: "output-root-first-write" | "output-root-second-write" | "receipt-leaf-first-write",
  descriptorWrites: number,
): boolean {
  return replacement === "output-root-second-write" ? descriptorWrites === 2 : descriptorWrites === 1
}

function replaceOutputPath(
  fixture: ReturnType<typeof createFixture>,
  replacement: "output-root-first-write" | "output-root-second-write" | "receipt-leaf-first-write",
): void {
  if (replacement === "receipt-leaf-first-write") {
    const receipt = join(fixture.output, "receipt.json")
    unlinkSync(receipt)
    symlinkSync(join(fixture.outside, "receipt.json"), receipt)
    return
  }
  rmSync(fixture.output, { force: true, recursive: true })
  symlinkSync(fixture.outside, fixture.output)
}

function createFixture(mode: "blocked" | "passed" = "passed") {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "project-finish-attestation-builder-")))
  const runner = join(root, "runner")
  const caller = join(runner, ".project-finish-caller")
  const outside = join(root, "outside")
  const producerRoot = join(root, "producer")
  mkdirSync(caller, { recursive: true })
  mkdirSync(outside)
  createProducerRoot(producerRoot, mode)
  const producerSha = git(producerRoot, ["rev-parse", "HEAD"])
  const callerSha = "a".repeat(40)
  temporaryDirectories.push(root)
  return {
    environment: {
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: "example/public-gradle-app",
      GITHUB_REPOSITORY_ID: "123",
      GITHUB_RUN_ATTEMPT: "1",
      GITHUB_RUN_ID: "42",
      GITHUB_SHA: callerSha,
      GITHUB_WORKFLOW_REF: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
      GITHUB_WORKFLOW_SHA: callerSha,
      GITHUB_WORKSPACE: runner,
      PERSONA_HARNESS_CALLER_VISIBILITY: "public",
      PERSONA_HARNESS_PRODUCER_SHA: producerSha,
      RUNNER_ENVIRONMENT: "github-hosted",
      RUNNER_OS: "Linux",
    },
    oidcToken: token({
      aud: "persona-harness-project-finish-attestation",
      event_name: "push",
      iss: "https://token.actions.githubusercontent.com",
      job_workflow_ref: `jyt6640/persona-harness/.github/workflows/persona-harness-project-finish.yml@${producerSha}`,
      job_workflow_sha: producerSha,
      ref: "refs/heads/main",
      repository: "example/public-gradle-app",
      repository_id: "123",
      repository_visibility: "public",
      run_attempt: "1",
      run_id: "42",
      runner_environment: "github-hosted",
      workflow_ref: "example/public-gradle-app/.github/workflows/project-finish.yml@refs/heads/main",
      workflow_sha: callerSha,
    }),
    output: join(runner, ".project-finish-attestation-artifacts"),
    outside,
    producerRoot,
    runner,
  }
}

function createProducerRoot(producerRoot: string, mode: "blocked" | "passed"): void {
  mkdirSync(join(producerRoot, "dist", "cli"), { recursive: true })
  writeFileSync(join(producerRoot, "package.json"), '{"version":"0.7.0"}\n')
  writeFileSync(
    join(producerRoot, "dist", "cli", "project-finish-attestation-producer-runner.js"),
    mode === "blocked"
      ? [
        "export function runProjectFinishAttestationProducer() {",
        "  return { code: 'project-finish-producer-profile', kind: 'blocked' }",
        "}",
        "",
      ].join("\n")
      : [
      "export function runProjectFinishAttestationProducer() {",
      "  return {",
      "    kind: 'passed',",
      "    value: {",
      "      predicate: { schemaVersion: 'project-finish-attestation.1', subject: 'receipt.json' },",
      "      receiptBytes: Buffer.from('{\\\"schemaVersion\\\":\\\"project-finish-attestation.1\\\"}\\n', 'utf8'),",
      "    },",
      "  }",
      "}",
      "",
      ].join("\n"),
  )
  git(producerRoot, ["init", "-q"])
  git(producerRoot, ["config", "user.email", "ph@example.invalid"])
  git(producerRoot, ["config", "user.name", "PH Test"])
  git(producerRoot, ["add", "."])
  git(producerRoot, ["commit", "-qm", "producer fixture"])
  git(producerRoot, ["remote", "add", "origin", "https://github.com/jyt6640/persona-harness.git"])
}

function git(cwd: string, args: readonly string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim()
}

function token(payload: Readonly<Record<string, string>>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`
}
