import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-public-discovery-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { force: true, recursive: true })
  }
  tempProjects.length = 0
})

describe("public CLI discovery", () => {
  it("keeps root help to the human front door without exposing hidden go recovery", () => {
    const result = runPersonaCli(["--help"], { cwd: createTempProject(), env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Public commands:")
    expect(result.stdout).toContain("  version")
    expect(result.stdout).toContain("  init")
    expect(result.stdout).toContain("  go <goal> | --stdin")
    expect(result.stdout).toContain("  doctor")
    expect(result.stdout).not.toContain("  workflow")
    expect(result.stdout).not.toContain("  dev")
    expect(result.stdout).not.toContain("  bootstrap")
    expect(result.stdout).not.toContain("  evidence")
    expect(result.stdout).not.toContain("recover")
  })

  it("uses workflow help for workflow discovery and dev help for developer aliases", () => {
    const projectDir = createTempProject()
    const workflow = runPersonaCli(["workflow", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const dev = runPersonaCli(["dev", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(workflow.status).toBe(0)
    expect(workflow.stdout).toContain("workflow <check|implement|test|tdd|continue|loop|ralph-loop")
    expect(workflow.stdout).toContain("workflow draft/approve/capture/split/next/archive")
    expect(dev.status).toBe(0)
    expect(dev.stdout).toContain("Usage: ph dev <evidence|smoke|feedback|ralph-loop|observe|bearshell|review>")
    expect(dev.stdout).toContain("Alias for ph evidence")
    expect(dev.stdout).toContain("Alias for ph workflow ralph-loop")
    expect(dev.stdout).toContain("Existing direct command paths remain supported.")
  })

  it("preserves existing direct workflow and developer paths while exposing dev aliases", () => {
    const projectDir = createTempProject()
    const workflow = runPersonaCli(["workflow", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const directEvidence = runPersonaCli(["evidence", "metrics", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const devEvidence = runPersonaCli(["dev", "evidence", "metrics", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const directSmoke = runPersonaCli(["smoke", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const devSmoke = runPersonaCli(["dev", "smoke", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const directFeedback = runPersonaCli(["feedback", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const devFeedback = runPersonaCli(["dev", "feedback", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const directRalph = runPersonaCli(["workflow", "ralph-loop", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const devRalph = runPersonaCli(["dev", "ralph-loop", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const devObserve = runPersonaCli(["dev", "observe", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const devBearshell = runPersonaCli(["dev", "bearshell", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const devReview = runPersonaCli(["dev", "review", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(workflow.status).toBe(0)
    expect(directEvidence.status).toBe(0)
    expect(devEvidence.status).toBe(0)
    expect(devEvidence.stdout).toBe(directEvidence.stdout)
    expect(directSmoke.status).toBe(0)
    expect(directSmoke.stdout).toContain("Usage: ph smoke")
    expect(devSmoke.status).toBe(0)
    expect(devSmoke.stdout).toContain("Usage: ph dev smoke")
    expect(directFeedback.status).toBe(0)
    expect(directFeedback.stdout).toContain("Usage: ph feedback")
    expect(devFeedback.status).toBe(0)
    expect(devFeedback.stdout).toContain("Usage: ph dev feedback")
    expect(directRalph.status).toBe(0)
    expect(devRalph.status).toBe(0)
    expect(devRalph.stdout).toBe(directRalph.stdout)
    expect(devObserve.status).toBe(0)
    expect(devObserve.stdout).toContain("Usage: ph dev observe")
    expect(devBearshell.status).toBe(0)
    expect(devBearshell.stdout).toContain("Usage: ph dev bearshell")
    expect(devReview.status).toBe(0)
    expect(devReview.stdout).toContain("Usage: ph dev review backend-shape")
  })

  it("returns isolated usage errors for invalid root, workflow, and dev inputs", () => {
    const projectDir = createTempProject()
    const root = runPersonaCli(["unknown"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const workflow = runPersonaCli(["workflow", "unknown"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const dev = runPersonaCli(["dev", "unknown"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(root.status).toBe(1)
    expect(root.stderr).toContain("Unknown command: unknown")
    expect(root.stderr).toContain("Public commands:")
    expect(workflow.status).toBe(1)
    expect(workflow.stderr).toContain("Unknown workflow command: unknown")
    expect(workflow.stderr).toContain("Usage: ph workflow")
    expect(dev.status).toBe(1)
    expect(dev.stderr).toContain("Unknown dev command: unknown")
    expect(dev.stderr).toContain("Usage: ph dev")
  })
})
