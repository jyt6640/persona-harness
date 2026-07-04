import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runBoundedProcess } from "../src/cli/bounded-process.js"
import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createWorkflowProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-loop-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  return projectDir
}

function writeFakeOpencode(projectDir: string): string {
  const command = join(projectDir, "fake-opencode.mjs")
  const logPath = join(projectDir, "fake-opencode.log")
  writeFileSync(
    command,
    [
      "#!/usr/bin/env node",
      "import { appendFileSync } from 'node:fs'",
      `appendFileSync(${JSON.stringify(logPath)}, JSON.stringify(process.argv.slice(2)) + "\\n")`,
      "process.stdout.write('fake opencode completed\\n')",
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

describe("ph workflow loop", () => {
  it("previews a minimal blocker-depth prompt without writing loop state", () => {
    const projectDir = createWorkflowProject()

    const result = runPersonaCli(["workflow", "loop", "--dry-run", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const output = JSON.parse(result.stdout)

    expect(result.status).toBe(0)
    expect(output).toMatchObject({
      defaultOff: true,
      finalDecision: "not-run",
      maxIterations: 3,
      mode: "dry-run",
      schemaVersion: "workflow-loop.1",
    })
    expect(output.promptPreview.join("\n")).toContain("Blocker: verification-unknown (blocker 1/")
    expect(output.promptPreview.join("\n")).not.toContain("read everything again")
    expect(output.termination).toEqual(["finish exit 0", "no remaining closure blockers", "iteration cap"])
    expect(existsSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"))).toBe(false)
  })

  it("runs capped fresh-session iterations and records prompt/log state", () => {
    const projectDir = createWorkflowProject()
    const fakeOpencode = writeFakeOpencode(projectDir)

    const result = runPersonaCli(
      [
        "workflow",
        "loop",
        "--json",
        "--max-iterations",
        "2",
        "--timeout-ms",
        "5000",
        "--grace-ms",
        "10",
        "--opencode-command",
        fakeOpencode,
      ],
      { cwd: projectDir, env: {}, invocationName: "ph" },
    )
    const output = JSON.parse(result.stdout)
    const state = JSON.parse(readFileSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"), "utf8"))
    const firstPrompt = readFileSync(join(projectDir, ".persona", "workflow", "loop", "iteration-1-prompt.md"), "utf8")

    expect(result.status).toBe(0)
    expect(output.finalDecision).toBe("iteration-cap")
    expect(output.iterations).toHaveLength(2)
    expect(state.finalDecision).toBe("iteration-cap")
    expect(state.iterations).toHaveLength(2)
    expect(firstPrompt).toContain("[Persona Harness Workflow Loop]")
    expect(firstPrompt).toContain("Blocker: verification-unknown (blocker 1/")
    expect(firstPrompt).toContain("Fix only this blocker")
    expect(readFileSync(join(projectDir, "fake-opencode.log"), "utf8").split("\n").filter(Boolean)).toHaveLength(2)
  })

  it("advertises the explicit loop command in workflow and root help", () => {
    const workflowHelp = runPersonaCli(["workflow", "--help"], { env: {}, invocationName: "ph" })
    const rootHelp = runPersonaCli(["--help"], { env: {}, invocationName: "ph" })

    expect(workflowHelp.status).toBe(0)
    expect(workflowHelp.stdout).toContain("workflow loop")
    expect(rootHelp.status).toBe(0)
    expect(rootHelp.stdout).toContain("workflow loop")
  })

  it("escalates a timed-out child that ignores SIGTERM", () => {
    const projectDir = createWorkflowProject()
    const command = join(projectDir, "ignore-term.mjs")
    writeFileSync(command, "process.on('SIGTERM', () => {}); setInterval(() => {}, 1000)\n")

    const result = runBoundedProcess({
      args: [command],
      command: process.execPath,
      cwd: projectDir,
      graceMs: 50,
      timeoutMs: 50,
    })

    expect(result.timedOut).toBe(true)
    expect(result.killed).toBe(true)
  })
})
