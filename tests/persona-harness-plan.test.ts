import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-plan-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeProfile(projectDir: string): void {
  const profile = {
    schema: "persona.project-profile.v1",
    status: "draft",
    scope: {
      role: "backend",
      mvp: "java-spring-clean-code",
      productized: false,
    },
    questions: [
      { id: "storage", prompt: "storage", choices: [], answer: "database" },
      { id: "persistence-technology", prompt: "persistence", choices: [], answer: "jdbc-template" },
      { id: "migration-style", prompt: "migration", choices: [], answer: "flyway" },
      { id: "package-style", prompt: "package", choices: [], answer: "domain-first" },
      { id: "dto-strictness", prompt: "dto", choices: [], answer: "strict" },
    ],
  }

  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(profile, null, 2)}\n`)
}

function readPlan(projectDir: string): string {
  return readFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "utf8")
}

function readImplementationReport(projectDir: string): string {
  return readFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "utf8")
}

function readReviewReport(projectDir: string): string {
  return readFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "utf8")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph plan", () => {
  it("creates a blackbear planning artifact from README and backend profile summary", () => {
    const projectDir = createTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Equipment Rental API\n\n- 장비 등록\n- 장비 대여\n")
    const intake = runPersonaCli(["intake"], { cwd: projectDir, env: {}, invocationName: "ph" })
    expect(intake.status).toBe(0)
    writeProfile(projectDir)

    const result = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness blackbear plan draft created.")
    expect(result.stderr).toBe("")
    expect(existsSync(join(projectDir, ".persona", "workflow", "plan.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "implementation-report.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "review-report.md"))).toBe(true)

    const plan = readPlan(projectDir)
    expect(plan).toContain("# Blackbear Architecture Plan")
    expect(plan).toContain("Role: `blackbear`")
    expect(plan).toContain("Requirements source: `README.md`")
    expect(plan).toContain("README heading: Equipment Rental API")
    expect(plan).toContain("- storage: database")
    expect(plan).toContain("- persistence-technology: jdbc-template")
    expect(plan).toContain("- migration-style: flyway")
    expect(plan).toContain("- package-style: domain-first")
    expect(plan).toContain("- dto-strictness: strict")
    expect(plan).toContain("implementation must not start until this plan is reviewed or accepted")

    const implementationReport = readImplementationReport(projectDir)
    expect(implementationReport).toContain("# Jaeki Implementation Report")
    expect(implementationReport).toContain("Status: template")
    expect(implementationReport).toContain("## Implemented Files")
    expect(implementationReport).toContain("## Verification")
    expect(implementationReport).toContain("## Manual QA")

    const reviewReport = readReviewReport(projectDir)
    expect(reviewReport).toContain("# Roach Review Report")
    expect(reviewReport).toContain("Status: template")
    expect(reviewReport).toContain("## Requirements Check")
    expect(reviewReport).toContain("## Boundary Review")
    expect(reviewReport).toContain("## Remaining Limits")
  })

  it("keeps profile summary optional and marks missing README without crashing", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const plan = readPlan(projectDir)
    expect(plan).toContain("Requirements source: `README.md`")
    expect(plan).toContain("README status: missing")
    expect(plan).toContain("- 응답된 항목 없음")
  })

  it("does not overwrite existing workflow artifacts unless --force is used", () => {
    const projectDir = createTempProject()
    const first = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
    writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "custom plan\n")
    writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "custom implementation\n")
    writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "custom review\n")

    const duplicate = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const forced = runPersonaCli(["plan", "--force"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(duplicate.status).toBe(1)
    expect(duplicate.stderr).toContain("already exists")
    expect(forced.status).toBe(0)
    expect(readPlan(projectDir)).toContain("# Blackbear Architecture Plan")
    expect(readPlan(projectDir)).toContain("Status: draft")
    expect(readImplementationReport(projectDir)).toContain("# Jaeki Implementation Report")
    expect(readReviewReport(projectDir)).toContain("# Roach Review Report")
  })

  it("reads and updates the plan acceptance status", () => {
    const projectDir = createTempProject()
    const draft = runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" })

    const draftStatus = runPersonaCli(["plan", "--status"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const accepted = runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const acceptedStatus = runPersonaCli(["plan", "--status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(draft.status).toBe(0)
    expect(draftStatus.status).toBe(0)
    expect(draftStatus.stdout).toContain("Status: draft")
    expect(accepted.status).toBe(0)
    expect(accepted.stdout).toContain("Status: accepted")
    expect(acceptedStatus.stdout).toContain("Status: accepted")
    expect(readPlan(projectDir)).toContain("Status: accepted")

    const revise = runPersonaCli(["plan", "--revise"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const reviseStatus = runPersonaCli(["plan", "--status"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(revise.status).toBe(0)
    expect(revise.stdout).toContain("Status: needs-revision")
    expect(reviseStatus.stdout).toContain("Status: needs-revision")
    expect(readPlan(projectDir)).toContain("Status: needs-revision")
  })

  it("fails plan status changes when the plan artifact does not exist", () => {
    const projectDir = createTempProject()

    const status = runPersonaCli(["plan", "--status"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const accept = runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const revise = runPersonaCli(["plan", "--revise"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(status.status).toBe(1)
    expect(status.stderr).toContain("No workflow plan found")
    expect(accept.status).toBe(1)
    expect(accept.stderr).toContain("No workflow plan found")
    expect(revise.status).toBe(1)
    expect(revise.stderr).toContain("No workflow plan found")
  })

  it("shows usage, rejects unknown options, and advertises plan in shared usage", () => {
    const projectDir = createTempProject()

    const help = runPersonaCli(["plan", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const invalid = runPersonaCli(["plan", "--unknown"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const rootHelp = runPersonaCli(["--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("Usage: ph plan [--force | --status | --accept | --revise]")
    expect(help.stdout).toContain("--accept")
    expect(help.stdout).toContain("--revise")
    expect(help.stdout).toContain(".persona/workflow/implementation-report.md")
    expect(help.stdout).toContain(".persona/workflow/review-report.md")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain("Unknown option: --unknown")
    expect(rootHelp.stdout).toContain("plan")
    expect(rootHelp.stdout).toContain("Create a blackbear architecture plan draft")
  })
})
