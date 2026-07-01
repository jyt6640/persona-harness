import { chmodSync, existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-tdd-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createWorkflowProject(): string {
  const projectDir = createTempProject()
  mkdirSync(join(projectDir, ".persona", "workflow", "work", "req-1"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    ["Status: filled", "- `npx ph bearshell ./gradlew test`", "BUILD SUCCESSFUL"].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    ["Status: filled", "- `npx ph bearshell ./gradlew test`", "BUILD SUCCESSFUL"].join("\n"),
  )
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
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ enforce: { executeVerification: true, tdd: true } }, null, 2)}\n`,
  )
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
    "  error)",
    "    cat > build/test-results/test/TEST-tdd.xml <<'XML'",
    "<testsuite tests=\"1\" failures=\"0\" errors=\"1\" skipped=\"0\">",
    "  <testcase classname=\"com.example.todo.TodoControllerTest\" name=\"brokenFixture\">",
    "    <error message=\"fixture error\">Runtime error</error>",
    "  </testcase>",
    "</testsuite>",
    "XML",
    "    exit 1",
    "    ;;",
    "  compile)",
    "    echo 'src/test/java/BrokenTest.java:1: error: cannot find symbol' >&2",
    "    exit 1",
    "    ;;",
    "esac",
  ].join("\n") + "\n"
}

function runWorkflow(projectDir: string, args: readonly string[]) {
  return runPersonaCli(["workflow", ...args], { cwd: projectDir, env: {}, invocationName: "ph" })
}

function writeState(projectDir: string, state: "compile" | "error" | "green" | "red"): void {
  writeFileSync(join(projectDir, "tdd-state.txt"), `${state}\n`)
}

function tddEvidenceFiles(projectDir: string): readonly string[] {
  const dir = join(projectDir, ".persona", "evidence", "tdd", "req-1")
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

function closure(projectDir: string): { readonly state: { readonly blockers: readonly { readonly id: string; readonly reason: string }[] } } {
  const result = runWorkflow(projectDir, ["closure", "next", "--json"])
  expect(result.status).toBe(0)
  return JSON.parse(result.stdout)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow test TDD rail", () => {
  it("records red evidence from a PH-run strict Gradle/JUnit failing testcase", () => {
    const projectDir = createWorkflowProject()
    writeState(projectDir, "red")

    const result = runWorkflow(projectDir, ["test"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("TDD red evidence recorded")
    const evidenceFile = tddEvidenceFiles(projectDir).find((entry) => entry.startsWith("red-"))
    expect(evidenceFile).toBeDefined()
    const evidence = JSON.parse(readFileSync(join(projectDir, ".persona", "evidence", "tdd", "req-1", evidenceFile ?? ""), "utf8"))
    expect(evidence).toMatchObject({
      execution: "ph-direct-gradle-junit",
      generatedBy: "persona-harness",
      status: "red",
      ticket: "req-1",
    })
    expect(evidence.testIds).toEqual(["com.example.todo.TodoControllerTest#createsTodoThroughService"])
  })

  it("treats strict-off TDD as advisory and writes no fake evidence", () => {
    const projectDir = createWorkflowProject()
    writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({ enforce: { tdd: true } }, null, 2)}\n`)
    writeState(projectDir, "red")

    const result = runWorkflow(projectDir, ["test"])
    const output = closure(projectDir)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("enforce.executeVerification is false")
    expect(tddEvidenceFiles(projectDir)).toEqual([])
    expect(output.state.blockers.map((blocker) => blocker.id)).not.toContain("tdd-red-evidence-missing")
  })

  it("prints read-only TDD status and next action without writing evidence", () => {
    const projectDir = createWorkflowProject()
    writeState(projectDir, "red")

    const result = runWorkflow(projectDir, ["tdd"])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("TDD Workflow Rail status")
    expect(result.stdout).toContain("State: red-missing")
    expect(result.stdout).toContain("Source: .persona/evidence/tdd/req-1")
    expect(result.stdout).toContain("Next: write a behavior test")
    expect(result.stdout).toContain("Boundary: read-only status")
    expect(tddEvidenceFiles(projectDir)).toEqual([])
  })

  it("reports recorded red waiting for green, then passed, without writing from status", () => {
    const projectDir = createWorkflowProject()
    writeState(projectDir, "red")
    expect(runWorkflow(projectDir, ["test"]).status).toBe(0)
    const afterRedFiles = tddEvidenceFiles(projectDir)

    const waiting = runWorkflow(projectDir, ["tdd"])
    writeState(projectDir, "green")
    expect(runWorkflow(projectDir, ["check"]).status).toBe(0)
    const afterCheckFiles = tddEvidenceFiles(projectDir)
    const passed = runWorkflow(projectDir, ["tdd"])

    expect(waiting.status).toBe(0)
    expect(waiting.stdout).toContain("State: red-without-green")
    expect(waiting.stdout).toContain("Next: make the recorded red test pass")
    expect(tddEvidenceFiles(projectDir)).toEqual(afterCheckFiles)
    expect(afterRedFiles.some((entry) => entry.startsWith("red-"))).toBe(true)
    expect(afterCheckFiles.some((entry) => entry.startsWith("green-"))).toBe(true)
    expect(passed.status).toBe(0)
    expect(passed.stdout).toContain("State: passed")
    expect(passed.stdout).toContain("Next: continue normal closure/archive/finish flow")
  })

  it("lists the read-only TDD helper in workflow and root help", () => {
    const projectDir = createWorkflowProject()

    const workflowHelp = runWorkflow(projectDir, ["--help"])
    const rootHelp = runPersonaCli(["help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(workflowHelp.status).toBe(0)
    expect(workflowHelp.stdout).toContain("workflow <check|implement|test|tdd|continue")
    expect(workflowHelp.stdout).toContain("workflow tdd prints read-only TDD red→green status")
    expect(rootHelp.status).toBe(0)
    expect(rootHelp.stdout).toContain("workflow tdd")
    expect(rootHelp.stdout).toContain("Print read-only TDD red→green status")
  })

  it("blocks green-only test and implementation work because no red evidence exists", () => {
    const projectDir = createWorkflowProject()
    writeState(projectDir, "green")

    const test = runWorkflow(projectDir, ["test"])
    const finish = runWorkflow(projectDir, ["finish", "implement"])

    expect(test.status).toBe(1)
    expect(test.stdout).toContain("already green")
    expect(finish.status).toBe(1)
    expect(`${finish.stdout}\n${finish.stderr}`).toContain("req-1 has no PH-run red evidence")
    expect(closure(projectDir).state.blockers.map((blocker) => blocker.id)).toContain("tdd-red-evidence-missing")
  })

  it("rejects compile errors and JUnit errors as invalid red evidence", () => {
    const projectDir = createWorkflowProject()
    writeState(projectDir, "compile")

    const compile = runWorkflow(projectDir, ["test"])
    writeState(projectDir, "error")
    const junitError = runWorkflow(projectDir, ["test"])

    expect(compile.status).toBe(1)
    expect(compile.stderr).toContain("failed without a failing JUnit testcase")
    expect(junitError.status).toBe(1)
    expect(junitError.stderr).toContain("JUnit error cases are not accepted")
    expect(tddEvidenceFiles(projectDir)).toEqual([])
  })

  it("ignores hand-written red/green evidence that was not PH-run strict Gradle/JUnit evidence", () => {
    const projectDir = createWorkflowProject()
    mkdirSync(join(projectDir, ".persona", "evidence", "tdd", "req-1"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "tdd", "req-1", "red-manual.json"),
      `${JSON.stringify({ status: "red", ticket: "req-1", testIds: ["com.example.todo.TodoControllerTest#createsTodoThroughService"] }, null, 2)}\n`,
    )
    writeState(projectDir, "green")

    const finish = runWorkflow(projectDir, ["finish", "implement"])

    expect(finish.status).toBe(1)
    expect(`${finish.stdout}\n${finish.stderr}`).toContain("req-1 has no PH-run red evidence")
  })

  it("requires the same red testId to pass later before archive and finish can pass", () => {
    const projectDir = createWorkflowProject()
    writeState(projectDir, "red")

    const red = runWorkflow(projectDir, ["test"])
    writeState(projectDir, "green")
    const check = runWorkflow(projectDir, ["check"])
    const archive = runWorkflow(projectDir, ["archive", "req-1"])
    const finish = runWorkflow(projectDir, ["finish", "implement"])

    expect(red.status).toBe(0)
    expect(check.status).toBe(0)
    expect(tddEvidenceFiles(projectDir).some((entry) => entry.startsWith("green-"))).toBe(true)
    if (archive.status !== 0) {
      throw new Error(`archive failed\nstdout:\n${archive.stdout}\nstderr:\n${archive.stderr}`)
    }
    expect(archive.status).toBe(0)
    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
  })
})
