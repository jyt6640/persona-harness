import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import {
  AtomicWriteConflictError,
  readTextFileSnapshot,
  writeFileAtomicIfUnchanged,
} from "../src/io/atomic-file.js"
import { runPlanCommand } from "../src/cli/plan-command.js"
import { runWorkflowCommand } from "../src/cli/workflow-command.js"
import {
  emptyRalphLoopState,
  ralphLoopStatePath,
  readRalphLoopStateSnapshot,
  writeRalphLoopState,
} from "../src/runtime/ralph-loop-state.js"

const tempProjects: string[] = []

function createTempProject(prefix = "persona-workflow-state-concurrency-"): string {
  const projectDir = mkdtempSync(join(tmpdir(), prefix))
  tempProjects.push(projectDir)
  return projectDir
}

function writeHarnessWorkflow(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
}

function writeSubstantiveImplementationReport(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: template",
      "- README ranges read: 1-220",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- BUILD SUCCESSFUL",
    ].join("\n"),
  )
}

function writeFakeOpencodeThatTouchesLoopState(projectDir: string): string {
  const command = join(projectDir, "fake-opencode-touch-loop-state.mjs")
  const statePath = join(projectDir, ".persona", "workflow", "workflow-loop-state.json")
  writeFileSync(
    command,
    [
      "#!/usr/bin/env node",
      "import { mkdirSync, writeFileSync } from 'node:fs'",
      "import { dirname } from 'node:path'",
      `const statePath = ${JSON.stringify(statePath)}`,
      "mkdirSync(dirname(statePath), { recursive: true })",
      "writeFileSync(statePath, `${JSON.stringify({ schemaVersion: 'workflow-loop-state.1', finalDecision: 'not-run', iterations: [], startedAt: new Date(0).toISOString() }, null, 2)}\\n`)",
      "process.stdout.write('touched loop state\\n')",
    ].join("\n"),
  )
  chmodSync(command, 0o755)
  return command
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("workflow state concurrent write protection", () => {
  it("refuses to atomically replace a stale file snapshot", () => {
    const projectDir = createTempProject()
    const targetPath = join(projectDir, ".persona", "workflow", "state.md")
    mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
    writeFileSync(targetPath, "Status: template\n")
    const snapshot = readTextFileSnapshot(targetPath)
    writeFileSync(targetPath, "Status: template\n- concurrent hook note\n")

    expect(() => writeFileAtomicIfUnchanged(snapshot, "Status: filled\n")).toThrow(AtomicWriteConflictError)
    expect(readFileSync(targetPath, "utf8")).toContain("concurrent hook note")
  })

  it("aborts report-filled when a workflow report changes after read", () => {
    const projectDir = createTempProject()
    writeHarnessWorkflow(projectDir)
    writeSubstantiveImplementationReport(projectDir)
    const reportPath = join(projectDir, ".persona", "workflow", "implementation-report.md")

    const result = runPlanCommand(
      ["--report-filled", "implementation"],
      {
        onBeforeWorkflowStateWrite: (path) => {
          if (path === reportPath) {
            writeFileSync(path, "Status: template\n- concurrent hook note\n")
          }
        },
        projectDir,
      },
      "ph",
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow state changed while Persona Harness was updating")
    expect(result.stderr).toContain(".persona/workflow/implementation-report.md")
    expect(readFileSync(reportPath, "utf8")).toContain("concurrent hook note")
    expect(readFileSync(reportPath, "utf8")).not.toContain("Status: filled")
  })

  it("aborts requirements approval when the draft backlog changes after read", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona", "workflow", "requirements"), { recursive: true })
    const backlogPath = join(projectDir, ".persona", "workflow", "requirements", "backlog.md")
    writeFileSync(
      backlogPath,
      [
        "# Requirements Draft Backlog",
        "",
        "Status: draft",
        "schemaVersion: workflow-requirements-backlog.1",
        "",
      ].join("\n"),
    )

    const result = runWorkflowCommand(
      ["approve", "requirements"],
      {
        onBeforeWorkflowStateWrite: (path) => {
          if (path === backlogPath) {
            writeFileSync(path, "# Requirements Draft Backlog\n\nStatus: draft\n\nConcurrent user edit\n")
          }
        },
        projectDir,
      },
      "ph",
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow state changed while Persona Harness was updating")
    expect(result.stderr).toContain(".persona/workflow/requirements/backlog.md")
    expect(readFileSync(backlogPath, "utf8")).toContain("Concurrent user edit")
    expect(readFileSync(backlogPath, "utf8")).not.toContain("Status: accepted")
  })

  it("aborts workflow loop state writes when an external session updates the state file first", () => {
    const projectDir = createTempProject()
    writeHarnessWorkflow(projectDir)
    const fakeOpencode = writeFakeOpencodeThatTouchesLoopState(projectDir)
    const result = runWorkflowCommand(
      [
        "loop",
        "--json",
        "--max-iterations",
        "1",
        "--timeout-ms",
        "5000",
        "--grace-ms",
        "10",
        "--opencode-command",
        fakeOpencode,
      ],
      { projectDir },
      "ph",
    )

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow state changed while Persona Harness was updating")
    expect(result.stderr).toContain(".persona/workflow/workflow-loop-state.json")
    expect(readFileSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"), "utf8")).toContain(
      "workflow-loop-state.1",
    )
  })

  it("preserves hook-owned ralph-loop state when another writer changes it after read", () => {
    const projectDir = createTempProject()
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const now = "2026-07-05T00:00:00.000Z"
    const snapshot = readRalphLoopStateSnapshot(projectDir, now)
    writeRalphLoopState(projectDir, { ...emptyRalphLoopState(now), updatedAt: "2026-07-05T00:00:01.000Z" })

    const written = writeRalphLoopState(
      projectDir,
      { ...emptyRalphLoopState(now), updatedAt: "2026-07-05T00:00:02.000Z" },
      snapshot.token,
    )

    expect(written).toBe(false)
    expect(readFileSync(ralphLoopStatePath(projectDir), "utf8")).toContain("2026-07-05T00:00:01.000Z")
    expect(readFileSync(ralphLoopStatePath(projectDir), "utf8")).not.toContain("2026-07-05T00:00:02.000Z")
    warning.mockRestore()
  })
})
