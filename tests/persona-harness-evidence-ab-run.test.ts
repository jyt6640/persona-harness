import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { opaqueEvidenceKey } from "../src/runtime/evidence-file.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-ab-run-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function recordedEvidenceFiles(projectDir: string): readonly string[] {
  const evidenceDir = join(projectDir, ".persona", "evidence", "ab")
  if (!existsSync(evidenceDir)) {
    return []
  }
  return readdirSync(evidenceDir, { recursive: true })
    .filter((entry): entry is string => typeof entry === "string" && entry.endsWith(".json"))
    .map((entry) => join(evidenceDir, entry))
    .sort()
}

function runAb(projectDir: string, args: readonly string[]): void {
  const result = runPersonaCli(["evidence", "ab-run", ...args], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  expect(result.stdout).toContain("A/B evidence written:")
  expect(result.stdout).toContain(".persona/evidence/ab/")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph evidence ab-run", () => {
  it("records repeated command fixtures that feed ab-report and pminus-report", () => {
    const projectDir = createTempProject()
    const nodeCommand = ["--", process.execPath, "-e", "process.exit(0)"]

    runAb(projectDir, [
      "--scenario",
      "tdd-integrity",
      "--scenario-label",
      "TDD integrity",
      "--surface",
      "tdd",
      "--surface-label",
      "TDD rail",
      "--surface-default",
      "opt-in",
      "--condition",
      "off",
      "--condition-label",
      "TDD OFF",
      "--run-id",
      "off-1",
      "--elapsed-ms",
      "100",
      ...nodeCommand,
    ])
    runAb(projectDir, [
      "--scenario",
      "tdd-integrity",
      "--scenario-label",
      "TDD integrity",
      "--surface",
      "tdd",
      "--surface-label",
      "TDD rail",
      "--surface-default",
      "opt-in",
      "--condition",
      "on",
      "--condition-label",
      "TDD ON",
      "--run-id",
      "on-1",
      "--finish-status",
      "blocked",
      "--blocked-invalid-completion",
      "true",
      "--finish-status-before",
      "blocked",
      "--finish-status-after",
      "blocked",
      "--early-completion-blocked",
      "true",
      "--continuation-applied",
      "true",
      "--closure-blockers-before",
      "2",
      "--closure-blockers-after",
      "1",
      "--retry-cap-hit",
      "false",
      "--runaway-retries",
      "0",
      "--elapsed-ms",
      "120",
      ...nodeCommand,
    ])
    runAb(projectDir, [
      "--scenario",
      "codegraph-navigation",
      "--surface",
      "codegraph",
      "--surface-label",
      "CodeGraph wrapper",
      "--surface-default",
      "default",
      "--condition",
      "off",
      "--run-id",
      "off-1",
      "--elapsed-ms",
      "100",
      "--read-chars",
      "200",
      "--tool-calls",
      "4",
      "--mcp-calls",
      "0",
      ...nodeCommand,
    ])
    runAb(projectDir, [
      "--scenario",
      "codegraph-navigation",
      "--surface",
      "codegraph",
      "--surface-label",
      "CodeGraph wrapper",
      "--surface-default",
      "default",
      "--condition",
      "on",
      "--run-id",
      "on-1",
      "--elapsed-ms",
      "180",
      "--read-chars",
      "400",
      "--tool-calls",
      "8",
      "--mcp-calls",
      "2",
      ...nodeCommand,
    ])
    runAb(projectDir, [
      "--scenario",
      "missing-telemetry",
      "--condition",
      "off",
      "--run-id",
      "off-1",
      ...nodeCommand,
    ])
    runAb(projectDir, [
      "--scenario",
      "missing-telemetry",
      "--condition",
      "on",
      "--run-id",
      "on-1",
      ...nodeCommand,
    ])

    const files = recordedEvidenceFiles(projectDir)
    expect(files).toHaveLength(6)
    const firstRecord = JSON.parse(readFileSync(files[0] ?? "", "utf8"))
    expect(firstRecord).toMatchObject({
      schemaVersion: "persona-ab-measurement.1",
      conditions: [{ runs: [{ exitStatus: 0, providerTokens: null }] }],
    })
    expect(existsSync(join(projectDir, ".persona", "evidence", "summary.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow"))).toBe(false)

    const abReport = JSON.parse(
      runPersonaCli(["evidence", "ab-report", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" }).stdout,
    )
    expect(abReport.scenarios).toHaveLength(3)
    expect(abReport.scenarios.find((scenario: { readonly id: string }) => scenario.id === opaqueEvidenceKey("tdd-integrity"))).toMatchObject({
      conditions: [
        { id: opaqueEvidenceKey("off"), closure: { metrics: { blockerDelta: { samples: 0 } } } },
        {
          id: opaqueEvidenceKey("on"),
          closure: {
            continuationApplied: 1,
            earlyCompletionBlocked: 1,
            finishAfter: { blocked: 1 },
            metrics: {
              blockerDelta: { samples: 1, total: 1 },
              blockersAfter: { samples: 1, total: 1 },
              blockersBefore: { samples: 1, total: 2 },
            },
            retryCapHit: 0,
          },
        },
      ],
    })
    expect(abReport.scenarios.find((scenario: { readonly id: string }) => scenario.id === opaqueEvidenceKey("codegraph-navigation")))
      .toMatchObject({
        conditions: [
          { id: opaqueEvidenceKey("off"), metrics: { readChars: { total: 200 } } },
          { id: opaqueEvidenceKey("on"), metrics: { readChars: { total: 400 } } },
        ],
      })

    const pminusReport = JSON.parse(
      runPersonaCli(["evidence", "pminus-report", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" }).stdout,
    )
    const tddScenario = pminusReport.scenarios.find(
      (scenario: { readonly id: string }) => scenario.id === opaqueEvidenceKey("tdd-integrity"),
    )
    const codegraphScenario = pminusReport.scenarios.find(
      (scenario: { readonly id: string }) => scenario.id === opaqueEvidenceKey("codegraph-navigation"),
    )
    const missingScenario = pminusReport.scenarios.find(
      (scenario: { readonly id: string }) => scenario.id === opaqueEvidenceKey("missing-telemetry"),
    )
    expect(tddScenario).toMatchObject({ outcome: "improved", surfaceDecisionHint: "keep" })
    expect(codegraphScenario).toMatchObject({
      outcome: "worse",
      surfaceDecisionHint: "downgrade",
      telemetry: { providerTokens: "missing" },
    })
    expect(missingScenario).toMatchObject({ outcome: "inconclusive", surfaceDecisionHint: "no-claim" })
  })

  it("does not write evidence when required command arguments are missing", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["evidence", "ab-run", "--scenario", "missing-command", "--condition", "off"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Usage: ph evidence ab-run")
    expect(recordedEvidenceFiles(projectDir)).toHaveLength(0)
  })
})
