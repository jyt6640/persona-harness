import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

const repositoryRoot = process.cwd()
const policyScript = join(repositoryRoot, "scripts", "check-supported-node-matrix.mjs")

describe("supported Node matrix policy", () => {
  it("accepts the committed Linux, macOS, and Windows support contract", () => {
    const result = runPolicy(repositoryRoot)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Support Node matrix policy: PASS")
  })

  it("checks out full history for the protected-main signed artifact source", () => {
    const workflow = readFileSync(join(repositoryRoot, ".github", "workflows", "supported-node-matrix.yml"), "utf8")

    expect(workflow).toContain(
      "uses: actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5\n        with:\n          fetch-depth: 0",
    )
  })

  it("rejects a Linux Node matrix drift", () => {
    const fixtureRoot = createPolicyFixture()
    try {
      const workflowPath = join(fixtureRoot, ".github", "workflows", "supported-node-matrix.yml")
      writeFileSync(
        workflowPath,
        readFileSync(workflowPath, "utf8").replace("node: 24", "node: 25"),
      )

      const result = runPolicy(fixtureRoot)

      expect(result.status).toBe(1)
      expect(result.stderr).toContain("matrix rows")
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })

  it("rejects a public support-document drift", () => {
    const fixtureRoot = createPolicyFixture()
    try {
      const readmePath = join(fixtureRoot, "README.md")
      writeFileSync(
        readmePath,
        readFileSync(readmePath, "utf8").replace("macOS Node 22 smoke only", "macOS Node 20 smoke only"),
      )

      const result = runPolicy(fixtureRoot)

      expect(result.status).toBe(1)
      expect(result.stderr).toContain("support table")
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })

  it("rejects removal of the Linux source repository checks", () => {
    const fixtureRoot = createPolicyFixture()
    try {
      const workflowPath = join(fixtureRoot, ".github", "workflows", "supported-node-matrix.yml")
      writeFileSync(
        workflowPath,
        readFileSync(workflowPath, "utf8").replace("npm run test:repository", "npm test"),
      )

      const result = runPolicy(fixtureRoot)

      expect(result.status).toBe(1)
      expect(result.stderr).toContain("Linux repository checks")
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })

  it("rejects a floating workflow action pin", () => {
    const fixtureRoot = createPolicyFixture()
    try {
      const workflowPath = join(fixtureRoot, ".github", "workflows", "supported-node-matrix.yml")
      writeFileSync(
        workflowPath,
        readFileSync(workflowPath, "utf8").replace(
          "actions/checkout@34e114876b0b11c390a56381ad16ebd13914f8d5",
          "actions/checkout@v4",
        ),
      )

      const result = runPolicy(fixtureRoot)

      expect(result.status).toBe(1)
      expect(result.stderr).toContain("immutable checkout action pin")
    } finally {
      rmSync(fixtureRoot, { force: true, recursive: true })
    }
  })
})

function createPolicyFixture(): string {
  const fixtureRoot = mkdtempSync(join(tmpdir(), "persona-supported-node-matrix-policy-"))
  mkdirSync(join(fixtureRoot, ".github", "workflows"), { recursive: true })
  mkdirSync(join(fixtureRoot, "docs"), { recursive: true })
  mkdirSync(join(fixtureRoot, "scripts"), { recursive: true })

  cpSync(
    join(repositoryRoot, ".github", "workflows", "supported-node-matrix.yml"),
    join(fixtureRoot, ".github", "workflows", "supported-node-matrix.yml"),
  )
  cpSync(join(repositoryRoot, "README.md"), join(fixtureRoot, "README.md"))
  cpSync(join(repositoryRoot, "docs", "START-HERE.md"), join(fixtureRoot, "docs", "START-HERE.md"))
  cpSync(policyScript, join(fixtureRoot, "scripts", "check-supported-node-matrix.mjs"))

  return fixtureRoot
}

function runPolicy(cwd: string): ReturnType<typeof spawnSync> {
  return spawnSync(process.execPath, [join("scripts", "check-supported-node-matrix.mjs")], {
    cwd,
    encoding: "utf8",
  })
}
