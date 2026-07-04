import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

const gateScript = resolve("scripts/rail-entry-prompt-regression-gate.mjs")

const tempDirs: string[] = []

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "persona-rail-entry-gate-test-"))
  tempDirs.push(dir)
  return dir
}

function runGate(args: readonly string[], cwd: string) {
  return spawnSync(process.execPath, [gateScript, ...args], {
    cwd,
    encoding: "utf8",
  })
}

function readJson(filePath: string): unknown {
  return JSON.parse(readFileSync(filePath, "utf8"))
}

function writeSummary(projectDir: string, summary: Record<string, unknown>): void {
  writeFileSync(join(projectDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`)
}

function validSummary(): Record<string, unknown> {
  return {
    schema: "rail-entry-prompt-regression-summary.1",
    gate: "rail-entry-prompt-regression",
    validity: {
      finalAcceptedValidPairs: 5,
      invalidRunCount: 0,
      invalidRuns: [],
    },
    railEntry: {
      candidate: 5,
      current: 5,
      deltaPercentagePoints: 0,
      nonInferiorityCriterionMet: true,
      pairedCounts: {
        candidateOnly: 0,
        comparable: 5,
        currentOnly: 0,
        both: 5,
        neither: 0,
      },
      totalPairs: 5,
    },
    pairRows: Array.from({ length: 5 }, (_, index) => ({
      candidateRail: true,
      currentRail: true,
      pair: index + 1,
      readmeSha256Matched: true,
      startCommitMatched: true,
      taskSha256Matched: true,
    })),
  }
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

describe("rail-entry prompt regression gate", () => {
  it("initializes a reusable plan, criteria, and summary template", () => {
    const projectDir = createTempDir()

    const result = runGate(["init", "--archive", projectDir, "--scenario", "stage20-wording"], projectDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Rail-entry prompt regression gate initialized")
    expect(existsSync(join(projectDir, "measurement-plan.json"))).toBe(true)
    expect(existsSync(join(projectDir, "KILL_CRITERIA.md"))).toBe(true)
    expect(existsSync(join(projectDir, "summary-template.json"))).toBe(true)
    const plan = readJson(join(projectDir, "measurement-plan.json"))
    expect(plan).toMatchObject({
      criteria: {
        minimumPairs: 5,
        primaryOutcome: "rail-entry-non-inferiority",
      },
      gate: "rail-entry-prompt-regression",
      scenario: "stage20-wording",
      stage9Reference: {
        h1Judgment: "not-supported-for-this-fixture",
        offRailEntry: "10/10",
        onRailEntry: "10/10",
      },
    })
  })

  it("passes a valid non-inferiority summary", () => {
    const projectDir = createTempDir()
    expect(runGate(["init", "--archive", projectDir], projectDir).status).toBe(0)
    writeSummary(projectDir, validSummary())

    const result = runGate(["check", "--archive", projectDir], projectDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Rail-entry prompt regression gate: PASS")
    expect(result.stdout).toContain("candidate-current delta: 0pp")
  })

  it("fails when candidate rail entry is lower than current", () => {
    const projectDir = createTempDir()
    expect(runGate(["init", "--archive", projectDir], projectDir).status).toBe(0)
    writeSummary(projectDir, {
      ...validSummary(),
      railEntry: {
        candidate: 4,
        current: 5,
        deltaPercentagePoints: -20,
        nonInferiorityCriterionMet: false,
        pairedCounts: { candidateOnly: 0, comparable: 5, currentOnly: 1, both: 4, neither: 0 },
        totalPairs: 5,
      },
    })

    const result = runGate(["check", "--archive", projectDir], projectDir)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Rail-entry prompt regression gate: FAIL")
    expect(result.stdout).toContain("candidate rail entry is below current/control")
  })

  it("fails when invalid runs are present", () => {
    const projectDir = createTempDir()
    expect(runGate(["init", "--archive", projectDir], projectDir).status).toBe(0)
    writeSummary(projectDir, {
      ...validSummary(),
      validity: {
        finalAcceptedValidPairs: 5,
        invalidRunCount: 1,
        invalidRuns: [{ condition: "candidate", pair: 3, reason: "setup assertion failed" }],
      },
    })

    const result = runGate(["check", "--archive", projectDir], projectDir)

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("invalid runs must be 0")
  })
})
