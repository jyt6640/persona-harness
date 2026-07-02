import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { isRecord } from "../src/config/jsonc.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-relay-artifacts-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeHarnessConfig(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ multiAgent: { enabled: true, roles: ["test-writer", "implementer", "reviewer"], models: {} } }, null, 2)}\n`,
  )
}

function writeWorkflowWithPendingTicket(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", "req-1"), { recursive: true })
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
      "| 1 | req-1 | Task CRUD API | pending | .persona/workflow/work/req-1/00-task-card.md |",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "work", "req-1", "00-task-card.md"),
    ["# Task Card: req-1", "", "Build the task CRUD API."].join("\n"),
  )
}

function writeRoleArtifact(projectDir: string, role: string, content: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", "req-1", "roles"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "work", "req-1", "roles", `${role}.md`), content)
}

function relayJson(projectDir: string, action: "next" | "validate" = "next"): Record<string, unknown> {
  const result = runPersonaCli(["workflow", "relay", action, "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  const parsed: unknown = JSON.parse(result.stdout)
  expect(isRecord(parsed)).toBe(true)
  return isRecord(parsed) ? parsed : {}
}

function relayValidateText(projectDir: string): string {
  const result = runPersonaCli(["workflow", "relay", "validate"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  return result.stdout
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow relay role artifact gates", () => {
  it("validates missing role artifacts without writing artifacts", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithPendingTicket(projectDir)

    const rolesDir = join(projectDir, ".persona", "workflow", "work", "req-1", "roles")
    const output = relayJson(projectDir, "validate")

    expect(output.action).toBe("validate")
    expect(output.currentRole).toBe("test-writer")
    expect(output.requiredArtifact).toBe(".persona/workflow/work/req-1/roles/test-writer.md")
    expect(output.roleArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".persona/workflow/work/req-1/roles/test-writer.md",
          readiness: "missing",
          role: "test-writer",
          status: "missing",
        }),
      ]),
    )
    expect(output.roleCompletionState).toMatchObject({
      completedRoles: [],
      incompleteRoles: [],
      missingRoles: ["test-writer", "implementer", "reviewer"],
      overall: "blocked",
    })
    expect(output.blockers).toEqual([
      expect.objectContaining({
        id: "role-test-artifact-missing",
      }),
    ])
    expect(existsSync(rolesDir)).toBe(false)
  })

  it("prints compact human validation for missing artifacts without writing artifacts", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithPendingTicket(projectDir)

    const rolesDir = join(projectDir, ".persona", "workflow", "work", "req-1", "roles")
    const output = relayValidateText(projectDir)

    expect(output).toContain("Persona Harness relay validation")
    expect(output).toContain("Mode: read-only; no native dispatch, no artifact writes.")
    expect(output).toContain("Current ticket: req-1 - Task CRUD API")
    expect(output).toContain("Current role: test-writer")
    expect(output).toContain("Next role: test-writer")
    expect(output).toContain("- test-writer: missing - .persona/workflow/work/req-1/roles/test-writer.md")
    expect(output).toContain("First blocker: role-test-artifact-missing")
    expect(output).toContain("Required artifact: .persona/workflow/work/req-1/roles/test-writer.md")
    expect(output).toContain("Gate command: npx ph workflow relay next --json")
    expect(output).toContain("Read canonical PH test guidance first: .persona/rules/backend/spring-test.md section 'PH Multi-Agent Relay'.")
    expect(output).toContain("PH closure/check/archive/finish gates remain authoritative.")
    expect(existsSync(rolesDir)).toBe(false)
  })

  it("blocks role progression when the current role artifact is template-like", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithPendingTicket(projectDir)

    writeRoleArtifact(projectDir, "test-writer", "# test-writer\n")

    const output = relayJson(projectDir)

    expect(output.currentRole).toBe("test-writer")
    expect(output.nextRole).toBe("test-writer")
    expect(output.requiredArtifact).toBe(".persona/workflow/work/req-1/roles/test-writer.md")
    expect(output.roleArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".persona/workflow/work/req-1/roles/test-writer.md",
          readiness: "incomplete",
          role: "test-writer",
          status: "present",
        }),
      ]),
    )
    expect(output.roleCompletionState).toMatchObject({
      completedRoles: [],
      currentRole: "test-writer",
      incompleteRoles: ["test-writer"],
      nextRole: "test-writer",
      overall: "blocked",
    })
    expect(output.blockers).toEqual([
      expect.objectContaining({
        id: "role-test-artifact-incomplete",
        source: ".persona/workflow/work/req-1/roles/test-writer.md",
      }),
    ])
  })

  it("blocks each role on role-boundary artifact content before advancing", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithPendingTicket(projectDir)

    writeRoleArtifact(projectDir, "test-writer", "# test-writer\n\nI implemented the production controller and service.")
    expect(relayJson(projectDir).blockers).toEqual([
      expect.objectContaining({
        id: "role-test-artifact-incomplete",
      }),
    ])

    writeRoleArtifact(projectDir, "test-writer", "# test-writer\n\nVerification plan: add a failing API test, then run gradlew.bat test.")
    writeRoleArtifact(projectDir, "implementer", "# implementer\n\nReview only: looks fine.")
    expect(relayJson(projectDir).blockers).toEqual([
      expect.objectContaining({
        id: "role-implementation-artifact-incomplete",
      }),
    ])

    writeRoleArtifact(
      projectDir,
      "implementer",
      "# implementer\n\nImplementation summary: wired service through repository.\nEvidence: ./gradlew test.",
    )
    writeRoleArtifact(projectDir, "reviewer", "# reviewer\n\nImplemented final cleanup.")
    expect(relayJson(projectDir).blockers).toEqual([
      expect.objectContaining({
        id: "role-review-artifact-incomplete",
      }),
    ])
  })

  it("prints compact human validation for incomplete artifacts", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithPendingTicket(projectDir)
    writeRoleArtifact(projectDir, "test-writer", "# test-writer\n")

    const output = relayValidateText(projectDir)

    expect(output).toContain("- test-writer: incomplete - .persona/workflow/work/req-1/roles/test-writer.md")
    expect(output).toContain("test-writer artifact must include failing/verification test evidence or a precise verification plan.")
    expect(output).toContain("First blocker: role-test-artifact-incomplete")
    expect(output).toContain("Include failing/verification test evidence or a precise verification plan.")
  })

  it("validates complete artifacts and returns to closure gates", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithPendingTicket(projectDir)
    writeRoleArtifact(projectDir, "test-writer", "# test-writer\n\nVerification plan: add a failing API test and run ./gradlew test.")
    writeRoleArtifact(
      projectDir,
      "implementer",
      "# implementer\n\nImplementation summary: wired service through repository.\nEvidence: ./gradlew test.",
    )
    writeRoleArtifact(
      projectDir,
      "reviewer",
      "# reviewer\n\nReview result: workflow check reviewed and review-report.md should be filled.",
    )

    const output = relayJson(projectDir, "validate")

    expect(output.action).toBe("validate")
    expect(output.blockers).toEqual([])
    expect(output.gateCommand).toBe("npx ph workflow closure next --json")
    expect(output.roleArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ readiness: "complete", role: "test-writer" }),
        expect.objectContaining({ readiness: "complete", role: "implementer" }),
        expect.objectContaining({ readiness: "complete", role: "reviewer" }),
      ]),
    )
    expect(output.roleCompletionState).toMatchObject({
      completedRoles: ["test-writer", "implementer", "reviewer"],
      incompleteRoles: [],
      missingRoles: [],
      overall: "complete",
    })
  })

  it("prints compact human validation for complete artifacts", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithPendingTicket(projectDir)
    writeRoleArtifact(projectDir, "test-writer", "# test-writer\n\nVerification plan: add a failing API test and run ./gradlew test.")
    writeRoleArtifact(
      projectDir,
      "implementer",
      "# implementer\n\nImplementation summary: wired service through repository.\nEvidence: ./gradlew test.",
    )
    writeRoleArtifact(
      projectDir,
      "reviewer",
      "# reviewer\n\nReview result: workflow check reviewed and review-report.md should be filled.",
    )

    const output = relayValidateText(projectDir)

    expect(output).toContain("- test-writer: complete - .persona/workflow/work/req-1/roles/test-writer.md")
    expect(output).toContain("- implementer: complete - .persona/workflow/work/req-1/roles/implementer.md")
    expect(output).toContain("- reviewer: complete - .persona/workflow/work/req-1/roles/reviewer.md")
    expect(output).toContain("First blocker: none")
    expect(output).toContain("Required artifact: none")
    expect(output).toContain("Gate command: npx ph workflow closure next --json")
  })

  it("reads legacy jaeki and roach artifacts while writing new role paths going forward", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithPendingTicket(projectDir)
    writeRoleArtifact(projectDir, "test-writer", "# test-writer\n\nVerification plan: add a failing API test and run ./gradlew test.")
    writeRoleArtifact(projectDir, "jaeki", "# jaeki\n\nImplementation summary: wired service through repository.\nEvidence: ./gradlew test.")

    const output = relayJson(projectDir)

    expect(output.currentRole).toBe("reviewer")
    expect(output.requiredArtifact).toBe(".persona/workflow/work/req-1/roles/reviewer.md")
    expect(output.roleArtifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ".persona/workflow/work/req-1/roles/jaeki.md",
          readiness: "complete",
          role: "implementer",
          status: "present",
        }),
        expect.objectContaining({
          path: ".persona/workflow/work/req-1/roles/reviewer.md",
          readiness: "missing",
          role: "reviewer",
          status: "missing",
        }),
      ]),
    )
  })
})
