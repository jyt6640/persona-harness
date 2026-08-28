import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { parseContextComparisonArguments } from "../scripts/eval/run-context-comparison.mjs"

describe("Context comparison runner", () => {
  it("requires explicit candidate metadata instead of inferring a Git revision", () => {
    expect(() => parseContextComparisonArguments(["--manifest", "fixtures.json"])).toThrow("context-comparison-arguments-invalid")
  })

  it("parses the version-neutral manifest runner arguments", () => {
    expect(parseContextComparisonArguments([
      "--manifest",
      "docs/current/context-comparison-manifest.json",
      "--candidate-commit",
      "a562331f9db321845b05da1e16edc4b83bf78ece",
      "--package-version",
      "0.8.32",
    ])).toEqual({
      candidate: { commit: "a562331f9db321845b05da1e16edc4b83bf78ece", packageVersion: "0.8.32" },
      manifestPath: "docs/current/context-comparison-manifest.json",
    })
  })

  it("prints bounded help without loading a model, host, or fixture", () => {
    const result = spawnSync(process.execPath, [resolve("scripts/eval/run-context-comparison.mjs"), "--help"], {
      cwd: repositoryRoot(),
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: node scripts/eval/run-context-comparison.mjs")
    expect(result.stdout).toContain("does not invoke a model, host adapter, network, or workflow")
  })

  it("does not execute the CLI argument parser when the runner is imported", () => {
    const result = spawnSync(process.execPath, ["--input-type=module", "--eval", "import './scripts/eval/run-context-comparison.mjs'"], {
      cwd: repositoryRoot(),
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
  })
})

function repositoryRoot(): string {
  return resolve(process.cwd())
}
