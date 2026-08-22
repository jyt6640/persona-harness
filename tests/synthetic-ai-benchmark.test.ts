import { createHash as createHashImpl } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  createJudgePackage,
  createSyntheticBenchmark,
  validateSyntheticReport,
  writeSyntheticBenchmark,
} from "../scripts/eval/synthetic-ai-benchmark-core.mjs"

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

function benchmark() {
  return createSyntheticBenchmark({
    fixtureId: "multi-step-backend-small",
    fixtureText: "# Synthetic task\n\nBuild a Spring backend.\n",
    model: "openai/gpt-5.4-mini",
    modelVersion: "oauth-2026-08-22",
    platform: "darwin-arm64",
  })
}

describe("synthetic AI benchmark contract", () => {
  it("separates ten public problem cases from the sealed condition key", () => {
    const result = benchmark()

    expect(result.problemSet.schemaVersion).toBe("persona-synthetic-ai-problem-set.1")
    expect(result.problemSet.participantKind).toBe("synthetic-ai")
    expect(result.problemSet.notHumanFeedback).toBe(true)
    expect(result.problemSet.cases).toHaveLength(10)
    expect(result.problemSet.cases.every((entry) => entry.operatorInstruction.length > 0)).toBe(true)
    expect(JSON.stringify(result.problemSet)).not.toContain("conditionId")
    expect(result.sealedAnswerKey.schemaVersion).toBe("persona-synthetic-ai-answer-key.1")
    expect(result.sealedAnswerKey.problemSetDigest).toBe(result.problemSetDigest)
    expect(result.sealedAnswerKey.cases.filter((entry) => entry.conditionId === "plain")).toHaveLength(5)
    expect(result.sealedAnswerKey.cases.filter((entry) => entry.conditionId === "ph-on")).toHaveLength(5)
  })

  it("writes a public task pack and a separate sealed answer key", () => {
    const result = benchmark()
    const root = tempDir("persona-synthetic-benchmark-")
    const paths = writeSyntheticBenchmark(root, result)

    const problemSet = JSON.parse(readFileSync(paths.problemSetPath, "utf8"))
    const answerKey = JSON.parse(readFileSync(paths.answerKeyPath, "utf8"))

    expect(problemSet.cases).toHaveLength(10)
    expect(Object.hasOwn(problemSet, "conditionId")).toBe(false)
    expect(answerKey.problemSetDigest).toBe(result.problemSetDigest)
    expect(paths.answerKeyPath).toContain("sealed")
    const executionPlan = JSON.parse(readFileSync(paths.executionPlanPath, "utf8"))

    expect(executionPlan.schemaVersion).toBe("persona-onoff-eval-run-plan.1")
    expect(executionPlan.runs).toHaveLength(10)
    expect(executionPlan.runs[0]).toMatchObject({
      caseId: "synthetic-ai-01",
      conditionId: "plain",
      operatorProfile: "requirements-first",
    })
    expect(executionPlan.runs[0].operatorInstruction).toContain("acceptance criteria")
  })

  it("rejects a mutated public problem set before it writes benchmark files", () => {
    const result = benchmark()
    const root = tempDir("persona-synthetic-benchmark-invalid-")
    Reflect.set(result.problemSet, "notHumanFeedback", false)

    expect(() => writeSyntheticBenchmark(root, result)).toThrow("invalid synthetic problem set")
  })

  it("rejects a structurally valid public task mutation that no longer matches the sealed key", () => {
    const result = benchmark()
    const root = tempDir("persona-synthetic-benchmark-stale-key-")
    Reflect.set(result.problemSet.cases[0], "operatorInstruction", "Use a different synthetic instruction.")

    expect(() => writeSyntheticBenchmark(root, result)).toThrow("does not bind the problem set")
  })

  it("rejects a malformed sealed answer key before it writes an execution plan", () => {
    const result = benchmark()
    const root = tempDir("persona-synthetic-benchmark-invalid-key-")
    Reflect.set(result.sealedAnswerKey.cases[0], "conditionId", "agents")

    expect(() => writeSyntheticBenchmark(root, result)).toThrow("invalid synthetic answer key")
  })

  it("removes condition and answer-key fields from the judge package", () => {
    const result = benchmark()
    const evalResults = {
      schemaVersion: "persona-onoff-eval.1",
      model: { id: "openai/gpt-5.4-mini", version: "oauth-2026-08-22" },
      environment: { platform: "darwin", os: { arch: "arm64" } },
      runs: result.sealedAnswerKey.cases.map((entry) => {
        const sourceCase = result.problemSet.cases.find((item) => item.caseId === entry.caseId)
        if (!sourceCase) throw new Error(`missing source case: ${entry.caseId}`)
        return {
          fixtureId: "multi-step-backend-small",
          conditionId: entry.conditionId,
          repetition: entry.repetition,
          fixtureHash: result.problemSet.task.sha256,
          syntheticCase: {
            caseId: entry.caseId,
            operatorProfile: sourceCase.operatorProfile,
            instructionSha256: createHash(sourceCase.operatorInstruction),
          },
          outcomes: {
            compileBuildOutcome: "PASS",
            gradleTestOutcome: "PASS",
            runtimeSmokeOutcome: "NOT RUN",
          },
          metrics: {
            stackAlignmentScore: 2,
            externalFailureModeLabels: [],
          },
        }
      }),
    }

    const judgePackage = createJudgePackage(result, evalResults, "stable-seed")
    const serialized = JSON.stringify(judgePackage)

    expect(judgePackage.schemaVersion).toBe("persona-synthetic-ai-judge-package.1")
    expect(judgePackage.notHumanFeedback).toBe(true)
    expect(judgePackage.cases).toHaveLength(10)
    expect(judgePackage.cases[0].observed).toMatchObject({ build: "PASS", test: "PASS", runtime: "NOT RUN", stackAlignment: 2 })
    expect(serialized).not.toContain("conditionId")
    expect(serialized).not.toContain("expectedOutcome")
    expect(serialized).not.toContain("ph-on")

    expect(() =>
      createJudgePackage(
        result,
        { ...evalResults, model: { id: "openai/gpt-5.4-mini", version: "different-version" } },
        "stable-seed",
      ),
    ).toThrow("model version")

    const mismatchedCase = structuredClone(evalResults)
    mismatchedCase.runs[0].syntheticCase.caseId = "synthetic-ai-02"
    expect(() => createJudgePackage(result, mismatchedCase, "stable-seed")).toThrow("synthetic case mismatch")
  })

  it("rejects a report that claims synthetic results are human feedback", () => {
    expect(() =>
      validateSyntheticReport({
        participantKind: "synthetic-ai",
        notHumanFeedback: false,
        claimScope: "synthetic-reliability-only",
      }),
    ).toThrow("notHumanFeedback")

    expect(() =>
      validateSyntheticReport({
        participantKind: "synthetic-ai",
        notHumanFeedback: true,
        claimScope: "synthetic-reliability-only",
        summary: "실사용자 후기에서 만족도가 높았습니다.",
      }),
    ).toThrow("실사용자 후기")
  })

  it("prints a dry-run handoff without exposing the answer key", () => {
    const command = spawnSync(
      process.execPath,
      [
        "scripts/eval/synthetic-ai-benchmark.mjs",
        "--fixture",
        "multi-step-backend-small",
        "--model",
        "openai/gpt-5.4-mini",
        "--model-version",
        "oauth-2026-08-22",
        "--platform",
        "darwin-arm64",
        "--dry-run",
      ],
      { cwd: process.cwd(), encoding: "utf8" },
    )

    expect(command.status).toBe(0)
    const result = JSON.parse(command.stdout)
    expect(result.caseCount).toBe(10)
    expect(result.answerKey).toBe("withheld")
    expect(command.stdout).not.toContain("conditionId")
  })
})

function createHash(value: string): string {
  return createHashImpl("sha256").update(value).digest("hex")
}
