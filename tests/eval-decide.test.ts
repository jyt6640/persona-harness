import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

import { decideResults } from "../scripts/eval/eval-core.mjs"

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

describe("objective eval decision gate", () => {
  it("identifies the legacy stack-hard policy by default", () => {
    const decision = decideResults({
      runs: [
        run("backend-api-no-stack", "plain", true, true, true, 0.75, 4),
        run("backend-api-no-stack", "ph-on", true, true, true, 0.75, 0),
      ],
    })

    expect(decision.policy).toBe("legacy-v0.4-stack-hard")
    expect(decision.verdict).toBe("FAIL")
    expect(decision.reasons).toContain("backend-api-no-stack: PH ON stack alignment improvement over plain is below 20 percentage points")
  })

  it("passes when PH ON has no primary regression and clears coded thresholds", () => {
    const decision = decideResults({
      runs: [
        run("backend-api-no-stack", "plain", true, true, true, 0.5, 5),
        run("backend-api-no-stack", "claude", true, true, true, 1, 4),
        run("backend-api-no-stack", "agents", true, true, true, 1, 4),
        run("backend-api-no-stack", "ph-on", true, true, true, 1, 3),
      ],
    })

    expect(decision).toEqual({
      policy: "legacy-v0.4-stack-hard",
      verdict: "PASS",
      reasons: ["PH ON met coded v0.4 threshold checks for supplied results"],
    })
  })

  it("fails when PH ON regresses compile/build against an OFF baseline", () => {
    const decision = decideResults({
      runs: [
        run("backend-api-no-stack", "plain", true, true, true, 0.5, 5),
        run("backend-api-no-stack", "ph-on", false, true, true, 1, 3),
      ],
    })

    expect(decision.verdict).toBe("FAIL")
    expect(decision.reasons).toContain("backend-api-no-stack: PH ON compileBuildRate regressed below plain")
  })

  it("keeps zero-failure OFF baselines inconclusive instead of proven", () => {
    const decision = decideResults({
      runs: [
        run("backend-api-no-stack", "plain", true, true, true, 0.5, 0),
        run("backend-api-no-stack", "ph-on", true, true, true, 1, 0),
      ],
    })

    expect(decision.verdict).toBe("INCONCLUSIVE")
    expect(decision.reasons).toContain(
      "backend-api-no-stack: strongest OFF has zero failure modes, so 20% reduction cannot be demonstrated",
    )
  })

  it("uses a deterministic OFF baseline tie-break for regression reasons", () => {
    const plainFirst = decideResults({
      runs: [
        run("backend-api-no-stack", "plain", true, true, true, 0.5, 4),
        run("backend-api-no-stack", "claude", true, true, true, 0.5, 4),
        run("backend-api-no-stack", "ph-on", true, true, false, 1, 7),
      ],
    })
    const claudeFirst = decideResults({
      runs: [
        run("backend-api-no-stack", "claude", true, true, true, 0.5, 4),
        run("backend-api-no-stack", "plain", true, true, true, 0.5, 4),
        run("backend-api-no-stack", "ph-on", true, true, false, 1, 7),
      ],
    })

    expect(plainFirst.reasons).toContain("backend-api-no-stack: PH ON runtimeSmokeRate regressed below claude")
    expect(claudeFirst.reasons).toContain("backend-api-no-stack: PH ON runtimeSmokeRate regressed below claude")
    expect(plainFirst.reasons).toEqual(claudeFirst.reasons)
  })

  it("prints a verdict from fixture results json without writing status files", () => {
    const dir = tempDir("persona-decide-")
    const resultsPath = join(dir, "results.json")
    writeFileSync(
      resultsPath,
      `${JSON.stringify({
        runs: [
          run("backend-api-no-stack", "plain", true, true, true, 0.5, 5),
          run("backend-api-no-stack", "claude", true, true, true, 1, 4),
          run("backend-api-no-stack", "ph-on", true, true, true, 1, 3),
        ],
      })}\n`,
    )

    const result = spawnSync(process.execPath, [resolve("scripts/eval/decide.mjs"), resultsPath], {
      cwd: resolve("."),
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Verdict: PASS")
  })

  it("fails external-primary policy when PH ON regresses a Tier 1 external outcome", () => {
    const decision = decideResults(
      {
        decisionPolicy: "external-primary-v0.4.1",
        runs: [
          run("backend-api-no-stack", "plain", true, true, true, 0.5, 2),
          run("backend-api-no-stack", "ph-on", true, false, true, 0.5, 0),
        ],
      },
      { policy: "external-primary-v0.4.1" },
    )

    expect(decision.policy).toBe("external-primary-v0.4.1")
    expect(decision.verdict).toBe("FAIL")
    expect(decision.reasons).toContain("backend-api-no-stack: Tier 1 external outcome regression: PH ON gradleTestRate below plain")
  })

  it("does not fail external-primary policy solely because stack differentiation is not proven", () => {
    const decision = decideResults(
      {
        decisionPolicy: "external-primary-v0.4.1",
        runs: [
          run("backend-api-no-stack", "plain", true, true, true, 0.75, 4),
          run("backend-api-no-stack", "claude", true, true, true, 0.5, 6),
          run("backend-api-no-stack", "ph-on", true, true, true, 0.75, 0),
        ],
      },
      { policy: "external-primary-v0.4.1" },
    )

    expect(decision.policy).toBe("external-primary-v0.4.1")
    expect(decision.verdict).toBe("PASS")
    expect(decision.reasons).toContain("backend-api-no-stack: Tier 1 external outcomes passed")
    expect(decision.reasons).toContain("backend-api-no-stack: Tier 2 stack differentiation not proven against plain")
  })

  it("does not apply external-primary policy to unstamped legacy results", () => {
    const dir = tempDir("persona-decide-policy-")
    const resultsPath = join(dir, "results.json")
    writeFileSync(
      resultsPath,
      `${JSON.stringify({
        runs: [
          run("backend-api-no-stack", "plain", true, true, true, 0.75, 4),
          run("backend-api-no-stack", "ph-on", true, true, true, 0.75, 0),
        ],
      })}\n`,
    )

    const legacy = spawnSync(process.execPath, [resolve("scripts/eval/decide.mjs"), resultsPath], {
      cwd: resolve("."),
      encoding: "utf8",
    })
    const externalPrimary = spawnSync(
      process.execPath,
      [resolve("scripts/eval/decide.mjs"), "--policy", "external-primary-v0.4.1", resultsPath],
      {
        cwd: resolve("."),
        encoding: "utf8",
      },
    )

    expect(legacy.status).toBe(1)
    expect(legacy.stdout).toContain("Policy: legacy-v0.4-stack-hard")
    expect(externalPrimary.status).toBe(0)
    expect(externalPrimary.stdout).toContain("Policy: external-primary-v0.4.1")
    expect(externalPrimary.stdout).toContain("Verdict: INCONCLUSIVE")
    expect(externalPrimary.stdout).toContain("results were not preregistered for external-primary-v0.4.1")
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
) {
  return {
    fixtureId,
    conditionId,
    metrics: {
      compileBuildPass,
      gradleTestPass,
      runtimeSmokePass,
      stackAlignmentRate,
      externalFailureModeCount,
      workflowFinishOutcome: conditionId === "ph-on" ? "PASS" : "NOT APPLICABLE",
      backendShapeWarnCount: 0,
    },
  }
}
