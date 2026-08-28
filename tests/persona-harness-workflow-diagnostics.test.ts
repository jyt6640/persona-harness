import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { readWorkflowDiagnosis } from "../src/cli/workflow-diagnostics.js"

const projects: string[] = []

function createJavaProject(): string {
  const projectDir = mkdtempSync(
    join(tmpdir(), "persona-workflow-diagnostics-test-"),
  )
  projects.push(projectDir)
  writeFileSync(
    join(projectDir, "settings.gradle"),
    "rootProject.name = 'workflow-diagnostics'\n",
  )
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  const sourceDir = join(
    projectDir,
    "src",
    "main",
    "java",
    "com",
    "example",
    "workflow",
  )
  mkdirSync(sourceDir, { recursive: true })
  writeFileSync(
    join(sourceDir, "WorkflowApplication.java"),
    "package com.example.workflow;\n",
  )
  return projectDir
}

function cli(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, {
    cwd: projectDir,
    env: {},
    invocationName: "ph",
    packageRoot: process.cwd(),
  })
}

function bootstrap(projectDir: string): void {
  expect(
    cli(projectDir, ["bootstrap", "backend", "--strict", "--no-developer-mcp"])
      .status,
  ).toBe(0)
}

function workflowPath(projectDir: string, path: string): string {
  return join(projectDir, ".persona", "workflow", path)
}

afterEach(() => {
  for (const projectDir of projects) {
    rmSync(projectDir, { force: true, recursive: true })
  }
  projects.length = 0
})

describe("ph workflow diagnose", () => {
  it("classifies a missing Persona Harness workspace without creating one", () => {
    const projectDir = createJavaProject()

    const result = cli(projectDir, ["workflow", "diagnose"])

    expect(result).toEqual({
      status: 0,
      stdout: expect.stringContaining("Workspace intake: clean-uninitialized"),
      stderr: "",
    })
    expect(result.stdout).toContain("Next command: npx ph bootstrap backend")
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
  })

  it("does not recommend bootstrap for a partial existing Persona workspace", () => {
    const projectDir = createJavaProject()
    const personaDir = join(projectDir, ".persona")
    mkdirSync(personaDir)
    const harnessPath = join(personaDir, "harness.jsonc")
    writeFileSync(harnessPath, "{\n}\n")

    const diagnosis = readWorkflowDiagnosis(projectDir)

    expect(diagnosis.workspaceIntake).toBe("foreign-stale-unsafe")
    expect(diagnosis.nextCommand).toBeUndefined()
    expect(readFileSync(harnessPath, "utf8")).toBe("{\n}\n")
  })

  it("reports an owned workspace and active artifacts without granting finish authority", () => {
    const projectDir = createJavaProject()
    bootstrap(projectDir)
    const manifest = readFileSync(
      join(projectDir, ".persona", ".ph-init-manifest.json"),
    )
    const plan = readFileSync(workflowPath(projectDir, "plan.md"))

    const result = cli(projectDir, ["workflow", "diagnose"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workspace intake: owned-ready")
    expect(result.stdout).toContain("Active plan: accepted")
    expect(result.stdout).toContain("Implementation report: present")
    expect(result.stdout).toContain("Review report: present")
    expect(result.stdout).toContain("Finish authority: diagnostic-only")
    expect(
      readFileSync(join(projectDir, ".persona", ".ph-init-manifest.json")),
    ).toEqual(manifest)
    expect(readFileSync(workflowPath(projectDir, "plan.md"))).toEqual(plan)
  })

  it("fails closed on a stale owned file without reflecting the project path", () => {
    const projectDir = createJavaProject()
    bootstrap(projectDir)
    const rule = join(projectDir, ".persona", "harness.jsonc")
    writeFileSync(rule, `${readFileSync(rule, "utf8")}\nuser change\n`)

    const result = cli(projectDir, ["workflow", "diagnose"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workspace intake: foreign-stale-unsafe")
    expect(`${result.stdout}${result.stderr}`).not.toContain(projectDir)
    expect(readFileSync(rule, "utf8")).toContain("user change")
  })

  it("classifies a malformed ownership manifest without attempting repair", () => {
    const projectDir = createJavaProject()
    bootstrap(projectDir)
    const manifestPath = join(projectDir, ".persona", ".ph-init-manifest.json")
    writeFileSync(manifestPath, "{\n")

    const result = cli(projectDir, ["workflow", "diagnose"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workspace intake: invalid")
    expect(readFileSync(manifestPath, "utf8")).toBe("{\n")
  })

  it("does not follow an unsafe Persona path", () => {
    const projectDir = createJavaProject()
    const outside = mkdtempSync(
      join(tmpdir(), "persona-workflow-diagnostics-outside-"),
    )
    projects.push(outside)
    symlinkSync(outside, join(projectDir, ".persona"))

    const result = cli(projectDir, ["workflow", "diagnose"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workspace intake: foreign-stale-unsafe")
    expect(`${result.stdout}${result.stderr}`).not.toContain(outside)
    expect(existsSync(join(outside, "workflow"))).toBe(false)
  })

  it("keeps historical artifacts diagnostic-only when the active plan is gone", () => {
    const projectDir = createJavaProject()
    bootstrap(projectDir)
    writeFileSync(
      workflowPath(projectDir, "implementation-report.md"),
      "implementation evidence\n",
    )
    writeFileSync(
      workflowPath(projectDir, "review-report.md"),
      "review evidence\n",
    )
    expect(cli(projectDir, ["history", "--id", "run-001"]).status).toBe(0)
    rmSync(workflowPath(projectDir, "plan.md"))

    const result = cli(projectDir, ["workflow", "diagnose"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Active plan: missing")
    expect(result.stdout).toContain("Workflow history archives: present")
    expect(result.stdout).toContain("Active workflow lifecycle: incomplete")
    expect(result.stdout).toContain("Finish authority: diagnostic-only")
    expect(existsSync(workflowPath(projectDir, "plan.md"))).toBe(false)
  })

  it("reports a current source-read block without invoking finish", () => {
    const projectDir = createJavaProject()
    bootstrap(projectDir)

    const diagnosis = readWorkflowDiagnosis(projectDir, {
      sourceReadPrerequisite: () => "blocked",
    })

    expect(diagnosis.workspaceIntake).toBe("owned-ready")
    expect(diagnosis.sourceReadPrerequisite).toBe("blocked")
  })

  it("rejects extra arguments and advertises the read-only surface in workflow help", () => {
    const projectDir = createJavaProject()

    const help = cli(projectDir, ["workflow", "--help"])
    const invalid = cli(projectDir, ["workflow", "diagnose", "--repair"])

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("diagnose")
    expect(invalid.status).toBe(1)
    expect(invalid.stderr).toContain(
      "workflow diagnose does not accept extra arguments",
    )
    expect(existsSync(join(projectDir, ".persona"))).toBe(false)
  })
})

describe("ph attach --repair --yes", () => {
  it("surfaces a bounded intake classification instead of telling the user to repeat repair", () => {
    const projectDir = createJavaProject()
    bootstrap(projectDir)
    const harnessPath = join(projectDir, ".persona", "harness.jsonc")
    writeFileSync(
      harnessPath,
      readFileSync(harnessPath, "utf8").replace(
        '"executeVerification": true',
        '"executeVerification": false',
      ),
    )
    const manifestPath = join(projectDir, ".persona", ".ph-init-manifest.json")
    writeFileSync(manifestPath, "{\n")

    const result = cli(projectDir, ["attach", "--repair", "--yes"])

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow intake: invalid")
    expect(result.stderr).toContain("Next command: npx ph workflow diagnose")
    expect(result.stderr).not.toContain(
      "Next command: npx ph attach --repair --yes",
    )
    expect(readFileSync(manifestPath, "utf8")).toBe("{\n")
  })
})
