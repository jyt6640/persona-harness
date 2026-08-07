import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

const authorityReads = { count: 0 }

// Counting the reads is the point of this file: `workflow finish` reached
// `readWorkflowFinishAuthority` twice through two independent paths, and each
// one spawned the Sigstore worker and rescanned source identity. Only the read
// that gates the finish should remain.
vi.mock("../src/cli/workflow-finish-authority.js", async () => {
  const actual = await vi.importActual<typeof import("../src/cli/workflow-finish-authority.js")>(
    "../src/cli/workflow-finish-authority.js",
  )
  return {
    ...actual,
    readWorkflowFinishAuthority: (...args: Parameters<typeof actual.readWorkflowFinishAuthority>) => {
      authorityReads.count += 1
      return actual.readWorkflowFinishAuthority(...args)
    },
  }
})

const { runPersonaCli } = await import("../src/cli/index.js")

const tempProjects: string[] = []

afterEach(() => {
  authorityReads.count = 0
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function initializedProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-single-authority-test-"))
  tempProjects.push(projectDir)
  const workflowDir = join(projectDir, ".persona", "workflow")
  mkdirSync(workflowDir, { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({}, null, 2)}\n`)
  writeFileSync(join(workflowDir, "plan.md"), "Status: accepted\n")
  writeFileSync(join(workflowDir, "implementation-report.md"), "Status: filled\n")
  writeFileSync(join(workflowDir, "review-report.md"), "Status: filled\n")
  return projectDir
}

function finish(projectDir: string) {
  return runPersonaCli(["workflow", "finish", "implement"], {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
  })
}

describe("workflow finish reads the finish authority once", () => {
  it("does not verify the finish authority twice in a single invocation", () => {
    const projectDir = initializedProject()

    finish(projectDir)

    // Two reads means the expensive verification — a worker spawn plus a
    // source-identity scan — is being paid for twice per finish.
    expect(authorityReads.count).toBeLessThanOrEqual(1)
  })

  it("still blocks the finish", () => {
    const projectDir = initializedProject()

    // Reading the authority once must not weaken the gate: this project has no
    // trusted attestation, so finish has to fail.
    expect(finish(projectDir).status).not.toBe(0)
  })

  it("does not read the authority at all when the project is not initialized", () => {
    const projectDir = mkdtempSync(join(tmpdir(), "persona-single-authority-bare-"))
    tempProjects.push(projectDir)

    const result = finish(projectDir)

    expect(result.status).not.toBe(0)
    expect(authorityReads.count).toBe(0)
  })
})
