import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { isRecord } from "../src/config/jsonc.js"
import { createPhase0Hooks } from "../src/runtime/hooks.js"
import { observeRoleBoundaryWrite } from "../src/runtime/role-boundary-heuristic.js"
import { isWriteOrEditTool } from "../src/runtime/role-boundary-policy.js"

const tempProjects: string[] = []

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-role-boundary-heuristic-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeHarnessConfig(projectDir: string, multiAgentEnabled = true): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify(
      {
        multiAgent: {
          enabled: multiAgentEnabled,
          models: {},
          roles: ["test-writer", "implementer", "reviewer"],
        },
      },
      null,
      2,
    )}\n`,
  )
}

function writeWorkflowWithTicket(projectDir: string, ticketId = "req-1"): void {
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

function writeTarget(projectDir: string, relativePath: string): string {
  const path = join(projectDir, ...relativePath.split("/"))
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, "class Placeholder {}\n")
  return path
}

function roleBoundaryEvidence(projectDir: string): readonly Record<string, unknown>[] {
  const evidenceDir = join(projectDir, ".persona", "evidence", "role-boundary")
  if (!existsSync(evidenceDir)) {
    return []
  }
  return readdirSync(evidenceDir)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => {
      const parsed: unknown = JSON.parse(readFileSync(join(evidenceDir, fileName), "utf8"))
      if (!isRecord(parsed)) {
        throw new Error(`expected role-boundary evidence object: ${fileName}`)
      }
      return parsed
    })
}

function roleBoundaryJson(projectDir: string): Record<string, unknown> {
  const result = runPersonaCli(["workflow", "role-boundary", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
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

describe("role-boundary heuristic write observation", () => {
  it("matches only explicit file write/edit tools", () => {
    expect(isWriteOrEditTool("write")).toBe(true)
    expect(isWriteOrEditTool("edit")).toBe(true)
    expect(isWriteOrEditTool("multi_edit")).toBe(true)
    expect(isWriteOrEditTool("apply_patch")).toBe(true)
    expect(isWriteOrEditTool("todowrite")).toBe(false)
    expect(isWriteOrEditTool("todo_write")).toBe(false)
    expect(isWriteOrEditTool("read")).toBe(false)
  })

  it("does not read relay state when multi-agent is disabled", () => {
    const projectDir = createProject()
    let relayReadCount = 0

    observeRoleBoundaryWrite(
      {
        multiAgentEnabled: false,
        projectDir,
        sessionID: "session-disabled",
        targetFile: "src/main/java/demo/ReservationService.java",
        tool: "write",
      },
      {
        readRelayPayload() {
          relayReadCount += 1
          throw new Error("relay state should not be read while multiAgent is disabled")
        },
      },
    )

    expect(relayReadCount).toBe(0)
    expect(roleBoundaryEvidence(projectDir)).toEqual([])
  })

  it("aggregates disallowed production writes for the current test-writer role and reports them", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithTicket(projectDir)
    const targetFile = writeTarget(projectDir, "src/main/java/demo/ReservationService.java")
    const hooks = createPhase0Hooks({ projectDir })

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-role-boundary", callID: "call-1", args: { path: targetFile } },
      { title: "write", output: "ok", metadata: {} },
    )
    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-role-boundary", callID: "call-2", args: { path: targetFile } },
      { title: "write", output: "ok", metadata: {} },
    )

    const evidence = roleBoundaryEvidence(projectDir)
    expect(evidence).toHaveLength(1)
    expect(evidence[0]).toMatchObject({
      count: 2,
      evidenceKind: "role-boundary-heuristic",
      reportOnly: true,
      enforcement: false,
      sessionID: "session-role-boundary",
    })
    expect(JSON.stringify(evidence[0])).toContain("heuristic time-window attribution")
    expect(JSON.stringify(evidence[0])).toContain("src/main/java/demo/ReservationService.java")

    const report = roleBoundaryJson(projectDir)
    expect(report.schemaVersion).toBe("workflow-role-boundary-report.2")
    expect(JSON.stringify(report.findings)).toContain("role-boundary-heuristic-write-outside-role")
    expect(JSON.stringify(report.findings)).toContain("\"heuristic\":true")
    expect(JSON.stringify(report.boundaries)).toContain("artifact-scan only")
  })

  it("does not record allowed test paths for the current test-writer role", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithTicket(projectDir)
    const targetFile = writeTarget(projectDir, "src/test/java/demo/ReservationServiceTest.java")
    const hooks = createPhase0Hooks({ projectDir })

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-allowed-test", callID: "call-1", args: { path: targetFile } },
      { title: "write", output: "ok", metadata: {} },
    )

    expect(roleBoundaryEvidence(projectDir)).toEqual([])
  })

  it("does not record heuristic evidence when no current role is available", async () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir)
    writeWorkflowWithTicket(projectDir)
    writeRoleArtifact(projectDir, "req-1", "test-writer", "failing test evidence: ./gradlew test\n")
    writeRoleArtifact(projectDir, "req-1", "implementer", "implementation summary: changed files evidence: build pass\n")
    writeRoleArtifact(projectDir, "req-1", "reviewer", "review result: workflow check passed\n")
    const targetFile = writeTarget(projectDir, "src/main/java/demo/ReservationService.java")
    const hooks = createPhase0Hooks({ projectDir })

    await hooks["tool.execute.after"]?.(
      { tool: "write", sessionID: "session-no-current-role", callID: "call-1", args: { path: targetFile } },
      { title: "write", output: "ok", metadata: {} },
    )

    expect(roleBoundaryEvidence(projectDir)).toEqual([])
  })

  it("skips truncated heuristic evidence during report aggregation without crashing", () => {
    const projectDir = createProject()
    const evidenceDir = join(projectDir, ".persona", "evidence", "role-boundary")
    mkdirSync(evidenceDir, { recursive: true })
    writeFileSync(join(evidenceDir, "session-role-boundary.json"), "{ nope\n")

    const report = roleBoundaryJson(projectDir)

    expect(report.schemaVersion).toBe("workflow-role-boundary-report.2")
    expect(report.findings).toEqual([])
  })
})
