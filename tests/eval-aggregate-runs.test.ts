import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { aggregateEvalRuns, formatAggregateTable } from "../scripts/eval/aggregate-runs.mjs"

const tempDirs: string[] = []

function tempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true })
  }
  tempDirs.length = 0
})

describe("eval aggregate signal script", () => {
  it("aggregates original results only and preserves source-only signal artifacts", () => {
    const projectDir = tempDir("persona-eval-aggregate-")
    const evalRoot = join(projectDir, "experiments", "eval-runs")
    const signalRoot = join(projectDir, "experiments", "eval-signal")
    const originalDir = join(evalRoot, "run-original")
    const replayDir = join(evalRoot, "run-replay")
    const workspaceDir = join(originalDir, "raw", "backend-api-no-stack", "ph-on", "r1", "workspace")
    mkdirSync(join(workspaceDir, "src", "main", "java"), { recursive: true })
    mkdirSync(join(workspaceDir, "node_modules", "pkg"), { recursive: true })
    mkdirSync(join(workspaceDir, "build"), { recursive: true })
    mkdirSync(join(workspaceDir, ".opencode"), { recursive: true })
    mkdirSync(replayDir, { recursive: true })
    writeFileSync(join(workspaceDir, "src", "main", "java", "App.java"), "class App {}\n")
    writeFileSync(join(workspaceDir, "node_modules", "pkg", "index.js"), "vendor\n")
    writeFileSync(join(workspaceDir, "build", "App.js"), "build\n")
    writeFileSync(join(workspaceDir, ".opencode", "state.js"), "state\n")
    writeFileSync(
      join(originalDir, "results.json"),
      JSON.stringify({
        toolchainScoringVersion: "legacy",
        installSource: "actual",
        runs: [
          run("backend-api-no-stack", "plain", true, true, true, 0.5, 3),
          run("backend-api-no-stack", "ph-on", true, true, true, 1, 0, workspaceDir),
        ],
      }),
    )
    writeFileSync(join(replayDir, "results.json"), JSON.stringify({ replayOf: originalDir, installSource: "replay", runs: [] }))

    const { aggregate } = aggregateEvalRuns({ projectDir, evalRoot, signalRoot, pruneCaptures: true })

    expect(aggregate.resultCounts).toEqual({ total: 2, original: 1, replay: 1, unknown: 0 })
    expect(aggregate.historicalToolchainConfounded.runCount).toBe(2)
    expect(aggregate.byCondition).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ conditionId: "ph-on", runs: 1, compileBuildRate: 1, testRate: 1, runtimeSmokeRate: 1 }),
      ]),
    )
    expect(aggregate.deconfounded.runtimeSmokeRate.phMinusPlain).toBe(0)
    expect(formatAggregateTable(aggregate)).toContain("condition,runs,compileBuildRate")
    expect(existsSync(join(signalRoot, "aggregate.json"))).toBe(true)
    expect(existsSync(join(signalRoot, "runs", "run-original", "results.json"))).toBe(true)
    expect(existsSync(join(signalRoot, "runs", "run-original", "sources", "backend-api-no-stack-ph-on-r1", "src", "main", "java", "App.java"))).toBe(true)
    expect(existsSync(join(signalRoot, "runs", "run-original", "sources", "backend-api-no-stack-ph-on-r1", "node_modules"))).toBe(false)
    expect(existsSync(join(signalRoot, "runs", "run-original", "sources", "backend-api-no-stack-ph-on-r1", "build"))).toBe(false)
    expect(existsSync(join(originalDir, "results.json"))).toBe(true)
    expect(existsSync(join(originalDir, "raw"))).toBe(false)
  })
})

function run(
  fixtureId: string,
  conditionId: string,
  compileBuildPass: boolean,
  gradleTestPass: boolean,
  runtimeSmokePass: boolean,
  stackAlignmentRate: number,
  externalFailureModeCount: number,
  workspaceDir?: string,
) {
  return {
    fixtureId,
    conditionId,
    repetition: 1,
    workspaceDir,
    metrics: {
      compileBuildPass,
      gradleTestPass,
      runtimeSmokePass,
      stackAlignmentRate,
      externalFailureModeCount,
      operationalFailureModeCount: 0,
      workflowFinishOutcome: conditionId === "ph-on" ? "PASS" : "NOT APPLICABLE",
      backendShapeWarnCount: 0,
    },
  }
}
