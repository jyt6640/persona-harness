import { chmodSync, copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"

import { describe, expect, it } from "vitest"

import {
  OBSERVER_GH_WORKFLOW_SELECTOR_STAGES,
  provisionWorkflowObserverGhTool,
} from "../scripts/consumer-authority-observer-gh-workflow-selector.mjs"
import {
  ObserverGhPackageOwnershipError,
  ObserverGhPackageRecordError,
  selectInstalledObserverGhCandidate,
} from "../scripts/consumer-authority-observer-gh-package-record.mjs"
import { observerGhStageCodeForWorkflowSelector } from "../scripts/consumer-authority-observer-gh-stage.mjs"

describe("consumer authority beta.28 workflow observer gh selector lifecycle", () => {
  it("reports a fixed nonreflective stage for every expected selector boundary", () => {
    // Given: the canonical public stage order.
    expect(OBSERVER_GH_WORKFLOW_SELECTOR_STAGES).toEqual([
      "environment",
      "package-list",
      "package-record",
      "source-assessment",
      "private-reservation",
      "private-copy",
      "private-assessment",
      "output-handoff",
    ])

    // When: each boundary is blocked independently.
    const outcomes = [
      runFixture({ environment: {}, stage: "environment" }),
      runFixture({ packageListError: true, stage: "package-list" }),
      runFixture({ packageRecordShape: "record-path", stage: "package-record" }),
      runFixture({ sourceVersion: "2.95.0", stage: "source-assessment" }),
      runFixture({ reservePrivateDirectory: true, stage: "private-reservation" }),
      runFixture({ copyFile: () => { throw new Error("copy failed") }, stage: "private-copy" }),
      runFixture({ privateVersion: "2.95.0", stage: "private-assessment" }),
      runFixture({ githubOutputKind: "directory", stage: "output-handoff" }),
    ]

    // Then: each result retains only its allowlisted stage and creates no output entry.
    for (const outcome of outcomes) {
      expect(outcome.result).toMatchObject({ selectorStage: outcome.stage, state: "blocked" })
      expect(observerGhStageCodeForWorkflowSelector(outcome.result)).toBe(
        outcome.stage === "package-record"
          ? "observer-gh-selector-package-record-record-path"
          : `observer-gh-selector-${outcome.stage}`,
      )
      expect(JSON.stringify(outcome.result)).not.toContain(outcome.root)
      expect(JSON.stringify(outcome.result)).not.toContain("ghp_beta28_fixture_token")
      if (outcome.outputIsFile) expect(readFileSync(outcome.githubOutput, "utf8")).toBe("")
      rmSync(outcome.root, { force: true, recursive: true })
    }
  })

  it("accepts the exact official two-record shape and creates a private output only on success", () => {
    // Given: the official executable and completion records.
    const root = mkdtempSync(join(tmpdir(), "beta28-observer-gh-ready-"))
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    const packageGh = join(root, "package", "gh")
    const completion = "/usr/share/bash-completion/completions/gh"
    try {
      mkdirSync(runnerTemp)
      mkdirSync(join(root, "package"))
      writeFileSync(githubOutput, "")
      writeGhFixture(packageGh, "2.96.0")

      // When: the full selector reserves, copies, and verifies the package executable.
      const result = provisionWorkflowObserverGhTool(strictFixtureOptions({
        githubOutput,
        packageGh,
        runnerTemp,
      }))

      // Then: it only writes the private path after the final handoff.
      expect(result).toEqual({
        code: "observer-gh-workflow-ready",
        packageRecordShape: "canonical",
        selectorStage: "output-handoff",
        state: "ready",
      })
      expect(readFileSync(githubOutput, "utf8")).toMatch(/^path=.+persona-harness-observer-gh\/gh\n$/u)
      expect(JSON.stringify(result)).not.toContain(packageGh)
      expect(observerGhStageCodeForWorkflowSelector(result)).toBeUndefined()

      const records = new Map([
        ["/usr/bin/gh", fixtureStat(true, false, 0o100755)],
        [completion, fixtureStat(true, false, 0o100644)],
      ])
      expect(selectInstalledObserverGhCandidate([
        "/usr/bin/gh",
        completion,
      ], {
        lstat: (path: string) => {
          const stat = records.get(path)
          if (stat === undefined) throw new Error("fixture stat is missing")
          return stat
        },
      })).toEqual({ candidate: "/usr/bin/gh", packageRecordShape: "canonical" })
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("rejects malformed, missing, aliased, nonregular, and ambiguous package records before source assessment", () => {
    // Given: a valid workflow environment and one qualified executable.
    const root = mkdtempSync(join(tmpdir(), "beta28-observer-gh-record-"))
    const runnerTemp = join(root, "runner-temp")
    const githubOutput = join(root, "github-output")
    const packageGh = join(root, "package", "gh")
    try {
      mkdirSync(runnerTemp)
      mkdirSync(join(root, "package"))
      writeFileSync(githubOutput, "")
      writeGhFixture(packageGh, "2.96.0")

      // When: each unsafe record shape is presented by the strict owned record reader.
      const cases = [
        "record-encoding",
        "record-path",
        "primary-missing",
        "primary-unsafe",
        "ancillary-missing-or-unsafe",
        "ancillary-unknown",
        "executable-ambiguous",
        "lstat-failed",
      ] as const

      // Then: each remains at the package-record stage without writing output.
      for (const packageRecordShape of cases) {
        const result = provisionWorkflowObserverGhTool({
          environment: { GITHUB_OUTPUT: githubOutput, RUNNER_TEMP: runnerTemp },
          readPackageRecord: () => {
            throw new ObserverGhPackageRecordError(packageRecordShape)
          },
        })
        expect(result).toEqual({
          code: "observer-gh-workflow-tool-invalid",
          packageRecordShape,
          selectorStage: "package-record",
          state: "blocked",
        })
        expect(readFileSync(githubOutput, "utf8")).toBe("")
      }
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("maps an unexpected selector exception to selector-internal without reflection", () => {
    // Given: an options proxy whose unexpected property access throws a hostile marker.
    const marker = "ghp_beta28_selector_internal_marker"
    const options = new Proxy({}, {
      get() {
        throw new Error(marker)
      },
    })

    // When: the selector reaches the unknown top-level catch.
    const result = provisionWorkflowObserverGhTool(options)

    // Then: it emits only the fixed internal stage.
    expect(result).toEqual({
      code: "observer-gh-workflow-tool-invalid",
      selectorStage: "selector-internal",
      state: "blocked",
    })
    expect(observerGhStageCodeForWorkflowSelector(result)).toBe("observer-gh-selector-internal")
    expect(JSON.stringify(result)).not.toContain(marker)
  })

  it("renders a bounded workflow result rather than stderr for a direct environment block", () => {
    // Given: the real wrapper with an invalid runner temp and a token-shaped ambient value.
    const root = mkdtempSync(join(tmpdir(), "beta28-observer-gh-direct-"))
    const runnerTemp = join(root, "runner-temp-file")
    const githubOutput = join(root, "github-output")
    try {
      writeFileSync(runnerTemp, "not-a-directory\n")
      writeFileSync(githubOutput, "")

      // When: the workflow selector executes as its CI step does.
      const result = spawnSync(process.execPath, [join(process.cwd(), ".github", "scripts", "prepare-observer-gh-tool.mjs")], {
        encoding: "utf8",
        env: {
          GH_TOKEN: "ghp_beta28_fixture_token",
          GITHUB_OUTPUT: githubOutput,
          RUNNER_TEMP: runnerTemp,
        },
      })

      // Then: the stage is observable without a hostile path, token, or raw stderr.
      expect(result.status).toBe(1)
      expect(JSON.parse(result.stdout)).toEqual({
        code: "observer-gh-workflow-tool-invalid",
        selectorStage: "environment",
        state: "blocked",
      })
      expect(result.stderr).toBe("")
      expect(`${result.stdout}${result.stderr}`).not.toContain(root)
      expect(`${result.stdout}${result.stderr}`).not.toContain("ghp_beta28_fixture_token")
      expect(readFileSync(githubOutput, "utf8")).toBe("")
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})

function runFixture(options: {
  readonly copyFile?: (source: string, destination: string, mode: number) => void
  readonly environment?: Record<string, string | undefined>
  readonly githubOutputKind?: "directory"
  readonly packageListError?: boolean
  readonly packageRecordShape?: string
  readonly privateVersion?: string
  readonly reservePrivateDirectory?: boolean
  readonly sourceVersion?: string
  readonly stage: string
}) {
  const root = mkdtempSync(join(tmpdir(), `beta28-observer-gh-${options.stage}-`))
  const runnerTemp = join(root, "runner-temp")
  const githubOutput = join(root, "github-output")
  const packageGh = join(root, "package", "gh")
  mkdirSync(runnerTemp)
  mkdirSync(join(root, "package"))
  writeGhFixture(packageGh, options.sourceVersion ?? "2.96.0", options.privateVersion)
  if (options.githubOutputKind === "directory") {
    mkdirSync(githubOutput)
  } else {
    writeFileSync(githubOutput, "")
  }
  if (options.reservePrivateDirectory) mkdirSync(join(runnerTemp, "persona-harness-observer-gh"))
  const environment = options.environment ?? {
    GH_TOKEN: "ghp_beta28_fixture_token",
    GITHUB_OUTPUT: githubOutput,
    RUNNER_TEMP: runnerTemp,
  }
  const result = options.packageListError
    ? provisionWorkflowObserverGhTool({
      environment,
      readPackageRecord: () => {
        throw new ObserverGhPackageOwnershipError("package list failed")
      },
    })
    : options.packageRecordShape === undefined
      ? provisionWorkflowObserverGhTool(strictFixtureOptions({
        copyFile: options.copyFile,
        environment,
        githubOutput,
        packageGh,
        privateVersion: options.privateVersion,
        runnerTemp,
        sourceVersion: options.sourceVersion,
      }))
      : provisionWorkflowObserverGhTool({
        environment,
        readPackageRecord: () => {
          throw new ObserverGhPackageRecordError(options.packageRecordShape ?? "record-path")
        },
      })
  return {
    githubOutput,
    outputIsFile: options.githubOutputKind !== "directory",
    result,
    root,
    stage: options.stage,
  }
}

function strictFixtureOptions(input: {
  readonly copyFile?: (source: string, destination: string, mode: number) => void
  readonly environment?: Record<string, string | undefined>
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
    environment: input.environment ?? { GITHUB_OUTPUT: input.githubOutput, RUNNER_TEMP: input.runnerTemp },
    lstatPackageRecord: (path: string) => path === primary
      ? fixtureStat(true, false, 0o100755)
      : path === completion
        ? fixtureStat(true, false, 0o100644)
        : (() => { throw Object.assign(new Error("missing"), { code: "ENOENT" }) })(),
    readPackageRecord: () => [primary, completion],
  }
}

function writeGhFixture(path: string, sourceVersion: string, privateVersion = sourceVersion): void {
  writeFileSync(path, [
    `#!${process.execPath}`,
    "if (process.argv[2] === '--version') {",
    `  process.stdout.write(process.argv[1].includes('persona-harness-observer-gh') ? 'gh version ${privateVersion} (fixture)\\n' : 'gh version ${sourceVersion} (fixture)\\n')`,
    "  process.exit(0)",
    "}",
    "process.exit(1)",
    "",
  ].join("\n"))
  chmodSync(path, 0o700)
}

function fixtureStat(file: boolean, symbolicLink: boolean, mode: number) {
  return {
    isFile: () => file,
    isSymbolicLink: () => symbolicLink,
    mode,
  }
}
