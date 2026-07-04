import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createWorkflowProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-ralph-loop-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow ralph-loop", () => {
  it("previews retry-capped continuation from deterministic closure blockers without writing state", () => {
    const projectDir = createWorkflowProject()

    const result = runPersonaCli(["workflow", "ralph-loop", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const output = JSON.parse(result.stdout)

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(output).toMatchObject({
      schemaVersion: "workflow-ralph-loop.4",
      name: "ralph-loop",
      subtitle: "blocker-driven continuation",
      mode: "dry-run",
      mutates: false,
      defaultOff: true,
      execution: {
        cooldownMs: 30000,
        enabled: false,
        ordinaryIdleContinuationDisabledWhenEnabled: true,
        runtimeSurface: "session.idle",
        runtimeSurfaces: ["session.idle"],
        toolOutputTriggerEnabled: false,
      },
      retryPolicy: {
        maxAttempts: 3,
        maxSessionAttempts: 9,
        attemptsUsed: 0,
        knownSessions: 0,
        remainingSessionAttempts: 9,
        stateSource: "persisted-workflow-state",
      },
      retry: {
        eligible: true,
        reason: "closure-blocker-present",
      },
    })
    expect(output.blocker.id).toBe("verification-unknown")
    expect(output.nextStep).toMatchObject({ blockerId: "verification-unknown", id: "verify-app" })
    expect(output.promptLines.join("\n")).toContain("Closure blockers remain; do not claim completion.")
    expect(output.promptLines.join("\n")).toContain("Blocker: verification-unknown (blocker 1/")
    expect(output.measurementPlan.sample).toBe("n=30 blocker/completion A/B")
    expect(output.boundaries).toContain("read-only dry-run; no workflow state or evidence is written")
    expect(existsSync(join(projectDir, ".persona", "workflow", "ralph-loop.json"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow", "ralph-loop-state.json"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "evidence", "ralph-loop"))).toBe(false)
  })

  it("prints human dry-run guidance without success or reliability claims", () => {
    const projectDir = createWorkflowProject()

    const result = runPersonaCli(["workflow", "ralph-loop", "--dry-run"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Persona Harness ralph-loop: blocker-driven continuation")
    expect(result.stdout).toContain("Mode: dry-run (read-only, default-off, no prompt sent)")
    expect(result.stdout).toContain("Execution config: disabled; runtime surface: session.idle")
    expect(result.stdout).toContain("Tool-output trigger: disabled; idle fallback: available when ralph-loop is enabled")
    expect(result.stdout).toContain("Early completion: blocked by PH closure gate")
    expect(result.stdout).toContain("Retry cap: 3 attempts per blocker; 9 attempts per session")
    expect(result.stdout).toContain("n=30 blocker/completion A/B")
    expect(result.stdout).toContain("not a success, reliability, generated-app quality, or closure guarantee")
  })

  it("advertises the ralph-loop preview in workflow and root help", () => {
    const workflowHelp = runPersonaCli(["workflow", "--help"], { env: {}, invocationName: "ph" })
    const rootHelp = runPersonaCli(["--help"], { env: {}, invocationName: "ph" })

    expect(workflowHelp.status).toBe(0)
    expect(workflowHelp.stdout).toContain("workflow ralph-loop [--dry-run] [--json]")
    expect(rootHelp.status).toBe(0)
    expect(rootHelp.stdout).toContain("workflow ralph-loop")
  })
})
