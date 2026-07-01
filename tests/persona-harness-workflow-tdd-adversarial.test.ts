import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createWorkflowProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-tdd-adversarial-"))
  tempProjects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "workflow", "work", "req-1"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: filled\n- `npx ph bearshell ./gradlew test`\n- BUILD SUCCESSFUL\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- `npx ph bearshell ./gradlew test`\n- BUILD SUCCESSFUL\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "work", "req-1", "00-task-card.md"), "# Task Card: req-1\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "backlog.md"),
    [
      "# Persona Workflow Backlog",
      "",
      "Status: active",
      "",
      "| Order | Ticket | Title | Status | Path |",
      "| --- | --- | --- | --- | --- |",
      "| 1 | req-1 | TDD behavior | pending | .persona/workflow/work/req-1/00-task-card.md |",
    ].join("\n"),
  )
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({ enforce: { executeVerification: true, tdd: true } }, null, 2)}\n`)
  writeFileSync(join(projectDir, "settings.gradle"), "pluginManagement { repositories { gradlePluginPortal() } }\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "tdd-state.txt"), "green\n")
  writeFileSync(join(projectDir, "gradlew"), gradleScript())
  chmodSync(join(projectDir, "gradlew"), 0o755)
  return projectDir
}

function gradleScript(): string {
  return [
    "#!/bin/sh",
    "state=$(cat tdd-state.txt)",
    "mkdir -p build/test-results/test",
    "case \"$state\" in",
    "  red)",
    "    cat > build/test-results/test/TEST-tdd.xml <<'XML'",
    "<testsuite tests=\"1\" failures=\"1\" errors=\"0\" skipped=\"0\">",
    "  <testcase classname=\"com.example.todo.TodoControllerTest\" name=\"createsTodoThroughService\">",
    "    <failure message=\"expected service path\">Assertion failed</failure>",
    "  </testcase>",
    "</testsuite>",
    "XML",
    "    exit 1",
    "    ;;",
    "  green)",
    "    cat > build/test-results/test/TEST-tdd.xml <<'XML'",
    "<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\">",
    "  <testcase classname=\"com.example.todo.TodoControllerTest\" name=\"createsTodoThroughService\"/>",
    "</testsuite>",
    "XML",
    "    exit 0",
    "    ;;",
    "esac",
  ].join("\n") + "\n"
}

function runWorkflow(projectDir: string, args: readonly string[]) {
  return runPersonaCli(["workflow", ...args], { cwd: projectDir, env: {}, invocationName: "ph" })
}

function writeState(projectDir: string, state: "green" | "red"): void {
  writeFileSync(join(projectDir, "tdd-state.txt"), `${state}\n`)
}

function evidenceDir(projectDir: string, ticket = "req-1"): string {
  return join(projectDir, ".persona", "evidence", "tdd", ticket)
}

function evidenceFiles(projectDir: string, ticket = "req-1"): readonly string[] {
  const dir = evidenceDir(projectDir, ticket)
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

function readEvidence(projectDir: string, entry: string, ticket = "req-1"): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(evidenceDir(projectDir, ticket), entry), "utf8"))
  return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}
}

function writeEvidence(projectDir: string, entry: string, evidence: Record<string, unknown>, ticket = "req-1"): void {
  mkdirSync(evidenceDir(projectDir, ticket), { recursive: true })
  writeFileSync(join(evidenceDir(projectDir, ticket), entry), `${JSON.stringify(evidence, null, 2)}\n`)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("TDD rail adversarial evidence checks", () => {
  it("ignores stale red evidence when the stored JUnit snapshot digest does not match", () => {
    const projectDir = createWorkflowProject()
    writeState(projectDir, "red")
    expect(runWorkflow(projectDir, ["test"]).status).toBe(0)
    const redFile = evidenceFiles(projectDir).find((entry) => entry.startsWith("red-"))
    expect(redFile).toBeDefined()
    const evidence = readEvidence(projectDir, redFile ?? "")
    const verification = typeof evidence.verification === "object" && evidence.verification !== null && !Array.isArray(evidence.verification)
      ? { ...evidence.verification, junitSnapshotDigest: "stale-digest" }
      : { junitSnapshotDigest: "stale-digest" }
    writeEvidence(projectDir, redFile ?? "red-stale.json", { ...evidence, verification })
    writeState(projectDir, "green")

    const finish = runWorkflow(projectDir, ["finish", "implement"])

    expect(finish.status).toBe(1)
    expect(`${finish.stdout}\n${finish.stderr}`).toContain("req-1 has no PH-run red evidence")
  })

  it("does not let another ticket's red evidence satisfy the current ticket", () => {
    const projectDir = createWorkflowProject()
    writeState(projectDir, "red")
    expect(runWorkflow(projectDir, ["test"]).status).toBe(0)
    const redFile = evidenceFiles(projectDir).find((entry) => entry.startsWith("red-"))
    expect(redFile).toBeDefined()
    const redEvidence = { ...readEvidence(projectDir, redFile ?? ""), ticket: "req-2" }
    rmSync(evidenceDir(projectDir), { recursive: true, force: true })
    writeEvidence(projectDir, "red-req-2.json", redEvidence, "req-2")
    writeState(projectDir, "green")

    const finish = runWorkflow(projectDir, ["finish", "implement"])

    expect(finish.status).toBe(1)
    expect(`${finish.stdout}\n${finish.stderr}`).toContain("req-1 has no PH-run red evidence")
  })
})
