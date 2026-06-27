import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

import {
  aggregateRuns,
  buildPlan,
  countFailureModes,
  parseArgs,
  parseBackendShapeWarnCount,
  parseCommandOutcome,
  preflight,
} from "../scripts/eval/eval-core.mjs"

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

describe("ON/OFF eval runner core", () => {
  it("selects a narrow one-fixture one-condition run plan", () => {
    const options = parseArgs(["--runs", "1", "--fixture", "backend-api-no-stack", "--condition", "plain", "--model", "test-model"])
    const plan = buildPlan(options)

    expect(plan.runs).toEqual([{ fixtureId: "backend-api-no-stack", conditionId: "plain", repetition: 1 }])
  })

  it("parses fixed command logs without claiming dummy pass", () => {
    expect(
      parseCommandOutcome({
        status: 0,
        stdout: "BUILD SUCCESSFUL in 3s\n4 actionable tasks",
        stderr: "",
        timedOut: false,
      }),
    ).toBe("PASS")
    expect(
      parseCommandOutcome({
        status: 1,
        stdout: "",
        stderr: "FAILURE: Build failed with an exception.",
        timedOut: false,
      }),
    ).toBe("FAIL")
    expect(
      parseCommandOutcome({
        status: null,
        stdout: "",
        stderr: "",
        timedOut: true,
      }),
    ).toBe("FAIL")
  })

  it("counts backend-shape WARN lines from fixed report text", () => {
    expect(parseBackendShapeWarnCount("PASS\nWARN controller boundary\nWARN repository boundary\n")).toBe(2)
    expect(parseBackendShapeWarnCount("Backend-shape WARN count: 3\n")).toBe(3)
  })

  it("aggregates fixed run metadata into deterministic rates", () => {
    const runs = [
      run("backend-api-no-stack", "plain", true, true, true, 1, 5),
      run("backend-api-no-stack", "ph-on", true, true, true, 2, 3),
      run("backend-api-no-stack", "ph-on", true, false, null, 2, 4),
    ]

    const aggregate = aggregateRuns(runs)

    expect(aggregate.byCondition).toEqual([
      expect.objectContaining({
        fixtureId: "backend-api-no-stack",
        conditionId: "plain",
        runs: 1,
        compileBuildRate: 1,
        gradleTestRate: 1,
        runtimeSmokeRate: 1,
        externalFailureModeTotal: 5,
      }),
      expect.objectContaining({
        fixtureId: "backend-api-no-stack",
        conditionId: "ph-on",
        runs: 2,
        compileBuildRate: 1,
        gradleTestRate: 0.5,
        runtimeSmokeRate: 1,
        stackAlignmentAverage: 2,
        externalFailureModeTotal: 7,
      }),
    ])
  })

  it("maps failed outcomes to failure-mode labels", () => {
    const failures = countFailureModes({
      compileBuildOutcome: "FAIL",
      gradleTestOutcome: "FAIL",
      runtimeSmokeOutcome: "FAIL",
      stackAlignmentScore: 0,
      workflowFinishOutcome: "FAIL",
      providerFailed: true,
    })

    expect(failures).toEqual({
      count: 6,
      labels: ["wrong stack", "compile failure", "test failure", "runtime smoke failure", "provider limit", "workflow dead-end"],
    })
  })

  it("fails preflight before result creation when provider prerequisites are missing", () => {
    const outputRoot = tempDir("persona-eval-no-results-")
    const result = spawnSync(
      process.execPath,
      [
        resolve("scripts/eval/run-onoff-eval.mjs"),
        "--preflight",
        "--fixture",
        "backend-api-no-stack",
        "--condition",
        "plain",
        "--model",
        "test-model",
        "--opencode-command",
        "definitely-missing-opencode-binary",
        "--output-root",
        outputRoot,
      ],
      { cwd: resolve("."), encoding: "utf8" },
    )

    expect(result.status).toBe(1)
    expect(result.stdout).toContain("Preflight: FAIL")
    expect(result.stdout).toContain("OpenCode command not found")
    expect(readdirSync(outputRoot)).toEqual([])
  })

  it("reports PH ON install command as required during preflight", () => {
    const options = parseArgs([
      "--fixture",
      "backend-api-no-stack",
      "--condition",
      "ph-on",
      "--model",
      "test-model",
      "--opencode-command",
      "definitely-missing-opencode-binary",
    ])
    const result = preflight(options)

    expect(result.ok).toBe(false)
    expect(result.errors).toContain("PH ON requires --ph-install-command or PERSONA_HARNESS_INSTALL_COMMAND")
  })
})

function run(
  fixtureId: string,
  conditionId: string,
  compileBuildPass: boolean,
  gradleTestPass: boolean,
  runtimeSmokePass: boolean | null,
  stackAlignmentScore: number,
  externalFailureModeCount: number,
) {
  return {
    fixtureId,
    conditionId,
    metrics: {
      compileBuildPass,
      gradleTestPass,
      runtimeSmokePass,
      stackAlignmentScore,
      externalFailureModeCount,
      workflowFinishOutcome: conditionId === "ph-on" ? "PASS" : "NOT APPLICABLE",
      backendShapeWarnCount: 0,
    },
  }
}
