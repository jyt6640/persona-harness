import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
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
    `${JSON.stringify({ multiAgent: { enabled: true, roles: ["test-writer", "jaeki", "roach"], models: {} } }, null, 2)}\n`,
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

function relayJson(projectDir: string): Record<string, unknown> {
  const result = runPersonaCli(["workflow", "relay", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
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

describe("ph workflow relay role artifact gates", () => {
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
    writeRoleArtifact(projectDir, "jaeki", "# jaeki\n\nReview only: looks fine.")
    expect(relayJson(projectDir).blockers).toEqual([
      expect.objectContaining({
        id: "role-implementation-artifact-incomplete",
      }),
    ])

    writeRoleArtifact(projectDir, "jaeki", "# jaeki\n\nImplementation summary: wired service through repository.\nEvidence: ./gradlew test.")
    writeRoleArtifact(projectDir, "roach", "# roach\n\nImplemented final cleanup.")
    expect(relayJson(projectDir).blockers).toEqual([
      expect.objectContaining({
        id: "role-review-artifact-incomplete",
      }),
    ])
  })
})
