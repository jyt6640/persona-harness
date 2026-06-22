import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-plan-report-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph plan report status errors", () => {
  it("fails report status changes when workflow reports do not exist", () => {
    const projectDir = createTempProject()

    const implementation = runPersonaCli(["plan", "--report-filled", "implementation"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const review = runPersonaCli(["plan", "--report-filled", "review"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const invalid = runPersonaCli(["plan", "--report-filled", "unknown"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(implementation.status).toBe(1)
    expect(implementation.stderr).toContain("No implementation report found")
    expect(review.status).toBe(1)
    expect(review.stderr).toContain("No review report found")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain("Report kind must be implementation or review.")
  })
})
