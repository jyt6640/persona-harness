import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { isRecord } from "../src/config/jsonc.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-role-boundary-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeHarnessConfig(projectDir: string, enabled: boolean): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify(
      {
        multiAgent: {
          enabled,
          models: {},
          roles: ["test-writer", "implementer", "reviewer"],
        },
      },
      null,
      2,
    )}\n`,
  )
}

function writeWorkflowWithPendingTicket(projectDir: string, ticketId = "req-1"): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", ticketId), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "backlog.md"),
    [
      "# Persona Workflow Backlog",
      "",
      "Status: active",
      "",
      "| Order | Ticket | Title | Status | Path |",
      "| --- | --- | --- | --- | --- |",
      `| 1 | ${ticketId} | Task CRUD API | pending | .persona/workflow/work/${ticketId}/00-task-card.md |`,
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "work", ticketId, "00-task-card.md"),
    ["# Task Card: req-1", "", "Build the task CRUD API."].join("\n"),
  )
}

function writeRoleArtifact(projectDir: string, ticketId: string, role: string, content: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", ticketId, "roles"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "work", ticketId, "roles", `${role}.md`), content)
}

function roleBoundaryJson(projectDir: string): Record<string, unknown> {
  const result = runPersonaCli(["workflow", "role-boundary", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  const parsed: unknown = JSON.parse(result.stdout)
  expect(isRecord(parsed)).toBe(true)
  return isRecord(parsed) ? parsed : {}
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow role-boundary", () => {
  it("reports likely role-boundary violations without blocking or writing workflow state", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir, true)
    writeWorkflowWithPendingTicket(projectDir)
    writeRoleArtifact(projectDir, "req-1", "test-writer", "# test-writer\n\nImplementation summary: I implemented production code.\n")
    writeRoleArtifact(projectDir, "req-1", "unknown-role", "# unknown\n")

    const output = roleBoundaryJson(projectDir)

    expect(output).toMatchObject({
      blockMode: {
        available: false,
      },
      schemaVersion: "workflow-role-boundary-report.1",
      stableSessionRoleIdentity: "unavailable",
      summary: {
        enabled: true,
        findingCount: 2,
        mode: "report-only",
      },
    })
    expect(JSON.stringify(output.findings)).toContain("role-boundary-forbidden-claim")
    expect(JSON.stringify(output.findings)).toContain("unknown-role-artifact-path")
    expect(JSON.stringify(output.boundaries)).toContain("report-only role-boundary observation; no writes are blocked")
    expect(existsSync(join(projectDir, ".persona", "workflow", "role-boundary.json"))).toBe(false)
  })

  it("keeps block mode unavailable instead of faking deterministic enforcement", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir, true)
    writeWorkflowWithPendingTicket(projectDir)

    const output = roleBoundaryJson(projectDir)

    expect(output.blockMode).toMatchObject({
      available: false,
      reason: expect.stringContaining("Stable per-session agent/role identity is not available"),
    })
    expect(JSON.stringify(output)).not.toContain("block-enabled")
  })

  it("reports legacy role artifact paths as compatibility notes while preserving current role names", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir, true)
    writeWorkflowWithPendingTicket(projectDir)
    writeRoleArtifact(projectDir, "req-1", "jaeki", "# implementer\n\nImplementation summary: changed files and evidence: build pass.\n")

    const output = roleBoundaryJson(projectDir)

    expect(JSON.stringify(output.roleOrder)).toContain("implementer")
    expect(JSON.stringify(output.roleArtifactFiles)).toContain("\"role\":\"implementer\"")
    expect(JSON.stringify(output.roleArtifactFiles)).toContain("\"compatibility\":\"legacy\"")
    expect(JSON.stringify(output.summary)).toContain("legacy role artifact path")
    expect(output.findings).toEqual([])
  })

  it("prints concise human report-only wording", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir, false)
    writeWorkflowWithPendingTicket(projectDir)

    const result = runPersonaCli(["workflow", "role-boundary"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness role-boundary report")
    expect(result.stdout).toContain("Mode: report-only; no writes are blocked")
    expect(result.stdout).toContain("Block mode: unavailable")
    expect(result.stdout).toContain("PH closure/check/archive/finish gates remain authoritative")
  })
})
