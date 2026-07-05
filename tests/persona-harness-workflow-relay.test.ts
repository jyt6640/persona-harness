import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { isRecord } from "../src/config/jsonc.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-relay-test-"))
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
          roles: ["test-writer", "implementer", "reviewer"],
          models: {},
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

function writeRoleArtifact(projectDir: string, ticketId: string, role: string, content?: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", ticketId, "roles"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "work", ticketId, "roles", `${role}.md`),
    content ?? `# ${role}\n`,
  )
}

function writeRule(projectDir: string, relativePath: string, frontmatter: string, policies: readonly string[]): void {
  const fullPath = join(projectDir, ".persona", "rules", relativePath)
  mkdirSync(dirname(fullPath), { recursive: true })
  writeFileSync(
    fullPath,
    `---\n${frontmatter.trim()}\n---\n\n# Test Rule\n\n${policies.map((policy) => `- ${policy}`).join("\n")}\n`,
  )
}

function relayJson(projectDir: string, action: "next" | "status" = "next"): Record<string, unknown> {
  const result = runPersonaCli(["workflow", "relay", action, "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
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

describe("ph workflow relay read-only preview", () => {
  it("stays disabled by default and points to the opt-in bootstrap flag", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir, false)
    writeWorkflowWithPendingTicket(projectDir)

    const output = relayJson(projectDir)

    expect(output.enabled).toBe(false)
    expect(output.currentRole).toBeNull()
    expect(output.nextRole).toBeNull()
    expect(output.promptBlock).toBe("")
    expect(output.requiredArtifact).toBeNull()
    expect(output.requiredOutputArtifact).toBeNull()
    expect(output.roleOrder).toEqual(["test-writer", "implementer", "reviewer"])
    expect(output.roleCompletionState).toMatchObject({
      currentRole: null,
      nextRole: null,
      overall: "disabled",
    })
    expect(output.blockers).toEqual([
      expect.objectContaining({
        id: "multi-agent-disabled",
        source: ".persona/harness.jsonc",
      }),
    ])
  })

  it("emits the first missing role handoff from the current ticket and closure blocker", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir, true)
    writeWorkflowWithPendingTicket(projectDir)
    writeRule(
      projectDir,
      "backend/test-writer-only.md",
      `
id: backend.test-writer-only
source: backend-policy
domain: backend
topic: tests
roles:
  - test-writer
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
`,
      ["test-writer scoped policy"],
    )
    writeRule(
      projectDir,
      "backend/reviewer-only.md",
      `
id: backend.reviewer-only
source: backend-policy
domain: backend
topic: review
roles:
  - reviewer
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
`,
      ["reviewer scoped policy"],
    )

    const output = relayJson(projectDir)

    expect(output.enabled).toBe(true)
    expect(output.currentRole).toBe("test-writer")
    expect(output.nextRole).toBe("test-writer")
    expect(output.requiredArtifact).toBe(".persona/workflow/work/req-1/roles/test-writer.md")
    expect(output.requiredOutputArtifact).toBe(".persona/workflow/work/req-1/roles/test-writer.md")
    expect(output.rulePackHash).toMatch(/^sha256:[a-f0-9]{64}$/u)
    expect(output.scopedInputFiles).toEqual(
      expect.arrayContaining([
        ".persona/workflow/plan.md",
        ".persona/workflow/work/req-1/00-task-card.md",
        ".persona/workflow/implementation-report.md",
        ".persona/workflow/review-report.md",
      ]),
    )
    expect(output.scopedInputFiles).toEqual(output.scopedInputs)
    expect(output.roleCompletionState).toMatchObject({
      completedRoles: [],
      currentRole: "test-writer",
      missingRoles: ["test-writer", "implementer", "reviewer"],
      nextRole: "test-writer",
      overall: "blocked",
    })
    expect(output.blockers).toEqual([
      expect.objectContaining({
        id: "role-test-artifact-missing",
        source: ".persona/workflow/work/req-1/roles/test-writer.md",
      }),
    ])
    expect(output.promptLines).toEqual(
      expect.arrayContaining([
        "Role: test-writer.",
        "When the host exposes subagent/task invocation, invoke the `test-writer` subagent via the task tool for this role stage.",
        "If host subagent invocation is unavailable or not taken, complete this role checklist in the main session.",
        "Record whether subagent invocation was used or unavailable in the role artifact.",
        "Read canonical PH test guidance first: .persona/rules/backend/spring-test.md section 'PH Multi-Agent Relay' (legacy section name for the Role Checklist Relay contract) and the current ticket/scenario contract rule.",
        "Detailed reference, if available in this package: packages/shared-skills/skills/programming/references/java/testing.md section 'Persona Harness relay contract'.",
        "Do not implement production code.",
        "Do not weaken, delete, or rewrite existing tests to pass without preserving behavior.",
        "Then rerun `npx ph workflow relay next --json`.",
      ]),
    )
    expect(output.promptBlock).toContain("Role: test-writer.")
    expect(output.promptBlock).toContain("PH Role Checklist Relay is a main-session role checklist rail")
    expect(output.promptBlock).toContain("When the host exposes subagent/task invocation")
    expect(output.promptBlock).toContain("invoke the `test-writer` subagent via the task tool")
    expect(output.promptBlock).toContain("complete this role checklist in the main session")
    expect(output.promptBlock).toContain("Record whether subagent invocation was used or unavailable")
    expect(output.promptBlock).toContain("PH Multi-Agent Relay")
    expect(output.promptBlock).toContain("Persona Harness relay contract")
    expect(output.promptBlock).toContain("Scoped PH rules (role: test-writer")
    expect(output.promptBlock).toContain("Rule pack hash: sha256:")
    expect(output.promptBlock).toContain("test-writer scoped policy")
    expect(output.promptBlock).not.toContain("reviewer scoped policy")
  })

  it("progresses through implementer and reviewer artifacts before returning to closure gates", () => {
    const projectDir = createTempProject()
    writeHarnessConfig(projectDir, true)
    writeWorkflowWithPendingTicket(projectDir)

    writeRoleArtifact(
      projectDir,
      "req-1",
      "test-writer",
      [
        "# test-writer",
        "",
        "Verification plan: add a failing controller test for task creation and run ./gradlew test.",
      ].join("\n"),
    )
    const implementer = relayJson(projectDir)
    expect(implementer.currentRole).toBe("implementer")
    expect(implementer.nextRole).toBe("implementer")
    expect(implementer.promptBlock).toContain("invoke the `implementer` subagent via the task tool")
    expect(implementer.promptBlock).toContain("complete this role checklist in the main session")
    expect(implementer.roleCompletionState).toMatchObject({
      completedRoles: ["test-writer"],
      currentRole: "implementer",
      missingRoles: ["implementer", "reviewer"],
      nextRole: "implementer",
      overall: "blocked",
    })
    expect(implementer.blockers).toEqual([
      expect.objectContaining({
        id: "role-implementation-artifact-missing",
        source: ".persona/workflow/work/req-1/roles/implementer.md",
      }),
    ])

    writeRoleArtifact(
      projectDir,
      "req-1",
      "implementer",
      [
        "# implementer",
        "",
        "Implementation summary: added controller/service/repository code.",
        "Evidence: ./gradlew test.",
      ].join("\n"),
    )
    const reviewer = relayJson(projectDir, "status")
    expect(reviewer.action).toBe("status")
    expect(reviewer.currentRole).toBe("reviewer")
    expect(reviewer.nextRole).toBe("reviewer")
    expect(reviewer.promptBlock).toContain("invoke the `reviewer` subagent via the task tool")
    expect(reviewer.promptBlock).toContain("Record whether subagent invocation was used or unavailable")
    expect(reviewer.roleCompletionState).toMatchObject({
      completedRoles: ["test-writer", "implementer"],
      currentRole: "reviewer",
      missingRoles: ["reviewer"],
      nextRole: "reviewer",
      overall: "blocked",
    })
    expect(reviewer.blockers).toEqual([
      expect.objectContaining({
        id: "role-review-artifact-missing",
        source: ".persona/workflow/work/req-1/roles/reviewer.md",
      }),
    ])

    writeRoleArtifact(
      projectDir,
      "req-1",
      "reviewer",
      ["# reviewer", "", "Review result: workflow check reviewed and review-report.md should be updated."].join("\n"),
    )
    const complete = relayJson(projectDir)
    expect(complete.currentRole).toBeNull()
    expect(complete.nextRole).toBeNull()
    expect(complete.requiredArtifact).toBeNull()
    expect(complete.requiredOutputArtifact).toBeNull()
    expect(complete.roleCompletionState).toMatchObject({
      completedRoles: ["test-writer", "implementer", "reviewer"],
      currentRole: null,
      missingRoles: [],
      nextRole: null,
      overall: "complete",
    })
    expect(complete.blockers).toEqual([])
    expect(complete.gateCommand).toBe("npx ph workflow closure next --json")
    expect(complete.promptBlock).toContain("Relay preview role artifacts are present.")
  })
})
