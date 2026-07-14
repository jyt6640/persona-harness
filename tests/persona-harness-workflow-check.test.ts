import { spawnSync } from "node:child_process"
import { chmodSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import {
  CONVENTION_REGISTRY,
  CONTROLLER_PERSISTENCE_IMPORT_CONVENTION,
  CONTROLLER_REPOSITORY_CONVENTION,
  SERVICE_STATE_OWNERSHIP_CONVENTION,
} from "../src/config/convention-registry.js"
import { loadHarnessConfig } from "../src/config/harness-config.js"
import { isRecord } from "../src/config/jsonc.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-check-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function createProfiledTempProject(): string {
  const projectDir = createTempProject()
  const result = runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
  expect(result.status).toBe(0)
  return projectDir
}

function writeProfileReadEvidence(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "2026-06-24T00-00-00-000Z-project-profile.jsonc.json"),
    `${JSON.stringify({ targetFile: join(projectDir, ".persona", "project-profile.jsonc"), fileRole: "project-profile" }, null, 2)}\n`,
  )
}

function writeStructuredVerificationSuccessEvidence(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify(
      {
        command: "npx ph bearshell --shell './gradlew test'",
        status: 0,
        tool: "bearshell",
        toolOutput: "BUILD SUCCESSFUL",
      },
      null,
      2,
    )}\n`,
  )
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

function writePassingWorkflowEvidence(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: 1-220",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
  )
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeStructuredVerificationSuccessEvidence(projectDir)
  writeProfileReadEvidence(projectDir)
}

function writePendingReqBacklog(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", "req-1"), { recursive: true })
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
  writeFileSync(join(projectDir, ".persona", "workflow", "work", "req-1", "00-task-card.md"), "# Task Card: req-1\n")
}

function workflowStatusRows(stdout: string): ReadonlyMap<string, string> {
  const rows = new Map<string, string>()
  for (const line of stdout.split(/\r?\n/u)) {
    if (!line.startsWith("- ")) {
      continue
    }
    const separatorIndex = line.indexOf(":")
    if (separatorIndex === -1) {
      continue
    }
    rows.set(line.slice(2, separatorIndex), line.slice(separatorIndex + 1).trim())
  }
  return rows
}

function readJsonObject(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  expect(isRecord(parsed)).toBe(true)
  return isRecord(parsed) ? parsed : {}
}

function writeJavaRoleFiles(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'task-api'\n")
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
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nexit 0\n")
  mkdirSync(join(projectDir, "src", "main", "resources"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "resources", "schema.sql"), "create table task (id bigint primary key);\n")
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "task"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "TaskApplication.java"),
    "import org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass TaskApplication {}\n",
  )
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "task", "presentation"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "presentation", "TaskController.java"),
    "import org.springframework.web.bind.annotation.RestController;\n@RestController\nclass TaskController { TaskResponse response() { return new TaskResponse(); } }\n",
  )
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "task", "application"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "application", "TaskService.java"),
    "class TaskService { TaskResponse create(CreateTaskRequest request) { return new TaskResponse(); } }\n",
  )
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "task", "domain"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "task", "domain", "Task.java"), "class Task { boolean open() { return true; } }\n")
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "task", "domain", "TaskRepository.java"), "interface TaskRepository {}\n")
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "task", "infrastructure"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "infrastructure", "JdbcTaskRepository.java"),
    "class JdbcTaskRepository implements TaskRepository {}\n",
  )
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "task", "presentation", "dto"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "task", "presentation", "dto", "CreateTaskRequest.java"), "record CreateTaskRequest() {}\n")
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "task", "presentation", "dto", "TaskResponse.java"), "record TaskResponse() {}\n")
}

function writeCompleteWorkflowReportsAndEvidence(projectDir: string): void {
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- Project profile ranges read: all",
      "- Plan ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- BUILD SUCCESSFUL",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- Manual QA reviewed controller/service/repository boundary.",
      "- `npx ph bearshell --shell './gradlew build'`",
      "- BUILD SUCCESSFUL",
    ].join("\n"),
  )
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "workflow.json"),
    JSON.stringify(
      {
        command: "npx ph bearshell --shell './gradlew test'",
        status: 0,
        tool: "bearshell",
        toolOutput: [
          ".persona/project-profile.jsonc",
          "src/main/java/com/example/task/presentation/TaskController.java",
          "src/main/java/com/example/task/application/TaskService.java",
          "src/main/java/com/example/task/domain/TaskRepository.java",
          "src/main/java/com/example/task/domain/Task.java",
          "src/main/java/com/example/task/infrastructure/JdbcTaskRepository.java",
          "src/main/java/com/example/task/presentation/dto/CreateTaskRequest.java",
          "src/main/java/com/example/task/presentation/dto/TaskResponse.java",
          "BUILD SUCCESSFUL",
        ].join("\n"),
      },
      null,
      2,
    ),
  )
}

function writeControllerRepositoryViolation(projectDir: string): void {
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "presentation", "TaskController.java"),
    [
      "import org.springframework.web.bind.annotation.RestController;",
      "import com.example.task.domain.TaskRepository;",
      "@RestController",
      "class TaskController {",
      "  private final TaskRepository repository;",
      "  TaskController(TaskRepository repository) {",
      "    this.repository = repository;",
      "  }",
      "  TaskResponse response() {",
      "    repository.findAll();",
      "    return new TaskResponse();",
      "  }",
      "}",
    ].join("\n"),
  )
}

function writeConventionLevel(projectDir: string, level: "block" | "report" | "warn"): void {
  writeConventionLevels(projectDir, { [CONTROLLER_REPOSITORY_CONVENTION.id]: level })
}

function writeConventionLevels(projectDir: string, conventions: Record<string, "block" | "report" | "warn">): void {
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ conventions }, null, 2)}\n`,
  )
}

function writeControllerPersistenceImportRule(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "conventions"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "conventions", "controller-persistence-import.yml"),
    [
      "id: controller.persistence-import",
      "language: Java",
      "message: Controllers should not import Jakarta persistence types; keep entities behind service/DTO boundaries.",
      "# persona-harness-level: warn",
      "# persona-harness-scope: single-file",
      "# persona-harness-profile-scope: java-spring-service-architecture",
      "# persona-harness-target-suffix: Controller.java",
      "# persona-harness-high-precision: true",
      "# persona-harness-block-allowed: true",
      "# persona-harness-fix-path: move persistence/entity access behind a Service and expose DTOs at the Controller boundary.",
      "rule:",
      "  pattern: import jakarta.persistence.$ENTITY;",
    ].join("\n"),
  )
}

function writeControllerPersistenceImportViolation(projectDir: string): void {
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "presentation", "TaskController.java"),
    [
      "import org.springframework.web.bind.annotation.RestController;",
      "import jakarta.persistence.Entity;",
      "@RestController",
      "class TaskController {",
      "  TaskResponse response() {",
      "    return new TaskResponse();",
      "  }",
      "}",
    ].join("\n"),
  )
}

function writeFakeAstGrepBinary(projectDir: string): string {
  const fakeBinary = join(projectDir, "fake-sg.js")
  writeFileSync(
    fakeBinary,
    [
      "#!/usr/bin/env node",
      "const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs')",
      "const { join } = require('node:path')",
      "if (process.argv[2] === '--version') { process.stdout.write('ast-grep 0.0.0-test\\n'); process.exit(0) }",
      "const root = process.argv[process.argv.length - 1]",
      "const findings = []",
      "function visit(dir) {",
      "  if (!existsSync(dir)) return",
      "  for (const entry of readdirSync(dir)) {",
      "    const path = join(dir, entry)",
      "    const stat = statSync(path)",
      "    if (stat.isDirectory()) visit(path)",
      "    if (stat.isFile() && path.endsWith('.java')) {",
      "      const source = readFileSync(path, 'utf8')",
      "      if (source.includes('import jakarta.persistence.')) {",
      "        findings.push({ file: path, message: 'Controllers should not import Jakarta persistence types; keep entities behind service/DTO boundaries.', range: { start: { line: 1 } } })",
      "      }",
      "    }",
      "  }",
      "}",
      "visit(root)",
      "process.stdout.write(JSON.stringify(findings))",
    ].join("\n"),
  )
  chmodSync(fakeBinary, 0o755)
  return fakeBinary
}

function writeControllerServiceDependency(projectDir: string): void {
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "presentation", "TaskController.java"),
    [
      "import org.springframework.web.bind.annotation.RestController;",
      "import com.example.task.application.TaskService;",
      "@RestController",
      "class TaskController {",
      "  private final TaskService service;",
      "  TaskController(TaskService service) {",
      "    this.service = service;",
      "  }",
      "  TaskResponse response() {",
      "    return service.find();",
      "  }",
      "}",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "application", "TaskService.java"),
    [
      "import com.example.task.domain.TaskRepository;",
      "class TaskService {",
      "  private final TaskRepository repository;",
      "  TaskService(TaskRepository repository) {",
      "    this.repository = repository;",
      "  }",
      "  TaskResponse find() {",
      "    return new TaskResponse();",
      "  }",
      "}",
    ].join("\n"),
  )
}

function writeServiceStateOwnershipViolation(projectDir: string): void {
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "application", "TaskService.java"),
    [
      "import java.util.LinkedHashMap;",
      "import java.util.Map;",
      "import java.util.concurrent.atomic.AtomicLong;",
      "class TaskService {",
      "  private final Map<Long, Task> tasks = new LinkedHashMap<>();",
      "  private final AtomicLong nextId = new AtomicLong();",
      "  TaskResponse create(CreateTaskRequest request) {",
      "    return new TaskResponse();",
      "  }",
      "}",
    ].join("\n"),
  )
}

function writeServiceLocalStateLookalikes(projectDir: string): void {
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "application", "TaskService.java"),
    [
      "import java.util.Map;",
      "class TaskService {",
      "  TaskResponse create(CreateTaskRequest request) {",
      "    // private final Map<Long, Task> tasks = new LinkedHashMap<>();",
      "    String sample = \"private AtomicLong nextId = new AtomicLong()\";",
      "    Map<String, String> labels = Map.of(\"status\", \"open\");",
      "    return new TaskResponse();",
      "  }",
      "}",
    ].join("\n"),
  )
}

function writeSinglePendingTicket(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow", "work", "req-1"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "backlog.md"),
    [
      "# Persona Workflow Backlog",
      "",
      "Status: active",
      "",
      "| Order | Ticket | Title | Status | Path |",
      "| --- | --- | --- | --- | --- |",
      "| 1 | req-1 | Task API | pending | .persona/workflow/work/req-1/00-task-card.md |",
    ].join("\n"),
  )
  writeFileSync(join(projectDir, ".persona", "workflow", "work", "req-1", "00-task-card.md"), "# Task Card: req-1\n")
}

function markWorkflowReportsFilledButTemplateLike(projectDir: string): void {
  const implementationReportPath = join(projectDir, ".persona", "workflow", "implementation-report.md")
  const reviewReportPath = join(projectDir, ".persona", "workflow", "review-report.md")
  writeFileSync(implementationReportPath, readFileSync(implementationReportPath, "utf8").replace("Status: template", "Status: filled"))
  writeFileSync(reviewReportPath, readFileSync(reviewReportPath, "utf8").replace("Status: template", "Status: filled"))
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow check", () => {
  it("reports missing workflow artifacts without failing the command", () => {
    const projectDir = createProfiledTempProject()

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain(".persona/workflow/plan.md: missing")
    expect(result.stdout).toContain("Next: run `npx ph plan`")
  })

  it("guides implementation requests back to intake or bootstrap when .persona exists but the profile is missing", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow implement failed: implement")
    expect(result.stderr).toContain(".persona exists but the backend project profile is not ready")
    expect(result.stderr).toContain(".persona/project-profile.jsonc is required before implementation")
    expect(result.stderr).toContain("Do not enter implementation rail until profile/bootstrap is ready")
    expect(result.stderr).toContain("npx ph intake --interactive")
    expect(result.stderr).toContain("npx ph bootstrap backend")
  })

  it("reports accepted plan, filled implementation report, and evidence presence", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeSubstantiveImplementationReport(projectDir)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain(".persona/workflow/plan.md: accepted")
    expect(result.stdout).toContain(".persona/workflow/implementation-report.md: filled")
    expect(result.stdout).toContain(".persona/workflow/review-report.md: template")
    expect(result.stdout).toContain(".persona/evidence: present")
    expect(result.stdout).toContain("Next: fill review report")
  })

  it("keeps review-report as next action while warning about a pending req ticket", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeSubstantiveImplementationReport(projectDir)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writePendingReqBacklog(projectDir)

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain(".persona/workflow/implementation-report.md: filled")
    expect(result.stdout).toContain(".persona/workflow/review-report.md: template")
    expect(result.stdout).toContain("Next: fill review report and run `npx ph plan --report-filled review`")
    expect(result.stdout).toContain("- pending tickets: present")
    expect(result.stdout).toContain("Ticket: req-1")
    expect(result.stdout).toContain("Do not claim overall completion while pending tickets remain.")
    expect(result.stdout).toContain("If this req ticket is actually complete after review: `npx ph workflow archive req-1`")
    expect(result.stdout).toContain("Archive is a candidate action only; do not auto-archive.")
  })

  it("keeps post-build closure as the next action when reports are template and a req ticket remains", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writePendingReqBacklog(projectDir)

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(".persona/workflow/implementation-report.md: template")
    expect(result.stdout).toContain(".persona/workflow/review-report.md: template")
    expect(result.stdout).toContain(
      "Next: if build/test/runtime already pass, fill implementation and review reports, archive the completed ticket after review, then run `npx ph workflow finish implement`",
    )
    expect(result.stdout).toContain("Do not claim overall completion while pending tickets remain.")
    expect(result.stdout).toContain("If this req ticket is actually complete after review: `npx ph workflow archive req-1`")
  })

  it("guides filled-but-template reports back to coverage fill, required reads, and req review", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Task API\n\n- Task CRUD\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeJavaRoleFiles(projectDir)
    markWorkflowReportsFilledButTemplateLike(projectDir)
    writePendingReqBacklog(projectDir)
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "profile-summary-injected.json"), "{\"profileSummaryInjected\":true}\n")

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const resume = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const rows = workflowStatusRows(check.stdout)

    expect(check.status).toBe(0)
    expect(rows.get(".persona/workflow/implementation-report.md")).toBe("filled")
    expect(rows.get(".persona/workflow/review-report.md")).toBe("filled")
    expect(rows.get("report coverage")).toContain("reports say filled but required coverage is missing")
    expect(rows.get("profile read coverage")).toContain("project profile exists but profile read coverage is empty")
    expect(rows.get("java role read coverage")).toContain("workflow evidence/read coverage missing")
    expect(rows.get("pending tickets")).toBe("present")
    expect(check.stdout).toContain("Next: fill report coverage")
    expect(resume.status).toBe(0)
    expect(resume.stdout).toContain("Reports say filled but required coverage is missing")
    expect(resume.stdout).toContain("read README/profile/generated Java role files")
    expect(resume.stdout).toContain("update implementation/review reports")
    expect(resume.stdout).toContain("Do not archive req tickets until review confirms requirements are satisfied.")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: verification-unknown")
    expect(finish.stderr).toContain("Next action: Run the project's supported test/build/runtime verification and record the outcome in workflow evidence.")
    expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
    expect(finish.stderr).toContain("- report-coverage-missing")
    expect(finish.stderr).toContain("- pending-ticket")
  })

  it("reports completed workflow as PASS when bearshell command discipline is observed", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: PASS")
    expect(result.stdout).toContain("- command discipline: bearshell observed")
    expect(result.stdout).toContain("Next: archive completed workflow")
  })

  it("blocks closure when a Spring Controller directly depends on a Repository", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeJavaRoleFiles(projectDir)
    writeControllerRepositoryViolation(projectDir)
    writeCompleteWorkflowReportsAndEvidence(projectDir)
    writeSinglePendingTicket(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const resume = runPersonaCli(["workflow", "continue"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const archive = runPersonaCli(["workflow", "archive", "req-1"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain(`- architecture conventions: ${CONTROLLER_REPOSITORY_CONVENTION.id} block: TaskController directly depends on TaskRepository; ${CONTROLLER_REPOSITORY_CONVENTION.actionableMessage}`)
    expect(check.stdout).toContain(`Next: ${CONTROLLER_REPOSITORY_CONVENTION.fixPath}`)
    expect(closureJson.nextStep).toMatchObject({
      blockerId: CONTROLLER_REPOSITORY_CONVENTION.blockerId,
      id: CONTROLLER_REPOSITORY_CONVENTION.stepId,
      status: "blocked",
    })
    expect(closureJson.state.blockers).toContainEqual(expect.objectContaining({
      id: CONTROLLER_REPOSITORY_CONVENTION.blockerId,
      reason: expect.stringContaining(CONTROLLER_REPOSITORY_CONVENTION.id),
    }))
    expect(resume.stdout).toContain(`Blocker: ${CONTROLLER_REPOSITORY_CONVENTION.blockerId}`)
    expect(resume.stdout).toContain("TaskController directly depends on TaskRepository")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain(`Blocker: ${CONTROLLER_REPOSITORY_CONVENTION.blockerId}`)
    expect(finish.stderr).toContain(`Next action: ${CONTROLLER_REPOSITORY_CONVENTION.fixPath.charAt(0).toUpperCase()}${CONTROLLER_REPOSITORY_CONVENTION.fixPath.slice(1)}`)
    expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
    expect(archive.status).toBe(1)
    expect(archive.stderr).toContain(CONTROLLER_REPOSITORY_CONVENTION.blockerId)
  })

  it("warns without convention blocking while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    writeConventionLevel(projectDir, "warn")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeJavaRoleFiles(projectDir)
    writeControllerRepositoryViolation(projectDir)
    writeCompleteWorkflowReportsAndEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(check.stdout).toContain(`- architecture conventions: ${CONTROLLER_REPOSITORY_CONVENTION.id} warn: TaskController directly depends on TaskRepository`)
    expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
      CONTROLLER_REPOSITORY_CONVENTION.blockerId,
    )
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("reports without convention blocking while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    writeConventionLevel(projectDir, "report")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeJavaRoleFiles(projectDir)
    writeControllerRepositoryViolation(projectDir)
    writeCompleteWorkflowReportsAndEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(check.stdout).toContain(`- architecture conventions: ${CONTROLLER_REPOSITORY_CONVENTION.id} report: TaskController directly depends on TaskRepository`)
    expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
      CONTROLLER_REPOSITORY_CONVENTION.blockerId,
    )
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("does not add an architecture blocker while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeJavaRoleFiles(projectDir)
    writeControllerServiceDependency(projectDir)
    writeCompleteWorkflowReportsAndEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("- architecture conventions: architecture convention violations not observed")
    expect(check.stdout).not.toContain(CONTROLLER_REPOSITORY_CONVENTION.blockerId)
    expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
      CONTROLLER_REPOSITORY_CONVENTION.blockerId,
    )
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("keeps a registry with observer and ast-grep conventions", () => {
    expect(CONVENTION_REGISTRY.length).toBeGreaterThanOrEqual(3)
    expect(CONVENTION_REGISTRY.some((definition) => definition.check.kind === "ast-grep")).toBe(true)
  })

  it("blocks closure when a Spring Service owns in-memory state or id counters", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeJavaRoleFiles(projectDir)
    writeControllerServiceDependency(projectDir)
    writeServiceStateOwnershipViolation(projectDir)
    writeCompleteWorkflowReportsAndEvidence(projectDir)
    writeSinglePendingTicket(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const archive = runPersonaCli(["workflow", "archive", "req-1"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain(`- architecture conventions: ${SERVICE_STATE_OWNERSHIP_CONVENTION.id} block: TaskService owns in-memory state/id sequence`)
    expect(check.stdout).toContain("Map/AtomicLong/nextId")
    expect(check.stdout).toContain("src/main/java/com/example/task/application/TaskService.java:5")
    expect(check.stdout).toContain(SERVICE_STATE_OWNERSHIP_CONVENTION.fixPath)
    expect(closureJson.nextStep).toMatchObject({
      blockerId: SERVICE_STATE_OWNERSHIP_CONVENTION.blockerId,
      id: SERVICE_STATE_OWNERSHIP_CONVENTION.stepId,
      status: "blocked",
    })
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain(SERVICE_STATE_OWNERSHIP_CONVENTION.blockerId)
    expect(archive.status).toBe(1)
    expect(archive.stderr).toContain(SERVICE_STATE_OWNERSHIP_CONVENTION.blockerId)
  })

  it("warns without convention blocking while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    writeConventionLevels(projectDir, { [SERVICE_STATE_OWNERSHIP_CONVENTION.id]: "warn" })
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeJavaRoleFiles(projectDir)
    writeControllerServiceDependency(projectDir)
    writeServiceStateOwnershipViolation(projectDir)
    writeCompleteWorkflowReportsAndEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain(`${SERVICE_STATE_OWNERSHIP_CONVENTION.id} warn`)
    expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
      SERVICE_STATE_OWNERSHIP_CONVENTION.blockerId,
    )
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("does not add a Service blocker while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeJavaRoleFiles(projectDir)
    writeControllerServiceDependency(projectDir)
    writeServiceLocalStateLookalikes(projectDir)
    writeCompleteWorkflowReportsAndEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("- architecture conventions: architecture convention violations not observed")
    expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
      SERVICE_STATE_OWNERSHIP_CONVENTION.blockerId,
    )
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("blocks closure from an ast-grep convention when the configured level is block", () => {
    const projectDir = createProfiledTempProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = writeFakeAstGrepBinary(projectDir)
    try {
      writeConventionLevels(projectDir, { [CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id]: "block" })
      expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      writeJavaRoleFiles(projectDir)
      writeControllerPersistenceImportRule(projectDir)
      writeControllerPersistenceImportViolation(projectDir)
      writeCompleteWorkflowReportsAndEvidence(projectDir)
      writeSinglePendingTicket(projectDir)

      const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const archive = runPersonaCli(["workflow", "archive", "req-1"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closureJson = JSON.parse(closure.stdout)

      expect(check.status).toBe(0)
      expect(check.stdout).toContain(`${CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id} block`)
      expect(check.stdout).toContain(CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.actionableMessage)
      expect(check.stdout).toContain(CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.fixPath)
      expect(closureJson.state.blockers).toContainEqual(expect.objectContaining({
        id: CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.blockerId,
        reason: expect.stringContaining(CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id),
      }))
      expect(finish.status).toBe(1)
      expect(finish.stderr).toContain(`Blocker: ${CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.blockerId}`)
      expect(finish.stderr).toContain(`Next action: ${CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.fixPath.charAt(0).toUpperCase()}${CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.fixPath.slice(1)}`)
      expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
      expect(archive.status).toBe(1)
      expect(archive.stderr).toContain(CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.blockerId)
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("does not hard block an ast-grep convention at warn level while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = writeFakeAstGrepBinary(projectDir)
    try {
      writeConventionLevels(projectDir, { [CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id]: "warn" })
      expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      writeJavaRoleFiles(projectDir)
      writeControllerPersistenceImportRule(projectDir)
      writeControllerPersistenceImportViolation(projectDir)
      writeCompleteWorkflowReportsAndEvidence(projectDir)

      const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closureJson = JSON.parse(closure.stdout)

      expect(check.status).toBe(0)
      expect(check.stdout).toContain(`${CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id} warn`)
      expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
        CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.blockerId,
      )
      expect(finish.status).toBe(1)
      expect(finish.stderr).toContain("Blocker: trusted-authority-required")
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("does not add an ast-grep blocker when the convention does not match while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = writeFakeAstGrepBinary(projectDir)
    try {
      writeConventionLevels(projectDir, { [CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id]: "block" })
      expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      writeJavaRoleFiles(projectDir)
      writeControllerPersistenceImportRule(projectDir)
      writeControllerServiceDependency(projectDir)
      writeCompleteWorkflowReportsAndEvidence(projectDir)

      const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closureJson = JSON.parse(closure.stdout)

      expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
        CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.blockerId,
      )
      expect(finish.status).toBe(1)
      expect(finish.stderr).toContain("Blocker: trusted-authority-required")
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("blocks closure for an explicit block-level ast-grep convention when ast-grep is unavailable", () => {
    const projectDir = createProfiledTempProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = join(projectDir, "missing-sg")
    try {
      writeConventionLevels(projectDir, { [CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id]: "block" })
      expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      writeJavaRoleFiles(projectDir)
      writeControllerPersistenceImportRule(projectDir)
      writeControllerPersistenceImportViolation(projectDir)
      writeCompleteWorkflowReportsAndEvidence(projectDir)

      const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closureJson = JSON.parse(closure.stdout)

      expect(check.status).toBe(0)
      expect(check.stdout).toContain("ast-grep binary not found")
      expect(check.stdout).toContain("Workflow status: WARN")
      expect(closureJson.state.blockers).toContainEqual(expect.objectContaining({
        id: "convention-toolchain-missing",
        reason: expect.stringContaining("install sg/ast-grep or set PH_AST_GREP_BIN"),
      }))
      expect(closureJson.nextStep).toMatchObject({
        commandAfterContent: "npx ph workflow check",
        id: "install-convention-toolchain",
      })
      expect(finish.status).toBe(1)
      expect(finish.stderr).toContain("Blocker: convention-toolchain-missing")
      expect(finish.stderr).toContain("Next action: Install sg/ast-grep or lower the affected convention from block level.")
      expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
      expect(finish.stderr).not.toContain("unmapped-blocker")
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("keeps report-level ast-grep toolchain misses warning-only while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = join(projectDir, "missing-sg")
    try {
      writeConventionLevels(projectDir, { [CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id]: "report" })
      expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      writeJavaRoleFiles(projectDir)
      writeControllerPersistenceImportRule(projectDir)
      writeControllerPersistenceImportViolation(projectDir)
      writeCompleteWorkflowReportsAndEvidence(projectDir)

      const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closureJson = JSON.parse(closure.stdout)

      expect(check.status).toBe(0)
      expect(check.stdout).toContain("ast-grep binary not found")
      expect(check.stdout).toContain("Workflow status: WARN")
      expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain("convention-toolchain-missing")
      expect(finish.status).toBe(1)
      expect(finish.stderr).toContain("Blocker: trusted-authority-required")
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("keeps default warn-level ast-grep toolchain misses warning-only while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = join(projectDir, "missing-sg")
    try {
      expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
      writeJavaRoleFiles(projectDir)
      writeControllerPersistenceImportRule(projectDir)
      writeControllerPersistenceImportViolation(projectDir)
      writeCompleteWorkflowReportsAndEvidence(projectDir)

      const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
      const closureJson = JSON.parse(closure.stdout)

      expect(check.status).toBe(0)
      expect(check.stdout).toContain("ast-grep binary not found")
      expect(check.stdout).toContain("Workflow status: WARN")
      expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain("convention-toolchain-missing")
      expect(finish.status).toBe(1)
      expect(finish.stderr).toContain("Blocker: trusted-authority-required")
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("warns and points to workflow next when a pending ticket remains despite passing reports and gates", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writePassingWorkflowEvidence(projectDir)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "backlog.md"),
      [
        "# Persona Workflow Backlog",
        "",
        "Status: active",
        "",
        "| Order | Ticket | Title | Status | Path |",
        "| --- | --- | --- | --- | --- |",
        "| 1 | step-1 | Equipment catalog API | archived | .persona/workflow/history/step-1/00-task-card.md |",
        "| 2 | step-2 | Technical Constraints | pending | .persona/workflow/work/step-2/00-task-card.md |",
      ].join("\n"),
    )

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain("- pending tickets: present")
    expect(result.stdout).toContain("Ticket: step-2")
    expect(result.stdout).toContain("Title: Technical Constraints")
    expect(result.stdout).toContain("Path: .persona/workflow/work/step-2/00-task-card.md")
    expect(result.stdout).toContain("Next: run `npx ph workflow next` or `npx ph workflow continue`")
    expect(result.stdout).toContain("Do not claim overall completion while pending tickets remain.")
    expect(result.stdout).toContain("review/archive candidate")
    expect(result.stdout).not.toContain("Next: archive completed workflow")
  })

  it("recognizes report statuses written as checklist or bold status lines", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "# Implementation Report",
        "",
        "- **Status:** filled",
        "- README ranges read: 1-220",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      [
        "# Review Report",
        "",
        "**Status:** filled",
        "- `npx ph bearshell --shell './gradlew bootRun'`",
      ].join("\n"),
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain(".persona/workflow/implementation-report.md: filled")
    expect(result.stdout).toContain(".persona/workflow/review-report.md: filled")
  })

  it("warns when the backend profile expects Java Spring Gradle but the generated project is Node/CommonJS", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "package.json"), "{\"type\":\"commonjs\"}\n")
    mkdirSync(join(projectDir, "src"), { recursive: true })
    writeFileSync(join(projectDir, "src", "index.js"), "module.exports = {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- README ranges read: 1-220\n- `npx ph bearshell --shell 'npm test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell 'npm test'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(check.stdout).toContain("stack alignment: STACK_MISMATCH")
    expect(check.stdout).toContain("profile expects Java/Spring/Gradle")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: report-coverage-missing")
    expect(finish.stderr).toContain("Next action: Read README, project-profile, and generated role context, then update workflow reports with actual coverage evidence.")
    expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
    expect(finish.stderr).toContain("- stack-alignment-mismatch")
  })

  it("blocks finish when the backend profile was not read before implementation", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- README ranges read: 1-220\n- `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("profile read coverage: project profile exists but profile read coverage is empty")
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: report-coverage-missing")
    expect(finish.stderr).toContain("Next action: Read README, project-profile, and generated role context, then update workflow reports with actual coverage evidence.")
    expect(finish.stderr).toContain("- profile-read-coverage-missing")
  })

  it("passes profile read coverage while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "- README ranges read: 1-220",
        "- Project profile read method: npx ph bearshell",
        "- Project profile ranges read: all",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("profile read coverage: project profile ranges observed")
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("warns and blocks finish when final verification recorded a compile failure", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "- README ranges read: 1-220",
        "- Project profile ranges read: all",
        "- `npx ph bearshell --shell './gradlew test'`",
        "- Verification failed: ./gradlew test failed",
        "- > Task :compileJava FAILED",
        "- LendingController.java:29: error: cannot find symbol",
        "- symbol: class ReturnLendingRequest",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- Manual QA blocked by compile failure.\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(check.stdout).toContain("verification failure: compile/test verification failed")
    expect(check.stdout).toContain("./gradlew test failed")
    expect(check.stdout).toContain("cannot find symbol")
    expect(check.stdout).toContain("Next: fix compile/test failure")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Workflow finish failed: implement")
    expect(finish.stderr).toContain("Blocker: verification-failed")
    expect(finish.stderr).toContain("Next action: Fix the compile/test failure, rerun supported verification, and record the new outcome.")
    expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
  })

  it("does not add a verification blocker after recovery notes while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "- README ranges read: 1-220",
        "- Project profile ranges read: all",
        "- `npx ph bearshell --shell './gradlew test'`",
        "- `npx ph bearshell --shell './gradlew build'`",
        "- Read evidence notes: initial `./gradlew test` failed because `./gradlew` was missing; after adding the wrapper, the build failed once on a missing Java 17 toolchain, then succeeded after switching the project toolchain to Java 21.",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("verification failure: no failed verification recorded")
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("infers profile read coverage from Persona evidence", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'sample'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "class Application {}\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- README ranges read: 1-220\n- `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "phase0", "2026-06-24T00-00-00-000Z-project-profile.jsonc.json"),
      `${JSON.stringify({ targetFile: join(projectDir, ".persona", "project-profile.jsonc"), fileRole: "project-profile" }, null, 2)}\n`,
    )

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("profile read coverage: project profile read evidence observed")
    expect(check.stdout).toContain("Workflow status: PASS")
  })

  it("keeps completed workflow WARN when bearshell command discipline is missing", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- [x] raw shell을 직접 썼고 `npx ph bearshell`은 제공되지 않았다.\n- [x] `./gradlew test build`\n",
    )
    writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- [x] HTTP smoke checked.\n")
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain("- command discipline: raw shell used for final verification; rerun test/build/bootRun through `npx ph bearshell`")
    expect(result.stdout).toContain("Next: rerun final verification through `npx ph bearshell`")
  })

  it("creates smoke and feedback reports from the workflow status", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const smoke = runPersonaCli(["smoke"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const feedback = runPersonaCli(["feedback"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(smoke.status).toBe(0)
    expect(smoke.stdout).toContain("Smoke report written")
    expect(feedback.status).toBe(0)
    expect(feedback.stdout).toContain("Feedback template written")
    const smokeReport = readFileSync(join(projectDir, ".persona", "workflow", "smoke-report.md"), "utf8")
    const feedbackReport = readFileSync(join(projectDir, ".persona", "workflow", "feedback-report.md"), "utf8")
    expect(smokeReport).toContain("# Persona Harness Smoke Report")
    expect(smokeReport).toContain("Workflow status:")
    expect(smokeReport).toContain("## Local Integration")
    expect(smokeReport).toContain("OpenCode:")
    expect(smokeReport).toContain("Persona plugin path:")
    expect(smokeReport).toContain("Rules surface:")
    expect(smokeReport).toContain("Stale fixture scan:")
    expect(feedbackReport).toContain("# Persona Harness Tester Feedback")
    expect(feedbackReport).toContain("## 실제 프로젝트에 쓸 수 있나?")
  })

  it("prints smoke and feedback help without writing reports", () => {
    const projectDir = createProfiledTempProject()

    const smokeHelp = runPersonaCli(["smoke", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const feedbackHelp = runPersonaCli(["feedback", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(smokeHelp.status).toBe(0)
    expect(smokeHelp.stdout).toContain("Usage: ph smoke")
    expect(smokeHelp.stdout).toContain("npx ph workflow check")
    expect(feedbackHelp.status).toBe(0)
    expect(feedbackHelp.stdout).toContain("Usage: ph feedback")
    expect(feedbackHelp.stdout).toContain("npx ph doctor")
    expect(existsSync(join(projectDir, ".persona", "workflow", "smoke-report.md"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "workflow", "feedback-report.md"))).toBe(false)
  })

  it("keeps smoke report output directory creation idempotent", () => {
    const projectDir = createProfiledTempProject()
    const first = runPersonaCli(["smoke"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const second = runPersonaCli(["smoke"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(existsSync(join(projectDir, ".persona", "workflow", "smoke-report.md"))).toBe(true)
  })
})

describe("ph workflow guard", () => {
  it("does not block normal implementation when Persona Harness is not initialized", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness not initialized")
    expect(result.stdout).toContain("Implementation is not blocked")
    expect(result.stdout).toContain("npx ph init")
  })

  it("blocks implementation rail when Persona Harness is initialized but the backend profile is missing", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona"), { recursive: true })

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow implement failed: implement")
    expect(result.stderr).toContain("Harness initialized but project profile is not ready")
    expect(result.stderr).toContain(".persona/project-profile.jsonc is required before implementation")
    expect(result.stderr).toContain("Do not enter implementation rail until profile/bootstrap is ready")
    expect(result.stderr).toContain("npx ph bootstrap backend")
    expect(result.stderr).toContain("npx ph intake --default backend")
  })

  it("blocks implementation until the plan is accepted", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow guard failed: implement")
    expect(result.stderr).toContain(".persona/workflow/plan.md must be accepted")
  })

  it("allows implementation after the plan is accepted and report templates exist", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Guard: implement")
    expect(result.stdout).toContain("Guard status: PASS")
    expect(result.stdout).toContain("npx ph workflow implement")
  })

  it("blocks final answer until implementation and review reports are filled", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeSubstantiveImplementationReport(projectDir)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow guard failed: final")
    expect(result.stderr).toContain(".persona/workflow/review-report.md must be filled")
  })

  it("blocks final answer until trusted authority exists even when reports are filled", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const result = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("trusted-authority-required")
  })

  it("keeps workflow check report-only even when final guard fails", () => {
    const projectDir = createProfiledTempProject()

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const guard = runPersonaCli(["workflow", "guard", "final"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(guard.status).toBe(1)
  })
})

describe("ph bootstrap backend", () => {
  it("creates a default backend profile, policy overlay, accepted plan, and workflow reports in a clean project", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness backend bootstrap complete")
    expect(result.stdout).toContain(".persona/harness.jsonc")
    expect(result.stdout).toContain(".persona/rules/")
    expect(result.stdout).toContain(".opencode/opencode.json")
    expect(result.stdout).toContain(".gitignore")
    expect(result.stdout).toContain("AGENTS.md")
    expect(result.stdout).toContain(".persona/project-profile.jsonc")
    expect(result.stdout).toContain(".persona/policies/overlay.jsonc")
    expect(result.stdout).toContain(".persona/workflow/plan.md")
    expect(result.stdout).toContain(".persona/workflow/implementation-report.md")
    expect(result.stdout).toContain(".persona/workflow/review-report.md")
    expect(result.stdout).toContain("npx ph workflow implement")
    expect(existsSync(join(projectDir, ".persona", "harness.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "rules", "backend", "java-common.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "rules", "diff-rules"))).toBe(false)
    expect(existsSync(join(projectDir, ".opencode", "opencode.json"))).toBe(true)
    expect(existsSync(join(projectDir, ".gitignore"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "project-profile.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "policies", "overlay.jsonc"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "plan.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "implementation-report.md"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "review-report.md"))).toBe(true)
    expect(readFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "utf8")).toContain("Status: accepted")
    const agents = readFileSync(join(projectDir, "AGENTS.md"), "utf8")
    expect(agents).toContain("Persona Harness")
    expect(agents).toContain("npx ph workflow implement")
    expect(agents).toContain(".persona/project-profile.jsonc")
    expect(agents).toContain("Do not infer a Node/CommonJS project from package.json")
    expect(agents).not.toContain("Persona Harness Role Checklist Relay Preview")
    expect(loadHarnessConfig(projectDir).enforce.executeVerification).toBe(false)
    expect(loadHarnessConfig(projectDir).features.runtimeInjection).toBe(false)
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    expect(isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp["persona-harness-code-nav"] : undefined).toBeUndefined()
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp.grep_app).toMatchObject({
      type: "remote",
      url: "https://mcp.grep.app",
    })
    expect(mcp.context7).toMatchObject({
      type: "remote",
      url: "https://mcp.context7.com/mcp",
    })
    expect(mcp.codegraph).toBeUndefined()
    expect(existsSync(join(projectDir, ".codegraph"))).toBe(false)
  })

  it("does not register the developer MCP bundle when backend bootstrap opts out", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--no-developer-mcp"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("developer MCP bundle disabled by --no-developer-mcp")
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp.grep_app).toBeUndefined()
    expect(mcp.context7).toBeUndefined()
    expect(mcp.codegraph).toBeUndefined()
    expect(existsSync(join(projectDir, ".codegraph"))).toBe(false)
  })

  it("keeps --no-codegraph as an explicit no-op for the default remote-only developer MCP bundle", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--no-codegraph"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("registered developer MCP bundle for OpenCode without CodeGraph")
    expect(result.stdout).toContain("codegraph is not registered by default")
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp.grep_app).toMatchObject({
      type: "remote",
      url: "https://mcp.grep.app",
    })
    expect(mcp.context7).toMatchObject({
      type: "remote",
      url: "https://mcp.context7.com/mcp",
    })
    expect(mcp.codegraph).toBeUndefined()
    expect(existsSync(join(projectDir, ".codegraph"))).toBe(false)
  })

  it("enables direct verification when backend bootstrap is strict", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--strict"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("enabled strict closure verification")
    expect(result.stdout).toContain("Strict mode:")
    expect(result.stdout).toContain("sets enforce.executeVerification: true")
    expect(result.stdout).toContain("PH runs the project verification command during closure/finish")
    expect(result.stdout).toContain("expect toolchain command cost")
    expect(result.stdout).toContain("does not enable features.runtimeInjection or enforce.systemConstitution; each remains independently opt-in")
    expect(result.stdout).toContain("does not enable enforce.writeDeny, enforce.idleContinuation, or enforce.ralphLoop")
    expect(result.stdout).toContain("no generated app product-quality certification or closure guarantee")
    expect(loadHarnessConfig(projectDir).enforce.executeVerification).toBe(true)
    expect(loadHarnessConfig(projectDir).features.runtimeInjection).toBe(false)
    expect(loadHarnessConfig(projectDir).enforce.systemConstitution).toBe(false)
    expect(loadHarnessConfig(projectDir).enforce.writeDeny).toBe(false)
    expect(loadHarnessConfig(projectDir).enforce.idleContinuation).toBe(false)
    expect(loadHarnessConfig(projectDir).enforce.ralphLoop.enabled).toBe(false)
  })

  it("keeps runtime injection independently opt-in when strict verification is also requested", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--strict", "--runtime-injection-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("enabled strict closure verification")
    expect(result.stdout).toContain("enabled runtime injection preview")
    expect(result.stdout).toContain("Runtime injection preview:")
    expect(loadHarnessConfig(projectDir).enforce.executeVerification).toBe(true)
    expect(loadHarnessConfig(projectDir).features.runtimeInjection).toBe(true)
    expect(loadHarnessConfig(projectDir).enforce.systemConstitution).toBe(false)
  })

  it("enables runtime injection preview without strict verification when explicitly requested", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--runtime-injection-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("enabled runtime injection preview")
    expect(result.stdout).toContain("Runtime injection preview:")
    expect(result.stdout).toContain("default init/bootstrap keeps PH as gate-first CLI/evidence tooling")
    expect(result.stdout).toContain("measured 10-pair OpenCode A/B was worse")
    expect(loadHarnessConfig(projectDir).features.runtimeInjection).toBe(true)
    expect(loadHarnessConfig(projectDir).enforce.executeVerification).toBe(false)
    expect(loadHarnessConfig(projectDir).enforce.systemConstitution).toBe(false)
  })

  it("enables the role checklist relay preview only when explicitly requested through the compatibility flag", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--multi-agent-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("enabled Role Checklist Relay preview for test-writer, implementer, and reviewer")
    expect(result.stdout).toContain("Role Checklist Relay preview:")
    expect(result.stdout).toContain("flag/config name is kept as a compatibility alias")
    expect(result.stdout).toContain("role checklist guidance")
    expect(result.stdout).toContain("does not guarantee or enforce host subagent invocation")
    const agentsMd = readFileSync(join(projectDir, "AGENTS.md"), "utf8")
    expect(agentsMd).toContain("Persona Harness Role Checklist Relay Preview")
    expect(agentsMd).toContain("compatibility flag/config name for the Role Checklist Relay preview")
    expect(agentsMd).toContain("main-session role checklist rail through role lenses")
    expect(agentsMd).toContain("does not guarantee or enforce host subagent invocation")
    expect(agentsMd).toContain("npx ph workflow relay next --json")
    expect(agentsMd).toContain("npx ph workflow closure next --json")
    expect(agentsMd).toContain("test-writer")
    expect(agentsMd).toContain("implementer")
    expect(agentsMd).toContain("reviewer")
    expect(agentsMd).toContain("complete the current role checklist in the main session")
    expect(agentsMd).toContain("record whether subagent invocation was used or unavailable")
    expect(loadHarnessConfig(projectDir).multiAgent).toEqual({
      enabled: true,
      roles: ["test-writer", "implementer", "reviewer"],
      models: {},
    })
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    expect(isRecord(opencodeConfig.agent)).toBe(true)
    const agents = isRecord(opencodeConfig.agent) ? opencodeConfig.agent : {}
    expect(agents["test-writer"]).toMatchObject({ mode: "subagent" })
    expect(agents.implementer).toMatchObject({ mode: "subagent" })
    expect(agents.reviewer).toMatchObject({ mode: "subagent" })
    expect(agents.jaeki).toBeUndefined()
    expect(agents.roach).toBeUndefined()
    expect(JSON.stringify(agents["test-writer"])).toContain("Do not implement production code")
    expect(JSON.stringify(agents["test-writer"])).toContain("legacy section name for the Role Checklist Relay contract")
    expect(JSON.stringify(agents["test-writer"])).toContain("Persona Harness relay contract")
    expect(JSON.stringify(agents["test-writer"])).toContain("Do not weaken, delete, or rewrite existing tests")
    expect(JSON.stringify(agents.implementer)).toContain("PH Role Checklist Relay is a main-session role checklist rail")
    expect(JSON.stringify(agents.reviewer)).toContain("Do not implement features unless explicitly reassigned")
    expect(opencodeConfig.plugin).toEqual(expect.arrayContaining([expect.stringContaining("dist/index.js")]))
  })

  it("preserves existing OpenCode plugin and migrates old relay agent keys when enabling the relay preview", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(
      join(projectDir, ".opencode", "opencode.json"),
      `${JSON.stringify(
        {
          plugin: ["/tmp/existing-plugin.js"],
          agent: {
            jaeki: {
              model: "provider/existing-jaeki",
              custom: "kept",
            },
          },
        },
        null,
        2,
      )}\n`,
    )

    const result = runPersonaCli(["bootstrap", "backend", "--multi-agent-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    expect(opencodeConfig.plugin).toEqual(
      expect.arrayContaining(["/tmp/existing-plugin.js", expect.stringContaining("dist/index.js")]),
    )
    const agents = isRecord(opencodeConfig.agent) ? opencodeConfig.agent : {}
    expect(agents.implementer).toMatchObject({
      custom: "kept",
      model: "provider/existing-jaeki",
      mode: "subagent",
    })
    expect(agents.jaeki).toBeUndefined()
    expect(agents["test-writer"]).toMatchObject({ mode: "subagent" })
    expect(agents.reviewer).toMatchObject({ mode: "subagent" })

    const secondResult = runPersonaCli(["bootstrap", "backend", "--multi-agent-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })
    expect(secondResult.status).toBe(0)
    const agentsMd = readFileSync(join(projectDir, "AGENTS.md"), "utf8")
    const firstIndex = agentsMd.indexOf("Persona Harness Role Checklist Relay Preview")
    expect(firstIndex).toBeGreaterThanOrEqual(0)
    expect(agentsMd.indexOf("Persona Harness Role Checklist Relay Preview", firstIndex + 1)).toBe(-1)
    const secondConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const secondAgents = isRecord(secondConfig.agent) ? secondConfig.agent : {}
    expect(secondAgents.implementer).toMatchObject({
      custom: "kept",
      model: "provider/existing-jaeki",
      mode: "subagent",
    })
    expect(secondAgents.jaeki).toBeUndefined()
  })

  it("keeps legacy multi-agent relay AGENTS guidance idempotent when using the role checklist relay flag", () => {
    const projectDir = createTempProject()
    writeFileSync(
      join(projectDir, "AGENTS.md"),
      [
        "# Existing Instructions",
        "",
        "## Persona Harness Multi-Agent Relay Preview",
        "",
        "Legacy relay guidance.",
      ].join("\n"),
    )

    const result = runPersonaCli(["bootstrap", "backend", "--multi-agent-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("AGENTS.md role checklist relay guidance already exists")
    const agentsMd = readFileSync(join(projectDir, "AGENTS.md"), "utf8")
    expect(agentsMd).toContain("Persona Harness Multi-Agent Relay Preview")
    expect(agentsMd).not.toContain("Persona Harness Role Checklist Relay Preview")
  })

  it("enables the code-nav MCP preview only when explicitly requested", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--code-nav-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("enabled code-nav MCP preview")
    expect(result.stdout).toContain("Code-nav MCP preview:")
    expect(result.stdout).toContain("opt-in only via --code-nav-preview")
    expect(result.stdout).toContain("persona-harness-code-nav_search_text")
    expect(result.stdout).toContain("no codegraph/indexer and no token-saving claim")
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp["persona-harness-code-nav"]).toMatchObject({
      type: "local",
      enabled: true,
      command: ["node", join(process.cwd(), "packages", "lsp-tools-mcp", "bin", "code-nav-mcp.mjs"), "mcp"],
    })
    expect(opencodeConfig.plugin).toEqual(expect.arrayContaining([expect.stringContaining("dist/index.js")]))
  })

  it("preserves existing OpenCode plugin, agent, and MCP fields when enabling code-nav preview", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(
      join(projectDir, ".opencode", "opencode.json"),
      `${JSON.stringify(
        {
          plugin: ["/tmp/existing-plugin.js"],
          agent: { custom: { mode: "primary" } },
          mcp: {
            existing: {
              type: "local",
              enabled: true,
              command: ["node", "/tmp/existing.js", "mcp"],
            },
          },
        },
        null,
        2,
      )}\n`,
    )

    const result = runPersonaCli(["bootstrap", "backend", "--code-nav-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    expect(opencodeConfig.plugin).toEqual(
      expect.arrayContaining(["/tmp/existing-plugin.js", expect.stringContaining("dist/index.js")]),
    )
    expect(opencodeConfig.agent).toEqual({ custom: { mode: "primary" } })
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp.existing).toMatchObject({ command: ["node", "/tmp/existing.js", "mcp"] })
    expect(mcp["persona-harness-code-nav"]).toMatchObject({
      type: "local",
      enabled: true,
      command: ["node", join(process.cwd(), "packages", "lsp-tools-mcp", "bin", "code-nav-mcp.mjs"), "mcp"],
    })
  })

  it("writes a code-nav MCP command that can initialize and list tools without a model", () => {
    const projectDir = createTempProject()
    const result = runPersonaCli(["bootstrap", "backend", "--code-nav-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    const entry = isRecord(mcp["persona-harness-code-nav"]) ? mcp["persona-harness-code-nav"] : {}
    const command = Array.isArray(entry.command) ? entry.command.filter((part): part is string => typeof part === "string") : []
    const initialize = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    })
    const list = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
    const input = [
      `Content-Length: ${Buffer.byteLength(initialize)}\r\n\r\n${initialize}`,
      `Content-Length: ${Buffer.byteLength(list)}\r\n\r\n${list}`,
    ].join("")

    const smoke = spawnSync(command[0] ?? "", command.slice(1), { cwd: projectDir, encoding: "utf8", input })

    expect(result.status).toBe(0)
    expect(command).toHaveLength(3)
    expect(smoke.status).toBe(0)
    expect(smoke.stderr).toBe("")
    expect(smoke.stdout).toContain("persona-harness-code-nav")
    expect(smoke.stdout).toContain("persona-harness-code-nav_search_text")
    expect(smoke.stdout).toContain("search_text")
    expect(smoke.stdout).toContain("ast_grep_availability")
  })

  it("registers the CodeGraph wrapper only when --codegraph-preview is explicit", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--codegraph-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("registered developer MCP bundle for OpenCode")
    expect(result.stdout).toContain("Developer MCP bundle:")
    expect(result.stdout).toContain("codegraph is opt-in via --codegraph-preview")
    expect(result.stdout).toContain("PH does not run codegraph init")
    expect(result.stdout).toContain("no PH-owned codegraph")
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp.grep_app).toMatchObject({
      type: "remote",
      url: "https://mcp.grep.app",
    })
    expect(mcp.context7).toMatchObject({
      type: "remote",
      url: "https://mcp.context7.com/mcp",
    })
    expect(mcp.codegraph).toMatchObject({
      type: "local",
      enabled: true,
      command: ["node", join(process.cwd(), "packages", "codegraph-mcp", "bin", "codegraph-mcp.mjs"), "mcp"],
    })
  })

  it("writes a CodeGraph wrapper MCP command that reports unavailable instead of crashing", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["bootstrap", "backend", "--codegraph-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    const entry = isRecord(mcp.codegraph) ? mcp.codegraph : {}
    const command = Array.isArray(entry.command) ? entry.command.filter((part): part is string => typeof part === "string") : []
    const initialize = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    })
    const list = JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} })
    const status = JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "status", arguments: {} } })
    const input = [
      `Content-Length: ${Buffer.byteLength(initialize)}\r\n\r\n${initialize}`,
      `Content-Length: ${Buffer.byteLength(list)}\r\n\r\n${list}`,
      `Content-Length: ${Buffer.byteLength(status)}\r\n\r\n${status}`,
    ].join("")

    const smoke = spawnSync(command[0] ?? "", command.slice(1), {
      cwd: projectDir,
      encoding: "utf8",
      env: { ...process.env, PH_CODEGRAPH_BIN: join(projectDir, "missing-codegraph") },
      input,
    })

    expect(result.status).toBe(0)
    expect(command).toHaveLength(3)
    expect(smoke.status).toBe(0)
    expect(smoke.stderr).toBe("")
    expect(smoke.stdout).toContain("codegraph")
    expect(smoke.stdout).toContain("status")
    expect(smoke.stdout).toContain("unavailable")
    expect(smoke.stdout).toContain("PH_CODEGRAPH_BIN")
  })

  it("describes the CodeGraph wrapper as explicit opt-in in help and capabilities", () => {
    const command = process.execPath
    const args = [join(process.cwd(), "packages", "codegraph-mcp", "bin", "codegraph-mcp.mjs")]
    const help = spawnSync(command, [...args, "--help"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env },
    })
    const capabilities = spawnSync(command, [...args, "capabilities", "--json"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...process.env, PH_CODEGRAPH_BIN: join(process.cwd(), "missing-codegraph") },
    })
    const payload: unknown = JSON.parse(capabilities.stdout)

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("opt-in only")
    expect(help.stdout).toContain("--codegraph-preview")
    expect(help.stdout).not.toContain("default developer convenience")
    expect(capabilities.status).toBe(0)
    expect(isRecord(payload)).toBe(true)
    if (!isRecord(payload)) return
    expect(payload.registeredWithOpenCodeByDefault).toBe(false)
    expect(payload.optInFlag).toBe("--codegraph-preview")
    expect(payload.tokenSavingsClaimed).toBe(false)
  })

  it("uses PH_CODEGRAPH_BIN when the CodeGraph wrapper MCP starts", () => {
    const projectDir = createTempProject()
    const binDir = join(projectDir, "fake-bin")
    mkdirSync(binDir)
    const codegraphPath = join(binDir, "fake-codegraph.mjs")
    writeFileSync(
      codegraphPath,
      [
        "#!/usr/bin/env node",
        "if (process.argv.slice(2).join(' ') !== 'serve --mcp') process.exit(2)",
        "process.stdin.resume()",
        "process.stdin.on('end', () => {",
        "  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { serverInfo: { name: 'fake-codegraph' } } }) + '\\n')",
        "})",
        "",
      ].join("\n"),
    )
    chmodSync(codegraphPath, 0o755)

    const result = runPersonaCli(["bootstrap", "backend", "--codegraph-preview"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    const entry = isRecord(mcp.codegraph) ? mcp.codegraph : {}
    const command = Array.isArray(entry.command) ? entry.command.filter((part): part is string => typeof part === "string") : []
    const initialize = `${JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "test", version: "0" } },
    })}\n`

    const smoke = spawnSync(command[0] ?? "", command.slice(1), {
      cwd: projectDir,
      encoding: "utf8",
      env: { ...process.env, PH_CODEGRAPH_BIN: codegraphPath },
      input: initialize,
    })

    expect(result.status).toBe(0)
    expect(smoke.status).toBe(0)
    expect(smoke.stderr).toBe("")
    expect(smoke.stdout).toContain("fake-codegraph")
  })

  it("preserves existing OpenCode plugin, agent, and MCP fields when registering the default developer MCP bundle", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(
      join(projectDir, ".opencode", "opencode.json"),
      `${JSON.stringify(
        {
          plugin: ["/tmp/existing-plugin.js"],
          agent: { custom: { mode: "primary" } },
          mcp: {
            existing: {
              type: "local",
              enabled: true,
              command: ["node", "/tmp/existing.js", "mcp"],
            },
          },
        },
        null,
        2,
      )}\n`,
    )

    const result = runPersonaCli(["bootstrap", "backend"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    const opencodeConfig = readJsonObject(join(projectDir, ".opencode", "opencode.json"))
    expect(opencodeConfig.plugin).toEqual(
      expect.arrayContaining(["/tmp/existing-plugin.js", expect.stringContaining("dist/index.js")]),
    )
    expect(opencodeConfig.agent).toEqual({ custom: { mode: "primary" } })
    const mcp = isRecord(opencodeConfig.mcp) ? opencodeConfig.mcp : {}
    expect(mcp.existing).toMatchObject({ command: ["node", "/tmp/existing.js", "mcp"] })
    expect(mcp.grep_app).toMatchObject({
      type: "remote",
      url: "https://mcp.grep.app",
    })
    expect(mcp.context7).toMatchObject({
      type: "remote",
      url: "https://mcp.context7.com/mcp",
    })
    expect(mcp.codegraph).toBeUndefined()
  })

  it("fills missing backend workflow pieces after init without requiring the user to type every command", () => {
    const projectDir = createTempProject()
    const init = runPersonaCli(["init"], { cwd: projectDir, env: {}, invocationName: "ph", packageRoot: process.cwd() })
    expect(init.status).toBe(0)
    rmSync(join(projectDir, ".persona", "project-profile.jsonc"), { force: true })

    const bootstrap = runPersonaCli(["bootstrap", "backend"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })
    const implement = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(bootstrap.status).toBe(0)
    expect(bootstrap.stdout).toContain("created default backend profile")
    expect(implement.status).toBe(0)
    expect(implement.stdout).toContain("Implementation rail status: PASS")
  })

  it("does not overwrite an existing root AGENTS.md during backend bootstrap", () => {
    const projectDir = createTempProject()
    const existingAgents = "# Existing Agent Rules\n\nKeep this project-specific instruction.\n"
    writeFileSync(join(projectDir, "AGENTS.md"), existingAgents)

    const result = runPersonaCli(["bootstrap", "backend"], {
      cwd: projectDir,
      env: {},
      invocationName: "ph",
      packageRoot: process.cwd(),
    })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("AGENTS.md already exists")
    expect(readFileSync(join(projectDir, "AGENTS.md"), "utf8")).toBe(existingAgents)
  })
})

describe("ph workflow start and finish", () => {
  it("blocks implementation start until the accepted-plan gate passes", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "start", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow start failed: implement")
    expect(result.stderr).toContain(".persona/workflow/plan.md must be accepted")
  })

  it("prints the AI-facing implementation rail after the accepted-plan gate passes", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "start", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Start: implement")
    expect(result.stdout).toContain("npx ph plan --implement")
    expect(result.stdout).toContain("Short TUI request detected")
    expect(result.stdout).toContain("README.md 보고 구현해줘")
    expect(result.stdout).toContain("Use PH-owned surfaces first for structure checks")
    expect(result.stdout).toContain("Optional external codegraph/code-nav tools")
    expect(result.stdout).toContain("Do not read `.persona/rules` directly")
    expect(result.stdout).toContain("Use `npx ph bearshell` for shell verification")
    expect(result.stdout).toContain("npx ph plan --report-filled implementation")
    expect(result.stdout).toContain("Do not give the final answer until `npx ph workflow finish implement` passes")
    expect(result.stdout).toContain("npx ph workflow finish implement")
  })

  it("prints the single AI-facing implementation rail with OS-safe README chunk-read commands", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Persona Harness Workflow Implement")
    expect(result.stdout).toContain("Implementation rail status: PASS")
    expect(result.stdout).toContain("Intent classification: implementation request.")
    expect(result.stdout).toContain("Basis: this AI-facing rail is used when the user asks to implement from README")
    expect(result.stdout).toContain("Next action:")
    expect(result.stdout).toContain("1. Turn the requirements source into tickets with split/capture/next.")
    expect(result.stdout).toContain("2. Implement only the current ticket.")
    expect(result.stdout).toContain("Forbidden: writing production code directly without a ticket.")
    expect(result.stdout).toContain("macOS/Linux line count")
    expect(result.stdout).toContain("npx ph bearshell --shell 'wc -l README.md'")
    expect(result.stdout).toContain("macOS/Linux first chunk")
    expect(result.stdout).toContain("npx ph bearshell --shell 'sed -n \"1,220p\" README.md'")
    expect(result.stdout).toContain("Windows PowerShell first chunk")
    expect(result.stdout).toContain(
      'npx ph bearshell powershell -NoProfile -Command "Get-Content README.md -TotalCount 220"',
    )
    expect(result.stdout).toContain(
      'npx ph bearshell powershell -NoProfile -Command "Get-Content README.md | Select-Object -Skip 220 -First 220"',
    )
    expect(result.stdout).toContain("Select-String -Path README.md -Pattern TODO")
    expect(result.stdout).toContain("do not recurse project root or .persona root")
    expect(result.stdout).not.toContain("Get-ChildItem -Path README.md,src,.persona -Recurse")
    expect(result.stdout).not.toContain("Get-ChildItem -Recurse -File | Select-String -Pattern TODO")
    expect(result.stdout).not.toContain('npx ph bearshell --shell "powershell')
    expect(result.stdout).not.toContain("npx ph bearshell --shell 'powershell")
    expect(result.stdout).not.toContain("Select-String -Recurse")
    expect(result.stdout).toContain("Record README ranges read in `.persona/workflow/implementation-report.md`")
    expect(result.stdout).toContain("If existing Java/Spring source files already exist")
    expect(result.stdout).toContain("existing code wins over greenfield guidance")
    expect(result.stdout).toContain("find src/main/java src/test/java -name \"*.java\"")
    expect(result.stdout).toContain(
      'npx ph bearshell powershell -NoProfile -Command "Get-ChildItem -Path src/main/java,src/test/java -Recurse -File -Filter *.java',
    )
    expect(result.stdout).toContain("Java Role Read Follow-up")
    expect(result.stdout).toContain("Java role discovery/read evidence")
    expect(result.stdout).toContain("Gradle wrapper verification")
    expect(result.stdout).toContain("./gradlew test")
    expect(result.stdout).toContain("gradlew.bat")
    expect(result.stdout).toContain("Do not read `.persona/rules` directly")
    expect(result.stdout).toContain("npx ph workflow finish implement")
  })

  it("blocks the single implementation rail until the plan is accepted", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow implement failed: implement")
    expect(result.stderr).toContain(".persona/workflow/plan.md must be accepted")
  })

  it("blocks implementation finish until final workflow evidence passes", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeSubstantiveImplementationReport(projectDir)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow finish failed: implement")
    expect(result.stderr).toContain("Blocker: verification-unknown")
    expect(result.stderr).toContain("- review-report-missing")
  })

  it("blocks finish with review-report guidance while preserving pending req ticket guidance", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeSubstantiveImplementationReport(projectDir)
    expect(runPersonaCli(["plan", "--report-filled", "implementation"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writePendingReqBacklog(projectDir)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow finish failed: implement")
    expect(result.stderr).not.toContain("Summary:")
    expect(result.stderr).not.toContain("- closure blockers: 6")
    expect(result.stderr).not.toContain("- first blocker: verification-unknown")
    expect(result.stderr).not.toContain("- first next action: Run test/build/runtime verification through `npx ph bearshell`.")
    expect(result.stderr).toContain("Blocker: verification-unknown")
    expect(result.stderr).toContain("Next action: Run the project's supported test/build/runtime verification and record the outcome in workflow evidence.")
    expect(result.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
    expect(result.stderr).toContain("Other blockers:")
    expect(result.stderr).toContain("- review-report-missing")
    expect(result.stderr).toContain("- pending-ticket")
  })

  it("blocks implementation finish after final guard evidence passes without trusted authority", () => {
    const projectDir = createProfiledTempProject()
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew test'`\n",
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("blocks implementation finish when README exists but README range coverage is empty", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## Read Coverage",
        "- README read method: npx ph bearshell",
        "- README ranges read:",
        "- Plan read method: Read",
        "- Plan ranges read: 1-220",
        "- [x] `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(check.stdout).toContain("README.md exists but README ranges read is empty")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: report-coverage-missing")
    expect(finish.stderr).toContain("Next action: Read README, project-profile, and generated role context, then update workflow reports with actual coverage evidence.")
    expect(finish.stderr).toContain("- read-coverage-missing")
  })

  it("keeps README range coverage passing while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## Read Coverage",
        "- README read method: npx ph bearshell",
        "- README ranges read:",
        "  - 1-220",
        "- Plan read method: Read",
        "- Plan ranges read: 1-220",
        "- [x] `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(check.stdout).toContain("read coverage: README ranges observed")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("keeps heading-based README range coverage passing while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    writeFileSync(join(projectDir, "README.md"), "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "# Implementation Report",
        "",
        "Status: filled",
        "",
        "## README ranges read",
        "",
        "- 1-220",
        "",
        "## Final verification",
        "",
        "- `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(check.stdout).toContain("read coverage: README ranges observed")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("infers README read coverage while finish requires trusted authority", () => {
    const projectDir = createProfiledTempProject()
    const readmePath = join(projectDir, "README.md")
    writeFileSync(readmePath, "# Tool Rental API\n\n- 장비 등록\n")
    expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
    writeFileSync(
      join(projectDir, ".persona", "workflow", "implementation-report.md"),
      [
        "Status: filled",
        "## Read Coverage",
        "- README read method: npx ph bearshell",
        "- README ranges read:",
        "- Plan read method: Read",
        "- Plan ranges read: 1-220",
        "- [x] `npx ph bearshell --shell './gradlew test'`",
      ].join("\n"),
    )
    writeFileSync(
      join(projectDir, ".persona", "workflow", "review-report.md"),
      "Status: filled\n- [x] `npx ph bearshell --shell './gradlew bootRun'`\n",
    )
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(
      join(projectDir, ".persona", "evidence", "phase0", "2026-06-23T00-00-00-000Z-readme.md.json"),
      `${JSON.stringify({ targetFile: readmePath, fileRole: "project-bootstrap" }, null, 2)}\n`,
    )
    writeStructuredVerificationSuccessEvidence(projectDir)
    writeProfileReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(check.stdout).toContain("read coverage: README read evidence observed")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })
})
