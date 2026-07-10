import { chmodSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID } from "../src/cli/architecture-conventions.js"
import {
  blockerStep,
  UNMAPPED_BLOCKER_STEP_ID,
  type ClosureBlocker,
  type ClosureStep,
  type WorkflowClosureState,
} from "../src/cli/workflow-closure.js"
import { CONVENTION_REGISTRY } from "../src/config/convention-registry.js"
import { loadHarnessConfig } from "../src/config/harness-config.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-closure-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createWorkflowProject(planStatus = "accepted"): string {
  const projectDir = createTempProject()
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), `Status: ${planStatus}\n`)
  writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: template\n")
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: template\n")
  return projectDir
}

function writeEvidence(projectDir: string, text: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "verification.json"), `${JSON.stringify({ toolOutput: text }, null, 2)}\n`)
}

function writeStructuredVerificationEvidence(projectDir: string, status: number, text: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({ command: "npx ph bearshell ./gradlew test", status, toolOutput: text, tool: "bearshell" }, null, 2)}\n`,
  )
}

function writeDirectVerificationConfig(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({ enforce: { executeVerification: true } }, null, 2)}\n`)
}

function writeGradleWrapper(projectDir: string, script: string): void {
  const wrapperPath = join(projectDir, "gradlew")
  writeFileSync(wrapperPath, script)
  chmodSync(wrapperPath, 0o755)
}

function writeJUnitResult(projectDir: string, xmlText: string): void {
  mkdirSync(join(projectDir, "build", "test-results", "test"), { recursive: true })
  writeFileSync(join(projectDir, "build", "test-results", "test", "TEST-sample.xml"), xmlText)
}

function writeFilledReports(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    ["Status: filled", "- README ranges read: all", "- Project profile ranges read: all", "- `npx ph bearshell ./gradlew test`", "BUILD SUCCESSFUL"].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    ["Status: filled", "- `npx ph bearshell ./gradlew bootRun`", "Tomcat started on port 8080", "Started TaskApplication"].join("\n"),
  )
}

function writeProfile(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "project-profile.jsonc"),
    `${JSON.stringify(
      {
        defaults: { buildTool: "gradle", framework: "spring", language: "java" },
        questions: [
          { answer: "ko", id: "user-language" },
          { answer: "solo", id: "project-context" },
          { answer: "production-service", id: "project-goal" },
          { answer: "small", id: "project-scale" },
          { answer: "rest-api", id: "application-type" },
          { answer: "simple-layered", id: "architecture-style" },
          { answer: "h2 database", id: "storage" },
          { answer: "jpa", id: "persistence-technology" },
          { answer: "schema.sql", id: "migration-style" },
          { answer: "domain-first", id: "package-style" },
          { answer: "strict", id: "boundary-strictness" },
        ],
        schema: "persona.project-profile.v1",
        scope: { mvp: "java-spring-clean-code", role: "backend" },
        status: "ready",
      },
      null,
      2,
    )}\n`,
  )
}

function writeSpringGradleStack(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins { id 'java'; id 'org.springframework.boot' version '3.5.0' }",
      "dependencies {",
      "  implementation 'org.springframework.boot:spring-boot-starter-web'",
      "  implementation 'org.springframework.boot:spring-boot-starter-data-jpa'",
      "  runtimeOnly 'com.h2database:h2'",
      "}",
    ].join("\n"),
  )
  writeGradleWrapper(projectDir, "#!/bin/sh\nexit 0\n")
  mkdirSync(join(projectDir, "src", "main", "resources"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "resources", "schema.sql"), "create table task (id bigint primary key);\n")
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "SampleApplication.java"),
    "import org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass SampleApplication {}\n",
  )
}

function writeControllerRepositoryViolation(projectDir: string): void {
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "TaskController.java"),
    [
      "import org.springframework.web.bind.annotation.RestController;",
      "@RestController",
      "class TaskController {",
      "  private final TaskRepository repository;",
      "  TaskController(TaskRepository repository) { this.repository = repository; }",
      "}",
    ].join("\n"),
  )
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "TaskRepository.java"), "interface TaskRepository {}\n")
}

function writeActiveTicket(projectDir: string, ticketId = "req-1"): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", ticketId), { recursive: true })
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
  writeFileSync(join(projectDir, ".persona", "workflow", "work", ticketId, "00-task-card.md"), `# Task Card: ${ticketId}\n`)
}

function writeHistoryOnlyTicket(projectDir: string, ticketId = "req-1"): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "history", ticketId), { recursive: true })
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
  writeFileSync(join(projectDir, ".persona", "workflow", "history", ticketId, "00-task-card.md"), `# Task Card: ${ticketId}\n`)
}

function closureJson(projectDir: string, action: "next" | "status" = "next") {
  const result = runPersonaCli(["workflow", "closure", action, "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  expect(result.stderr).toBe("")
  return JSON.parse(result.stdout)
}

const REQUIRED_STATE_KEYS = [
  "plan",
  "currentTicket",
  "pendingTickets",
  "implementationReport",
  "reviewReport",
  "evidence",
  "verification",
  "reportCoverage",
  "archive",
  "finish",
  "blockers",
] as const

const CONTRACT_STATE: WorkflowClosureState = {
  archive: "pending",
  blockers: [],
  currentTicket: {
    id: "req-1",
    path: ".persona/workflow/work/req-1/00-task-card.md",
    reviewArchiveCandidate: false,
    state: "active-work",
    technicalSignals: [],
    title: "Contract fixture",
  },
  evidence: "present",
  finish: "blocked",
  implementationReport: "filled",
  pendingTickets: ["req-1"],
  plan: "accepted",
  reportCoverage: "sufficient",
  reviewReport: "filled",
  tdd: { kind: "disabled", reason: "TDD is not enforced" },
  verification: "passed",
}

const CLOSURE_BLOCKER_IDS = [
  "plan-not-accepted",
  "verification-failed",
  "verification-unknown",
  "implementation-report-missing",
  "review-report-missing",
  "evidence-missing",
  "tdd-red-evidence-missing",
  "tdd-not-red-then-green",
  "command-discipline-blocking",
  "report-coverage-missing",
  "read-coverage-missing",
  "profile-read-coverage-missing",
  "java-role-read-coverage-missing",
  "stack-alignment-mismatch",
  CONVENTION_TOOLCHAIN_MISSING_BLOCKER_ID,
  "history-backlog-mismatch",
  "pending-ticket",
] as const

const FINISH_REACHABLE_GATE_CHAIN_DEPTH = 6
const FINISH_REACHABLE_GATE_CHAIN = [
  "fix-verification",
  "fill-implementation-report",
  "fill-review-report",
  "fill-report-coverage",
  "record-profile-read-coverage",
  "record-java-role-read-coverage",
] as const

function contractBlocker(id: string): ClosureBlocker {
  return {
    evidenceRef: ".persona/evidence/phase0/verification.json",
    id,
    reason: `${id} contract fixture`,
    source: ".persona/workflow/implementation-report.md",
  }
}

function isImmediateCircularStep(step: ClosureStep): boolean {
  return (
    (step.command === "npx ph workflow finish implement" || step.command === "npx ph workflow check") &&
    step.commandAfterContent === undefined
  )
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow closure read-only planner", () => {
  it("maps unknown blocker ids to an unmapped-blocker diagnostic instead of rerunning finish", () => {
    const step = blockerStep(contractBlocker("future-unregistered-blocker"), CONTRACT_STATE, "blocked")

    expect(step).toMatchObject({
      blockerId: "future-unregistered-blocker",
      id: UNMAPPED_BLOCKER_STEP_ID,
      kind: "human-or-model-content",
      status: "blocked",
    })
    expect(step.command).toBeUndefined()
    expect(step.commandAfterContent).toBeUndefined()
    expect(step.reason).toContain("no closure step mapping")
    expect(step.reason).toContain("PH bug or unregistered convention")
  })

  it("keeps generated closure and convention blocker steps non-circular", () => {
    const blockerIds = [...CLOSURE_BLOCKER_IDS, ...CONVENTION_REGISTRY.map((definition) => definition.blockerId)]

    for (const blockerId of blockerIds) {
      const step = blockerStep(contractBlocker(blockerId), CONTRACT_STATE, "blocked")

      expect(step.id, blockerId).not.toBe(UNMAPPED_BLOCKER_STEP_ID)
      expect(isImmediateCircularStep(step), blockerId).toBe(false)
    }
  })

  it("keeps blocker list order deterministic for the same multi-blocker disk state", () => {
    const projectDir = createWorkflowProject()
    writeProfile(projectDir)
    writeSpringGradleStack(projectDir)
    writeControllerRepositoryViolation(projectDir)
    writeStructuredVerificationEvidence(
      projectDir,
      1,
      [
        "npx ph bearshell ./gradlew test",
        "BUILD FAILED",
        "src/main/java/com/example/TaskController.java",
        "src/main/java/com/example/TaskRepository.java",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      ["Status: filled", "- README ranges read: all", "- `npx ph bearshell ./gradlew test`", "BUILD FAILED"].join("\n"),
    )

    const expectedOrder = [
      "verification-failed",
      "review-report-missing",
      "report-coverage-missing",
      "profile-read-coverage-missing",
      "architecture-controller-repository-direct-dependency",
    ]
    const blockerIds = Array.from({ length: 5 }, () => closureJson(projectDir, "status").state.blockers.map((blocker: ClosureBlocker) => blocker.id))

    expect(blockerIds).toEqual(Array.from({ length: 5 }, () => expectedOrder))
  })

  it("documents the current finish-reachable gate-chain depth behind ralph-loop session budget", () => {
    const projectDir = createTempProject()
    const config = loadHarnessConfig(projectDir)

    expect(FINISH_REACHABLE_GATE_CHAIN).toEqual([
      "fix-verification",
      "fill-implementation-report",
      "fill-review-report",
      "fill-report-coverage",
      "record-profile-read-coverage",
      "record-java-role-read-coverage",
    ])
    expect(FINISH_REACHABLE_GATE_CHAIN).toHaveLength(FINISH_REACHABLE_GATE_CHAIN_DEPTH)
    expect(FINISH_REACHABLE_GATE_CHAIN_DEPTH).toBe(6)
    expect(config.enforce.ralphLoop.maxAttempts).toBe(3)
    expect(config.enforce.ralphLoop.maxSessionAttempts).toBe(9)
    expect(config.enforce.ralphLoop.maxSessionAttempts).toBeGreaterThanOrEqual(FINISH_REACHABLE_GATE_CHAIN_DEPTH)
  })

  it("reports plan as the first blocker when workflow plan is missing", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })

    const output = closureJson(projectDir)

    expect(output.state.plan).toBe("missing")
    expect(output.steps[0]).toMatchObject({
      id: "accept-plan",
      kind: "cli-command",
      status: "blocked",
      command: "npx ph plan",
      source: ".persona/workflow/plan.md",
    })
  })

  it("keeps the required state schema stable when no current ticket exists", () => {
    const projectDir = createWorkflowProject()
    writeEvidence(projectDir, "gradlew.bat test\nBUILD SUCCESSFUL")

    const status = closureJson(projectDir, "status")
    const next = closureJson(projectDir, "next")

    for (const key of REQUIRED_STATE_KEYS) {
      expect(Object.hasOwn(status.state, key)).toBe(true)
      expect(Object.hasOwn(next.state, key)).toBe(true)
    }
    expect(status.state.currentTicket).toBeNull()
    expect(next.state.currentTicket).toBeNull()
    expect(Object.hasOwn(status, "nextStep")).toBe(false)
    expect(next.nextStep).toMatchObject(next.steps[0])
  })

  it("uses report content as the first actionable blocker for the post-build alpha6-like state", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL\ngradlew.bat build\nBUILD SUCCESSFUL\nruntime smoke PASS")
    writeActiveTicket(projectDir)

    const output = closureJson(projectDir, "status")

    expect(output.state).toMatchObject({
      plan: "accepted",
      implementationReport: "template",
      reviewReport: "template",
      evidence: "present",
      verification: "passed",
      archive: "pending",
      finish: "blocked",
    })
    expect(output.state.currentTicket).toMatchObject({ id: "req-1", state: "active-work" })
    expect(output.state.pendingTickets).toEqual(["req-1"])
    expect(output.steps[0]).toMatchObject({
      id: "fill-implementation-report",
      kind: "human-or-model-content",
      status: "blocked",
      commandAfterContent: "npx ph plan --report-filled implementation",
      source: ".persona/workflow/implementation-report.md",
      evidenceRef: ".persona/evidence",
    })
  })

  it("orders verification unknown before report closure", () => {
    const projectDir = createWorkflowProject()
    writeEvidence(projectDir, "gradlew.bat test")

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("unknown")
    expect(output.steps[0]).toMatchObject({
      id: "verify-app",
      kind: "human-or-model-content",
      status: "blocked",
      blockerId: "verification-unknown",
    })
    expect(output.steps[1]).toMatchObject({ id: "fill-implementation-report" })
  })

  it("keeps report prose success unknown without structured execution evidence", () => {
    const projectDir = createWorkflowProject()
    writeFilledReports(projectDir)

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("unknown")
    expect(output.steps[0]).toMatchObject({
      id: "verify-app",
      blockerId: "verification-unknown",
      status: "blocked",
    })
    expect(output.steps[0].reason).toContain("no structured execution evidence")
  })

  it("accepts structured bearshell execution success evidence", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL")

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("passed")
    expect(output.steps[0]).toMatchObject({ id: "fill-implementation-report" })
  })

  it("uses PH-run direct verification over agent-written success evidence when enforcement is enabled", () => {
    const projectDir = createWorkflowProject()
    writeDirectVerificationConfig(projectDir)
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew test\nBUILD SUCCESSFUL")
    writeGradleWrapper(projectDir, "#!/bin/sh\necho 'BUILD FAILED' >&2\nexit 7\n")

    const output = closureJson(projectDir)
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(output.state.verification).toBe("failed")
    expect(output.steps[0]).toMatchObject({
      blockerId: "verification-failed",
      id: "fix-verification",
      status: "blocked",
    })
    expect(output.steps[0].reason).toContain("PH direct verification failed")
    expect(finish.status).toBe(1)
    expect(`${finish.stdout}\n${finish.stderr}`).toContain("Blocker: verification-failed")
    expect(`${finish.stdout}\n${finish.stderr}`).toContain("Next action: Fix the compile/test failure reported by Persona Harness verification.")
    expect(`${finish.stdout}\n${finish.stderr}`).not.toContain("Next command:")
  })

  it("passes verification from PH-run direct execution when enforcement is enabled", () => {
    const projectDir = createWorkflowProject()
    writeDirectVerificationConfig(projectDir)
    writeGradleWrapper(projectDir, "#!/bin/sh\necho 'BUILD SUCCESSFUL'\nexit 0\n")

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("passed")
    expect(output.steps[0]).toMatchObject({ id: "fill-implementation-report" })
  })

  it("keeps direct verification unknown when enforcement is enabled without a supported command", () => {
    const projectDir = createWorkflowProject()
    writeDirectVerificationConfig(projectDir)
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew test\nBUILD SUCCESSFUL")

    const output = closureJson(projectDir)
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(output.state.verification).toBe("unknown")
    expect(output.steps[0]).toMatchObject({
      blockerId: "verification-unknown",
      id: "verify-app",
      status: "blocked",
    })
    expect(output.steps[0].reason).toContain("PH direct verification is enabled")
    expect(`${finish.stdout}\n${finish.stderr}`).toContain("Blocker: verification-unknown")
    expect(`${finish.stdout}\n${finish.stderr}`).toContain("Next action: Ensure the project has a supported verification command")
    expect(`${finish.stdout}\n${finish.stderr}`).not.toContain("Next command:")
  })

  it("orders explicit verification failure before report closure", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 1, "gradlew.bat build\nBUILD FAILED\nCould not resolve org.springframework.boot:spring-boot-starter-web:.")

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("failed")
    expect(output.steps[0]).toMatchObject({
      id: "fix-verification",
      kind: "human-or-model-content",
      status: "blocked",
      blockerId: "verification-failed",
    })
  })

  it("orders JUnit XML verification failure before report closure", () => {
    const projectDir = createWorkflowProject()
    writeJUnitResult(projectDir, '<testsuite tests="2" failures="1" errors="0" skipped="0"></testsuite>\n')

    const output = closureJson(projectDir)

    expect(output.state.verification).toBe("failed")
    expect(output.steps[0]).toMatchObject({
      id: "fix-verification",
      blockerId: "verification-failed",
      status: "blocked",
    })
    expect(output.steps[0].reason).toContain("JUnit XML")
  })

  it("moves from implementation report to review report after implementation is filled", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL")
    writeFileSync(join(projectDir, ".persona", "workflow", "implementation-report.md"), "Status: filled\n- verification evidence recorded\n")

    const output = closureJson(projectDir)

    expect(output.steps[0]).toMatchObject({
      id: "fill-review-report",
      kind: "human-or-model-content",
      status: "blocked",
      commandAfterContent: "npx ph plan --report-filled review",
      source: ".persona/workflow/review-report.md",
    })
  })

  it("keeps pending active tickets behind a review confirmation boundary", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL\ngradlew.bat build\nBUILD SUCCESSFUL")
    writeFilledReports(projectDir)
    writeActiveTicket(projectDir)

    const output = closureJson(projectDir)

    expect(output.steps[0]).toMatchObject({
      id: "archive-current-ticket",
      kind: "human-or-model-content",
      status: "blocked",
      blockerId: "pending-ticket",
      commandAfterContent: "npx ph workflow archive req-1",
    })
  })

  it("shows history-only backlog mismatch as a repairable action without repairing it", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL\ngradlew.bat build\nBUILD SUCCESSFUL")
    writeFilledReports(projectDir)
    writeHistoryOnlyTicket(projectDir)

    const output = closureJson(projectDir)

    expect(output.state.archive).toBe("history-only-repair")
    expect(output.steps[0]).toMatchObject({
      id: "repair-archive-state",
      kind: "cli-command",
      status: "blocked",
      command: "npx ph workflow archive req-1",
      blockerId: "history-backlog-mismatch",
    })
  })

  it("returns a terminal step when finish state is passable", () => {
    const projectDir = createWorkflowProject()
    writeStructuredVerificationEvidence(projectDir, 0, "gradlew.bat test\nBUILD SUCCESSFUL\ngradlew.bat build\nBUILD SUCCESSFUL\nTomcat started on port 8080")
    writeFilledReports(projectDir)

    const output = closureJson(projectDir)

    expect(output.state.finish).toBe("passed")
    expect(output.steps[0]).toMatchObject({
      id: "terminal",
      kind: "terminal",
      status: "complete",
    })
  })
})
