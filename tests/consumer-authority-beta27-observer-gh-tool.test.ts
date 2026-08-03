import { spawnSync } from "node:child_process"
import { chmodSync, copyFileSync, lstatSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  canonicalExternalAttestationCommandPlan,
  runExternalAttestationGrammarPreflight,
} from "../scripts/consumer-authority-external-attestation-command-plan.mjs"
import {
  provisionWorkflowObserverGhTool,
} from "../.github/scripts/prepare-observer-gh-tool.mjs"
import {
  ObserverGhPackageRecordError,
  selectInstalledObserverGhCandidate,
} from "../scripts/consumer-authority-observer-gh-package-record.mjs"
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

describe("consumer authority beta.27 observer gh tool contract", () => {
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
    const root = mkdtempSync(join(tmpdir(), "beta27-observer-gh-tool-"))
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
    const root = mkdtempSync(join(tmpdir(), "beta27-observer-gh-provision-"))
    const packageDirectory = join(root, "package")
    const packageGh = join(packageDirectory, "gh")
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    try {
      mkdirSync(runnerTemp)
      mkdirSync(packageDirectory)
      writeFileSync(githubOutput, "")
      writeGhFixture(packageGh, "2.96.0")

      const result = provisionWorkflowObserverGhTool(strictWorkflowOptions({
        githubOutput,
        packageGh,
        runnerTemp,
      }))

      expect(result).toEqual({
        code: "observer-gh-workflow-ready",
        packageRecordShape: "canonical",
        selectorStage: "output-handoff",
        state: "ready",
      })
      const selectedPath = readFileSync(githubOutput, "utf8").trim().slice("path=".length)
      expect(selectedPath).toBe(join(realpathSync(runnerTemp), "persona-harness-observer-gh", "gh"))
      expect(selectedPath).not.toBe(packageGh)
      expect(lstatSync(selectedPath).isFile()).toBe(true)
      expect(lstatSync(selectedPath).isSymbolicLink()).toBe(false)
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("accepts the primary alone and only safe inert secondary basename-gh records", () => {
    const executable = "/usr/bin/gh"
    const completion = "/usr/share/bash-completion/completions/gh"
    const stats = new Map([
      [executable, fixtureStat(true, false, 0o100755)],
      [completion, fixtureStat(true, false, 0o100644)],
    ])

    const inert = "/usr/share/doc/gh/gh"
    const lstat = (path: string) => {
      const stat = stats.get(path)
      if (stat !== undefined) return stat
      if (path === inert) return fixtureStat(true, false, 0o100644)
      throw new Error("fixture stat is missing")
    }

    for (const records of [
      [executable],
      [executable, completion],
      [executable, completion, inert],
    ]) {
      expect(selectInstalledObserverGhCandidate(records, { lstat })).toEqual({
        candidate: executable,
        packageRecordShape: "canonical",
      })
    }
  })

  it("copies a qualified package executable into the private workflow reservation", () => {
    const root = mkdtempSync(join(tmpdir(), "beta27-observer-gh-dpkg-record-"))
    const packageGh = join(root, "usr", "bin", "gh")
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    try {
      mkdirSync(runnerTemp)
      mkdirSync(join(root, "usr", "bin"), { recursive: true })
      writeFileSync(githubOutput, "")
      writeGhFixture(packageGh, "2.96.0")

      const result = provisionWorkflowObserverGhTool(strictWorkflowOptions({
        githubOutput,
        packageGh,
        runnerTemp,
      }))

      expect(result).toEqual({
        code: "observer-gh-workflow-ready",
        packageRecordShape: "canonical",
        selectorStage: "output-handoff",
        state: "ready",
      })
      expect(readFileSync(githubOutput, "utf8")).toContain("path=")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("keeps strict record and source-version blocks before output handoff", () => {
    const root = mkdtempSync(join(tmpdir(), "beta27-observer-gh-provision-negative-"))
    const packageDirectory = join(root, "package")
    const packageGh = join(packageDirectory, "gh")
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    try {
      mkdirSync(runnerTemp)
      mkdirSync(packageDirectory)
      writeFileSync(githubOutput, "")
      writeGhFixture(packageGh, "2.96.0")

      expect(provisionWorkflowObserverGhTool({
        environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
        readPackageRecord: () => {
          throw new ObserverGhPackageRecordError("primary-missing")
        },
      })).toEqual({
        code: "observer-gh-workflow-tool-invalid",
        packageRecordShape: "primary-missing",
        selectorStage: "package-record",
        state: "blocked",
      })
      expect(provisionWorkflowObserverGhTool(strictWorkflowOptions({
        githubOutput,
        packageGh,
        runnerTemp,
        sourceVersion: "2.95.0",
      }))).toMatchObject({
        code: "observer-gh-workflow-tool-version-unsupported",
        packageRecordShape: "canonical",
        selectorStage: "source-assessment",
        state: "blocked",
      })
      expect(readFileSync(githubOutput, "utf8")).toBe("")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("blocks an occupied private copy reservation without exporting a tool path", () => {
    const root = mkdtempSync(join(tmpdir(), "beta27-observer-gh-private-copy-"))
    const packageGh = join(root, "package", "gh")
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    try {
      mkdirSync(join(runnerTemp, "persona-harness-observer-gh"), { recursive: true })
      mkdirSync(join(root, "package"), { recursive: true })
      writeFileSync(githubOutput, "")
      writeGhFixture(packageGh, "2.96.0")

      expect(provisionWorkflowObserverGhTool(strictWorkflowOptions({
        githubOutput,
        packageGh,
        runnerTemp,
      }))).toEqual({
        code: "observer-gh-workflow-tool-invalid",
        packageRecordShape: "canonical",
        selectorStage: "private-reservation",
        state: "blocked",
      })
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
    expect(observerGhStageCodeForPreflight({ code: "gh-command-parser-timeout", state: "blocked" })).toBe("observer-gh-parser-timeout")
    expect(observerGhStageCodeForPreflight({ code: "gh-command-parser-accepted", state: "ready" })).toBeUndefined()
    expect(observerGhStageCodeForPreflight({ code: "untrusted-detail", state: "blocked" })).toBe("observer-gh-non-tool-stage")
  })

  it("keeps parser rejection bounded after a valid selected tool reaches the grammar preflight", () => {
    const root = mkdtempSync(join(tmpdir(), "beta27-observer-gh-parser-"))
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
    const root = mkdtempSync(join(tmpdir(), "beta27-observer-gh-direct-"))
    const runnerTemp = join(root, "runner-temp-file")
    const githubOutput = join(root, "github-output")
    const secret = "ghp_beta27_nonreflective_fixture"
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
      expect(JSON.parse(result.stdout)).toEqual({
        code: "observer-gh-workflow-tool-invalid",
        selectorStage: "environment",
        state: "blocked",
      })
      expect(result.stderr).toBe("")
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
    "const argumentsList = process.argv.slice(2)",
    "if (argumentsList.at(-1) !== '--help' || argumentsList.includes('--unknown')) process.exit(1)",
    "for (let index = 0; index < argumentsList.length; index += 1) {",
    "  if (argumentsList[index] === '--signer-digest' && argumentsList[index + 1] === '--help') process.exit(1)",
    "}",
    "process.exit(0)",
    "",
  ].join("\n"))
  chmodSync(path, 0o700)
}

function strictWorkflowOptions(input: {
  readonly copyFile?: (source: string, destination: string, mode: number) => void
  readonly githubOutput: string
  readonly packageGh: string
  readonly privateVersion?: string
  readonly runnerTemp: string
  readonly sourceVersion?: string
}) {
  const primary = "/usr/bin/gh"
  const completion = "/usr/share/bash-completion/completions/gh"
  const sourceVersion = input.sourceVersion ?? "2.96.0"
  const privateVersion = input.privateVersion ?? sourceVersion
  return {
    assessTool: (path: string) => {
      const version = path.includes("persona-harness-observer-gh") ? privateVersion : sourceVersion
      return version === "2.96.0"
        ? { state: "ready" as const }
        : { code: "gh-command-version-unsupported", state: "blocked" as const }
    },
    copyFile: input.copyFile ?? ((_source: string, destination: string, mode: number) => copyFileSync(input.packageGh, destination, mode)),
    environment: { GITHUB_OUTPUT: input.githubOutput, RUNNER_TEMP: input.runnerTemp },
    lstatPackageRecord: (path: string) => path === primary
      ? fixtureStat(true, false, 0o100755)
      : path === completion
        ? fixtureStat(true, false, 0o100644)
        : (() => { throw Object.assign(new Error("missing"), { code: "ENOENT" }) })(),
    readPackageRecord: () => [primary, completion],
  }
}

function fixtureStat(file: boolean, symbolicLink: boolean, mode: number) {
  return {
    isFile: () => file,
    isSymbolicLink: () => symbolicLink,
    mode,
  }
}
