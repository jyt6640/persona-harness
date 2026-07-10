import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createHarnessProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-prompt-workflow-transition-test-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  return projectDir
}

function writeFilledWorkflowReports(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    "Status: filled\n- `npx ph bearshell --shell './gradlew test'`\n",
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
  )
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("prompt-only requirements workflow transitions", () => {
  it("keeps capture, draft, approve, split, next, and pending-ticket finish block safe", () => {
    const projectDir = createHarnessProject()
    const promptRequirements = [
      "# Prompt Requirements",
      "",
      "## Step 1. 장비 등록",
      "",
      "- 프롬프트로 받은 장비를 등록한다.",
      "",
      "## Step 2. 대여 신청",
      "",
      "- 사용자가 장비 대여를 신청한다.",
    ].join("\n")

    const capture = runPersonaCli(["workflow", "capture", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: promptRequirements,
    })
    const capturedPrompt = readFileSync(join(projectDir, ".persona", "workflow", "requirements", "latest.md"), "utf8")
    const draft = runPersonaCli(["workflow", "draft", "--stdin"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      stdin: "장비 대여 웹 서비스 만들래",
    })
    const approve = runPersonaCli(["workflow", "approve", "requirements"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const split = runPersonaCli(["workflow", "split", ".persona/workflow/requirements/backlog.md"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })
    const next = runPersonaCli(["workflow", "next"], { cwd: projectDir, env: {}, invocationName: "ph" })
    writeFilledWorkflowReports(projectDir)

    const finish = runPersonaCli(["workflow", "finish", "implement"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
    })

    expect(capture.status).toBe(0)
    expect(capturedPrompt).toContain("## Step 1. 장비 등록")
    expect(capturedPrompt).toContain("- 프롬프트로 받은 장비를 등록한다.")
    expect(draft.status).toBe(0)
    expect(draft.stdout).toContain("Requirements draft complete")
    expect(approve.status).toBe(0)
    expect(approve.stdout).toContain("Requirements draft approved")
    expect(split.status).toBe(0)
    expect(split.stdout).toContain("Tickets created: 4")
    expect(next.status).toBe(0)
    expect(next.stdout).toContain("Ticket: step-1")
    expect(next.stdout).toContain(".persona/workflow/work/step-1/00-task-card.md")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: verification-unknown")
    expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
    expect(finish.stderr).toContain("Other blockers:\n- pending-ticket")
  })
})
