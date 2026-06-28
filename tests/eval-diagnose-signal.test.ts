import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawnSync } from "node:child_process"

import { afterEach, describe, expect, it } from "vitest"

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

describe("eval signal diagnosis", () => {
  it("classifies provider-limited workflow failures separately from PH workflow dead-ends", () => {
    const signalRoot = tempDir("persona-eval-diagnose-")
    const runDir = join(signalRoot, "runs", "sample")
    mkdirSync(runDir, { recursive: true })
    writeFileSync(
      join(runDir, "results.json"),
      JSON.stringify({
        createdAt: "sample",
        runs: [
          run("plain", "NOT APPLICABLE", ["runtime smoke failure"], null),
          run("ph-on", "INCOMPLETE", ["runtime smoke failure"], "provider-timeout"),
          run("ph-on", "FAIL", ["workflow dead-end"], null),
        ],
      }),
    )

    const result = spawnSync(process.execPath, [resolve("scripts/eval/diagnose-signal.mjs"), "--signal-root", signalRoot], {
      cwd: resolve("."),
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("provider-limit-timeout")
    expect(result.stdout).toContain("ph-workflow-dead-end")
    const diagnosisPath = join(signalRoot, "diagnosis.json")
    expect(existsSync(diagnosisPath)).toBe(true)
    const diagnosis = parseDiagnosis(readFileSync(diagnosisPath, "utf8"))
    expect(diagnosis.workflowFinishFailureSummary).toEqual({
      pass: 0,
      "provider-limit-timeout": 1,
      "ph-workflow-dead-end": 1,
      "timeout-ambiguous": 0,
    })
    expect(diagnosis.labelBreakdown.phOnMinusPlain).toEqual({
      "provider-timeout": 1,
      "runtime smoke failure": 0,
      "workflow dead-end": 1,
    })
  })
})

function run(conditionId: string, workflowFinishOutcome: string, externalFailureModeLabels: readonly string[], providerReason: string | null) {
  return {
    fixtureId: "backend-api-no-stack",
    conditionId,
    repetition: 1,
    workspaceDir: "/tmp/workspace",
    logsDir: "/tmp/logs",
    providerToolCompletion: {
      completionOutcome: providerReason === null ? "COMPLETED" : "TIMED_OUT",
      completionFailureReason: providerReason,
    },
    metrics: {
      workflowFinishOutcome,
      externalFailureModeCount: externalFailureModeLabels.length,
      operationalFailureModeCount: providerReason === null ? 0 : 1,
      externalFailureModeLabels,
      operationalFailureModeLabels: providerReason === null ? [] : [providerReason],
    },
  }
}

function parseDiagnosis(text: string): {
  readonly workflowFinishFailureSummary: Record<string, number>
  readonly labelBreakdown: { readonly phOnMinusPlain: Record<string, number> }
} {
  const parsed: unknown = JSON.parse(text)
  if (!isRecord(parsed) || !isRecord(parsed.workflowFinishFailureSummary) || !isRecord(parsed.labelBreakdown)) {
    throw new Error("invalid diagnosis shape")
  }
  const { labelBreakdown } = parsed
  if (!isRecord(labelBreakdown.phOnMinusPlain)) {
    throw new Error("invalid label breakdown shape")
  }
  return {
    workflowFinishFailureSummary: numberRecord(parsed.workflowFinishFailureSummary),
    labelBreakdown: { phOnMinusPlain: numberRecord(labelBreakdown.phOnMinusPlain) },
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function numberRecord(value: Record<string, unknown>): Record<string, number> {
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === "number"))
}
