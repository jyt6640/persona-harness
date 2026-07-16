import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  runStablePromotionCompletionIntegrity,
  writeStablePromotionWorkflowFixture,
} from "../scripts/stable-promotion-completion-integrity.mjs"

const fixtureRoots: string[] = []

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { force: true, recursive: true })
  }
})

describe("stable promotion completion-integrity runner", () => {
  it("creates its isolated workflow fixture before writing completion evidence", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-stable-promotion-fixture-test-"))
    fixtureRoots.push(projectDir)

    const ready = writeStablePromotionWorkflowFixture(
      projectDir,
      "/safe/installed/ph.js",
      () => ({ output: "", status: 0 }),
    )

    expect(ready).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "implementation-report.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "review-report.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "evidence", "phase0", "verification.json"))).toBe(true)
  })

  it("fails closed without reflecting unsafe command-line fact paths", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const result = runStablePromotionCompletionIntegrity({
      approvalPath: `/private/tmp/${secret}/approval.json`,
      candidateTag: "latest",
      registryFactsPath: `/private/tmp/${secret}/registry.json`,
      sourceHead: "a".repeat(40),
      tarballPath: `/private/tmp/${secret}/candidate.tgz`,
    })

    expect(result.status).toBe("blocked")
    expect(result.stableMovement).toBe("not-authorized")
    expect(JSON.stringify(result)).not.toContain(secret)
  })
})
