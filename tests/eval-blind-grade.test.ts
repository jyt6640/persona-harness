import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

import { aggregateDisagreements, anonymizeCapture, stableAnonymousId } from "../scripts/eval/blind-grade-core.mjs"

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

describe("blind eval grading path", () => {
  it("anonymizes capture runs and writes a sealed mapping", () => {
    const captureDir = tempDir("persona-blind-capture-")
    const sourceRun = join(captureDir, "raw", "backend-api-no-stack", "ph-on", "r1")
    mkdirSync(sourceRun, { recursive: true })
    writeFileSync(join(sourceRun, "model.stdout.txt"), "generated output\n")

    const outputDir = tempDir("persona-blind-output-")
    const result = anonymizeCapture(captureDir, outputDir, "stable-seed")
    const anonymousId = stableAnonymousId("stable-seed", "backend-api-no-stack/ph-on/r1")

    expect(result.runCount).toBe(1)
    expect(existsSync(join(result.reviewDir, anonymousId, "model.stdout.txt"))).toBe(true)
    expect(readFileSync(result.mappingPath, "utf8")).toContain('"conditionId": "ph-on"')
    expect(readFileSync(result.packagePath, "utf8")).toContain(anonymousId)
  })

  it("aggregates two reviewer disagreements without inventing scores", () => {
    const aggregate = aggregateDisagreements({
      runs: [
        {
          anonymousId: "run-a",
          graderA: { build: "PASS", test: "PASS", runtime: "FAIL", stackAlignment: 2, failureModeCount: 1 },
          graderB: { build: "PASS", test: "FAIL", runtime: "FAIL", stackAlignment: 1, failureModeCount: 3 },
        },
      ],
    })

    expect(aggregate).toEqual({
      runCount: 1,
      disagreements: [
        {
          anonymousId: "run-a",
          buildDelta: "same",
          testDelta: "different",
          runtimeDelta: "same",
          stackDelta: 1,
          failureModeDelta: -2,
        },
      ],
    })
  })

  it("prints help and refuses LLM judge without an explicit command", () => {
    const help = spawnSync(process.execPath, [resolve("scripts/eval/blind-grade.mjs"), "--help"], {
      cwd: resolve("."),
      encoding: "utf8",
    })
    expect(help.status).toBe(0)
    expect(help.stdout).toContain("Usage: node scripts/eval/blind-grade.mjs")

    const judge = spawnSync(process.execPath, [resolve("scripts/eval/blind-grade.mjs"), "--llm-judge", resolve(".")], {
      cwd: resolve("."),
      encoding: "utf8",
      env: { ...process.env, EVAL_LLM_JUDGE_COMMAND: "" },
    })
    expect(judge.status).toBe(1)
    expect(judge.stderr).toContain("LLM judge command is required")
  })
})
