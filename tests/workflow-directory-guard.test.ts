import { mkdtempSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { workflowLifecycleGuardMode } from "../src/io/workflow-lifecycle-state.js"
import { readWorkflowLoopStateSnapshot, writeWorkflowLoopState, WORKFLOW_LOOP_STATE_SCHEMA_VERSION } from "../src/cli/workflow-loop-state.js"

const tempProjects: string[] = []

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function projectWithWorkflowState(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-guard-test-"))
  tempProjects.push(projectDir)
  const workflowDir = join(projectDir, ".persona", "workflow")
  mkdirSync(workflowDir, { recursive: true })
  writeWorkflowLoopState(
    projectDir,
    {
      finalDecision: "not-run",
      iterations: [],
      rulePackHash: "test",
      schemaVersion: WORKFLOW_LOOP_STATE_SCHEMA_VERSION,
      startedAt: new Date().toISOString(),
    },
    readWorkflowLoopStateSnapshot(projectDir).token,
  )
  return projectDir
}

describe("workflow directory guard", () => {
  it("reads lifecycle state through a real directory", () => {
    const projectDir = projectWithWorkflowState()

    expect(readWorkflowLoopStateSnapshot(projectDir).integrity).toBe("valid")
  })

  it("refuses a workflow directory that was replaced with a symlink", () => {
    const projectDir = projectWithWorkflowState()
    const workflowDir = join(projectDir, ".persona", "workflow")
    const realDir = join(projectDir, ".persona", "workflow-real")
    renameSync(workflowDir, realDir)
    symlinkSync(realDir, workflowDir)

    // The POSIX path refuses this in the open itself; the Windows path refuses
    // it with the lstat check before opening. Both must reach the same verdict.
    expect(readWorkflowLoopStateSnapshot(projectDir).integrity).toBe("unsafe")
  })

  it("refuses a workflow path that is a regular file", () => {
    const projectDir = projectWithWorkflowState()
    const workflowDir = join(projectDir, ".persona", "workflow")
    rmSync(workflowDir, { recursive: true, force: true })
    writeFileSync(workflowDir, "not a directory\n")

    expect(readWorkflowLoopStateSnapshot(projectDir).integrity).toBe("unsafe")
  })

  it("reports a guard mode that matches the platform primitives", () => {
    const mode = workflowLifecycleGuardMode()

    expect(["no-follow-open", "lstat-verified"]).toContain(mode)
    expect(mode).toBe(process.platform === "win32" ? "lstat-verified" : "no-follow-open")
  })
})
