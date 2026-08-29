import { spawnSync } from "node:child_process"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { assertContextComparisonCandidate, parseContextComparisonArguments } from "../scripts/eval/run-context-comparison.mjs"

const SYNTHETIC_CANDIDATE = {
  commit: "0123456789abcdef0123456789abcdef01234567",
  packageVersion: "1.2.3",
} as const

describe("Context comparison runner", () => {
  it("requires explicit candidate metadata instead of inferring a Git revision", () => {
    expect(() => parseContextComparisonArguments(["--manifest", "fixtures.json"])).toThrow("context-comparison-arguments-invalid")
  })

  it("parses the version-neutral manifest runner arguments", () => {
    expect(parseContextComparisonArguments([
      "--manifest",
      "docs/current/context-comparison-manifest.json",
      "--candidate-commit",
      SYNTHETIC_CANDIDATE.commit,
      "--package-version",
      SYNTHETIC_CANDIDATE.packageVersion,
    ])).toEqual({
      candidate: SYNTHETIC_CANDIDATE,
      manifestPath: "docs/current/context-comparison-manifest.json",
    })
  })

  it("rejects explicit metadata that does not bind the checked-out candidate", () => {
    expect(() => assertContextComparisonCandidate(SYNTHETIC_CANDIDATE, {
      commit: "89abcdef0123456789abcdef0123456789abcdef",
      packageVersion: SYNTHETIC_CANDIDATE.packageVersion,
    })).toThrow("context-comparison-candidate-mismatch")
  })

  it("prints bounded help without loading a model, host, or fixture", () => {
    const result = spawnSync(process.execPath, [resolve("scripts/eval/run-context-comparison.mjs"), "--help"], {
      cwd: repositoryRoot(),
      encoding: "utf8",
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Usage: node scripts/eval/run-context-comparison.mjs")
    expect(result.stdout).toContain("binds explicit candidate metadata to the local Git/package identity")
    expect(result.stdout).toContain("not invoke a model, host adapter, network, or workflow")
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
