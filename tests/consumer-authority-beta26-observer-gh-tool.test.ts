import { spawnSync } from "node:child_process"
import { chmodSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  canonicalExternalAttestationCommandPlan,
  runExternalAttestationGrammarPreflight,
} from "../scripts/consumer-authority-external-attestation-command-plan.mjs"
import {
  provisionWorkflowObserverGhTool,
  WorkflowObserverGhToolError,
} from "../.github/scripts/prepare-observer-gh-tool.mjs"
import { observerGhStageCodeForPreflight } from "../scripts/consumer-authority-observer-gh-stage.mjs"
import type { ExternalAttestationTopology } from "../scripts/consumer-authority-external-attestation-command-plan.mjs"

const topology: ExternalAttestationTopology = {
  callerEnrollment: {
    repositoryId: 1304576182,
    repositorySlug: "jyt6640/persona-harness-attestation-claim-fixture",
    workflowPath: ".github/workflows/research-attestation.yml",
    workflowRef: "refs/heads/main",
    workflowSha: "a".repeat(40),
  },
  callerSource: {
    ref: "refs/heads/main",
    sourceSha: "b".repeat(40),
  },
  reusableSigner: {
    repositorySlug: "jyt6640/persona-harness",
    workflowPath: ".github/workflows/persona-harness-project-finish.yml",
    workflowSha: "c".repeat(40),
  },
}

describe("consumer authority beta.26 observer gh tool contract", () => {
  it("requires an explicit observer executable instead of ambient command lookup", () => {
    let calls = 0

    const result = runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
      execute: () => {
        calls += 1
        return { status: 1, stderr: "bundle content could not be parsed" }
      },
    })

    expect(calls).toBe(0)
    expect(result).toMatchObject({ code: "gh-command-tool-required", state: "blocked" })
  })

  it("blocks malformed and unavailable tool inputs without reaching the parser", () => {
    const inputs = ["gh", "/missing/gh", "/tmp/gh\0alias"]
    for (const ghPath of inputs) {
      let calls = 0
      const result = runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        execute: () => {
          calls += 1
          return { status: 1, stderr: "bundle content could not be parsed" }
        },
        ghPath,
      })
      expect(calls).toBe(0)
      expect(result.state).toBe("blocked")
      expect(result.code).toMatch(/^gh-command-(?:tool-(?:invalid|required)|unavailable)$/u)
    }
  })

  it("accepts only a regular, non-symlink exact-version executable before parser preflight", () => {
    const root = mkdtempSync(join(tmpdir(), "beta26-observer-gh-tool-"))
    const executable = join(root, "gh")
    const wrongVersion = join(root, "wrong-version-gh")
    const alias = join(root, "gh-alias")
    try {
      writeGhFixture(executable, "2.96.0")
      writeGhFixture(wrongVersion, "2.95.0")
      symlinkSync(executable, alias)

      expect(runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        ghPath: executable,
      })).toMatchObject({ code: "gh-command-parser-accepted", state: "ready" })
      expect(runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        ghPath: wrongVersion,
      })).toMatchObject({ code: "gh-command-version-unsupported", state: "blocked" })
      expect(runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        ghPath: alias,
      })).toMatchObject({ code: "gh-command-tool-invalid", state: "blocked" })
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("provisions one private regular workflow-selected copy and never exports a source path", () => {
    const root = mkdtempSync(join(tmpdir(), "beta26-observer-gh-provision-"))
    const packageDirectory = join(root, "package")
    const packageGh = join(packageDirectory, "gh")
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    try {
      mkdirSync(runnerTemp)
      mkdirSync(packageDirectory)
      writeFileSync(githubOutput, "")
      writeGhFixture(packageGh, "2.96.0")

      const result = provisionWorkflowObserverGhTool({
        environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
        listPackageFiles: () => [packageGh],
      })

      expect(result).toEqual({ code: "observer-gh-workflow-ready", state: "ready" })
      const selectedPath = readFileSync(githubOutput, "utf8").trim().slice("path=".length)
      expect(selectedPath).toBe(join(realpathSync(runnerTemp), "persona-harness-observer-gh", "gh"))
      expect(selectedPath).not.toBe(packageGh)
      expect(lstatSync(selectedPath).isFile()).toBe(true)
      expect(lstatSync(selectedPath).isSymbolicLink()).toBe(false)
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("rejects missing, symlinked, incompatible, and ambiguous workflow package records without output", () => {
    const root = mkdtempSync(join(tmpdir(), "beta26-observer-gh-provision-negative-"))
    const packageDirectory = join(root, "package")
    const oldDirectory = join(root, "old")
    const aliasDirectory = join(root, "alias")
    const packageGh = join(packageDirectory, "gh")
    const oldGh = join(oldDirectory, "gh")
    const alias = join(aliasDirectory, "gh")
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    try {
      mkdirSync(runnerTemp)
      mkdirSync(packageDirectory)
      mkdirSync(oldDirectory)
      mkdirSync(aliasDirectory)
      writeFileSync(githubOutput, "")
      writeGhFixture(packageGh, "2.96.0")
      writeGhFixture(oldGh, "2.95.0")
      symlinkSync(packageGh, alias)

      expect(provisionWorkflowObserverGhTool({
        environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
        listPackageFiles: () => [join(root, "missing", "gh")],
      })).toMatchObject({ code: "observer-gh-workflow-tool-unavailable", state: "blocked" })
      expect(provisionWorkflowObserverGhTool({
        environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
        listPackageFiles: () => [alias],
      })).toMatchObject({ code: "observer-gh-workflow-tool-invalid", state: "blocked" })
      expect(provisionWorkflowObserverGhTool({
        environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
        listPackageFiles: () => [oldGh],
      })).toMatchObject({ code: "observer-gh-workflow-tool-version-unsupported", state: "blocked" })
      expect(() => provisionWorkflowObserverGhTool({
        environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
        listPackageFiles: () => [packageGh, oldGh],
      })).toThrow(WorkflowObserverGhToolError)
      expect(readFileSync(githubOutput, "utf8")).toBe("")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("maps only the fixed observer tool diagnostics across the package contract boundary", () => {
    expect(observerGhStageCodeForPreflight({ code: "gh-command-tool-invalid", state: "blocked" })).toBe("observer-gh-tool-invalid")
    expect(observerGhStageCodeForPreflight({ code: "gh-command-unavailable", state: "blocked" })).toBe("observer-gh-tool-unavailable")
    expect(observerGhStageCodeForPreflight({ code: "gh-command-version-unsupported", state: "blocked" })).toBe("observer-gh-tool-version-unsupported")
    expect(observerGhStageCodeForPreflight({ code: "gh-command-parser-rejected", state: "blocked" })).toBe("observer-gh-parser-rejected")
    expect(observerGhStageCodeForPreflight({ code: "gh-command-parser-accepted", state: "ready" })).toBeUndefined()
    expect(observerGhStageCodeForPreflight({ code: "untrusted-detail", state: "blocked" })).toBe("observer-gh-non-tool-stage")
  })

  it("keeps parser rejection bounded after a valid selected tool reaches the grammar preflight", () => {
    const root = mkdtempSync(join(tmpdir(), "beta26-observer-gh-parser-"))
    const executable = join(root, "gh")
    try {
      writeGhFixture(executable, "2.96.0")
      const result = runExternalAttestationGrammarPreflight(canonicalExternalAttestationCommandPlan(), topology, {
        execute: (_path, args) => args[0] === "--version"
          ? { status: 0, stdout: "gh version 2.96.0 (fixture)\n" }
          : { status: 1, stderr: "untrusted parser detail" },
        ghPath: executable,
      })
      expect(result).toMatchObject({ code: "gh-command-parser-rejected", state: "blocked" })
      expect(observerGhStageCodeForPreflight(result)).toBe("observer-gh-parser-rejected")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("renders only a fixed workflow selection diagnostic on direct failure", () => {
    const root = mkdtempSync(join(tmpdir(), "beta26-observer-gh-direct-"))
    const runnerTemp = join(root, "runner-temp-file")
    const githubOutput = join(root, "github-output")
    const secret = "ghp_beta26_nonreflective_fixture"
    try {
      writeFileSync(runnerTemp, "not-a-directory\n")
      writeFileSync(githubOutput, "")
      const result = spawnSync(process.execPath, [join(process.cwd(), ".github", "scripts", "prepare-observer-gh-tool.mjs")], {
        encoding: "utf8",
        env: {
          GH_TOKEN: secret,
          GITHUB_OUTPUT: githubOutput,
          PATH: process.env.PATH ?? "",
          RUNNER_TEMP: runnerTemp,
        },
      })
      expect(result.status).toBe(1)
      expect(result.stdout).toBe("")
      expect(result.stderr).toBe("observer-gh-workflow-tool-invalid\n")
      expect(`${result.stdout}${result.stderr}`).not.toContain(secret)
      expect(`${result.stdout}${result.stderr}`).not.toContain(root)
      expect(readFileSync(githubOutput, "utf8")).toBe("")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})

function writeGhFixture(path: string, version: string): void {
  writeFileSync(path, [
    `#!${process.execPath}`,
    "if (process.argv[2] === '--version') {",
    `  process.stdout.write('gh version ${version} (fixture)\\n')`,
    "  process.exit(0)",
    "}",
    "process.stderr.write('bundle content could not be parsed\\n')",
    "process.exit(1)",
    "",
  ].join("\n"))
  chmodSync(path, 0o700)
}
