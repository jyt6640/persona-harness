import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

afterEach(() => {
  while (tempProjects.length > 0) {
    const projectDir = tempProjects.pop()
    if (projectDir !== undefined) {
      rmSync(projectDir, { recursive: true, force: true })
    }
  }
})

function bootstrappedProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-template-recovery-test-"))
  tempProjects.push(projectDir)
  writeFileSync(join(projectDir, "package.json"), JSON.stringify({ name: "fixture", private: true }, null, 2))
  const cliOptions = { cwd: projectDir, env: {}, invocationName: "ph" }
  runPersonaCli(["init"], cliOptions)
  runPersonaCli(["bootstrap", "backend"], cliOptions)
  return projectDir
}

function workflowFile(projectDir: string, name: string): string {
  return join(projectDir, ".persona", "workflow", name)
}

describe("workflow template recovery", () => {
  it("restores a deleted report template on the next bootstrap", () => {
    const projectDir = bootstrappedProject()
    rmSync(workflowFile(projectDir, "implementation-report.md"))

    // Report templates are only written while drafting a plan, and bootstrap
    // skips that whole step once plan.md exists, so a deleted template used to
    // have no recovery path at all.
    const result = runPersonaCli(["bootstrap", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("restored missing workflow template")
    expect(existsSync(workflowFile(projectDir, "implementation-report.md"))).toBe(true)
  })

  it("leaves a template that is still present untouched", () => {
    const projectDir = bootstrappedProject()
    const reviewReport = workflowFile(projectDir, "review-report.md")
    writeFileSync(reviewReport, `${readFileSync(reviewReport, "utf8")}\nOPERATOR NOTE\n`)
    rmSync(workflowFile(projectDir, "roles.md"))

    runPersonaCli(["bootstrap", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(readFileSync(reviewReport, "utf8")).toContain("OPERATOR NOTE")
    expect(existsSync(workflowFile(projectDir, "roles.md"))).toBe(true)
  })

  it("reports the missing template in doctor and stops once it is restored", () => {
    const projectDir = bootstrappedProject()
    rmSync(workflowFile(projectDir, "implementation-report.md"))
    const cliOptions = { cwd: projectDir, env: {}, invocationName: "ph" }

    const beforeRestore = runPersonaCli(["doctor"], cliOptions)
    expect(beforeRestore.stdout).toContain("Workflow templates: MISSING")
    expect(beforeRestore.stdout).toContain("implementation-report.md")

    runPersonaCli(["bootstrap", "backend"], cliOptions)
    const afterRestore = runPersonaCli(["doctor"], cliOptions)

    expect(afterRestore.stdout).not.toContain("Workflow templates: MISSING")
  })
})
