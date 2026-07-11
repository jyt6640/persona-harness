#!/usr/bin/env node
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import process from "node:process"
import { spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

class SmokeAssertionError extends Error {
  constructor(message, commandResult) {
    super(message)
    this.name = "SmokeAssertionError"
    this.commandResult = commandResult
  }
}

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const cliPath = join(repoRoot, "dist", "cli", "index.js")

if (!existsSync(cliPath)) {
  throw new SmokeAssertionError("Built CLI not found. Run `npm run build` before product MVP smoke.", undefined)
}

const tempRoot = mkdtempSync(join(tmpdir(), "persona-product-mvp-smoke-"))
const results = []

function runCli(cwd, args) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd,
    encoding: "utf8",
    env: { ...process.env },
  })
  return {
    args,
    command: `ph ${args.join(" ")}`,
    cwd,
    status: result.status ?? 1,
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function assertCommand(result, expectedStatus, label) {
  if (result.status !== expectedStatus) {
    throw new SmokeAssertionError(`${label}: expected exit ${expectedStatus}, got ${result.status}`, result)
  }
  results.push({ label, command: result.command, status: result.status })
  return result
}

function assertIncludes(text, expected, label, result) {
  if (!text.includes(expected)) {
    throw new SmokeAssertionError(`${label}: missing ${JSON.stringify(expected)}`, result)
  }
}

function assertNotIncludes(text, rejected, label, result) {
  if (text.includes(rejected)) {
    throw new SmokeAssertionError(`${label}: unexpectedly included ${JSON.stringify(rejected)}`, result)
  }
}

function assertDoctorRuntimeReadiness(stdout, result) {
  if (stdout.includes("Runtime readiness: PASS")) return
  if (stdout.includes("Runtime readiness: WARN") && stdout.includes("OpenCode CLI is missing")) return
  throw new SmokeAssertionError("doctor readiness: missing acceptable runtime readiness", result)
}

function projectDir(name) {
  const dir = join(tempRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function writeStepReadme(dir) {
  writeFileSync(
    join(dir, "README.md"),
    [
      "# Calendar API",
      "",
      "## Step 1. Basic events",
      "",
      "- Create calendar events.",
      "",
      "## Step 2. Sharing",
      "",
      "- Share a calendar by link.",
    ].join("\n"),
  )
}

function writeSpringishProject(dir) {
  writeFileSync(join(dir, "README.md"), "# Book API\n\nBuild a Spring Boot style book API.\n")
  writeFileSync(join(dir, "settings.gradle"), "rootProject.name = 'book-api'\n")
  writeFileSync(
    join(dir, "build.gradle"),
    [
      "plugins { id 'java'; id 'org.springframework.boot' version '3.5.0' }",
      "dependencies {",
      "  implementation 'org.springframework.boot:spring-boot-starter-web'",
      "  implementation 'org.springframework.boot:spring-boot-starter-data-jpa'",
      "  runtimeOnly 'com.h2database:h2'",
      "  implementation 'org.flywaydb:flyway-core'",
      "}",
    ].join("\n"),
  )
  writeFileSync(join(dir, "gradlew"), "#!/bin/sh\nexit 0\n")
  chmodSync(join(dir, "gradlew"), 0o755)

  const javaRoot = join(dir, "src", "main", "java", "com", "example")
  for (const relativeDir of [
    "presentation/dto/request",
    "presentation/dto/response",
    "application",
    "domain",
    "infrastructure",
    "global/exception",
  ]) {
    mkdirSync(join(javaRoot, relativeDir), { recursive: true })
  }
  mkdirSync(join(dir, "src", "main", "resources", "db", "migration"), { recursive: true })
  writeFileSync(
    join(javaRoot, "presentation", "BookController.java"),
    "package com.example.presentation; import org.springframework.web.bind.annotation.RestController; @RestController class BookController { private final com.example.application.BookService service; BookController(com.example.application.BookService service) { this.service = service; } }\n",
  )
  writeFileSync(
    join(javaRoot, "application", "BookService.java"),
    "package com.example.application; class BookService { private final com.example.domain.BookRepository repository; BookService(com.example.domain.BookRepository repository) { this.repository = repository; } }\n",
  )
  writeFileSync(join(javaRoot, "domain", "Book.java"), "package com.example.domain; class Book {}\n")
  writeFileSync(join(javaRoot, "domain", "BookRepository.java"), "package com.example.domain; interface BookRepository {}\n")
  writeFileSync(
    join(javaRoot, "infrastructure", "JpaBookRepository.java"),
    "package com.example.infrastructure; class JpaBookRepository implements com.example.domain.BookRepository {}\n",
  )
  writeFileSync(
    join(javaRoot, "presentation", "dto", "request", "CreateBookRequest.java"),
    "package com.example.presentation.dto.request; record CreateBookRequest(String title) {}\n",
  )
  writeFileSync(
    join(javaRoot, "presentation", "dto", "response", "BookResponse.java"),
    "package com.example.presentation.dto.response; record BookResponse(String title) {}\n",
  )
  writeFileSync(
    join(javaRoot, "global", "exception", "BookNotFoundException.java"),
    "package com.example.global.exception; class BookNotFoundException extends RuntimeException {}\n",
  )
  writeFileSync(join(dir, "src", "main", "resources", "db", "migration", "V1__init.sql"), "create table book(id bigint primary key);\n")
}

function writeEvidence(dir, relativePath, fileRole) {
  const fileName = relativePath.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()
  writeFileSync(
    join(dir, ".persona", "evidence", "phase0", `${fileName}.json`),
    `${JSON.stringify({ injectedInto: "model-input", targetFile: relativePath, fileRole }, null, 2)}\n`,
  )
}

function writeWorkflowPassEvidence(dir) {
  writeFileSync(
    join(dir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: 1-220",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
      "- `npx ph bearshell --shell './gradlew build'`",
    ].join("\n"),
  )
  writeFileSync(join(dir, ".persona", "workflow", "review-report.md"), "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n")
  mkdirSync(join(dir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(dir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({ command: "npx ph bearshell --shell './gradlew test'", status: 0, tool: "bearshell", toolOutput: "BUILD SUCCESSFUL" }, null, 2)}\n`,
  )
  writeFileSync(
    join(dir, ".persona", "evidence", "phase0", "project-profile.json"),
    `${JSON.stringify({ targetFile: join(dir, ".persona", "project-profile.jsonc"), fileRole: "project-profile" }, null, 2)}\n`,
  )
  writeEvidence(dir, "src/main/java/com/example/presentation/BookController.java", "controller")
  writeEvidence(dir, "src/main/java/com/example/application/BookService.java", "service")
  writeEvidence(dir, "src/main/java/com/example/domain/Book.java", "domain")
  writeEvidence(dir, "src/main/java/com/example/domain/BookRepository.java", "repository")
  writeEvidence(dir, "src/main/java/com/example/infrastructure/JpaBookRepository.java", "repository")
  writeEvidence(dir, "src/main/java/com/example/presentation/dto/request/CreateBookRequest.java", "request-dto")
  writeEvidence(dir, "src/main/java/com/example/presentation/dto/response/BookResponse.java", "response-dto")
  writeEvidence(dir, "src/main/java/com/example/global/exception/BookNotFoundException.java", "exception")
}

function assertObserveReport(stdout, result) {
  const report = JSON.parse(stdout)
  if (typeof report !== "object" || report === null || !Array.isArray(report.findings)) {
    throw new SmokeAssertionError("observe --json did not return a report with findings array", result)
  }
  if (!Array.isArray(report.limitations) || !report.limitations.some((entry) => `${entry}`.includes("not generated app quality certification"))) {
    throw new SmokeAssertionError("observe --json did not expose report-only limitation", result)
  }
  const finding = report.findings.find((entry) => typeof entry === "object" && entry !== null)
  if (finding === undefined || typeof finding.ruleId !== "string" || typeof finding.result !== "string" || typeof finding.confidence !== "string") {
    throw new SmokeAssertionError("observe --json finding schema is incomplete", result)
  }
}

try {
  const initDir = projectDir("init-doctor-observe")
  writeSpringishProject(initDir)
  assertCommand(runCli(initDir, ["init"]), 0, "clean workspace ph init")
  const inertDoctor = assertCommand(runCli(initDir, ["doctor"]), 1, "ph doctor attached-but-inert block")
  assertIncludes(inertDoctor.stdout, "Session reachability: BLOCK", "doctor inert reachability", inertDoctor)
  assertIncludes(inertDoctor.stdout, "Next command: npx ph bootstrap backend", "doctor inert remediation", inertDoctor)
  assertCommand(
    runCli(initDir, ["bootstrap", "backend", "--no-developer-mcp"]),
    0,
    "ph bootstrap backend reachability",
  )
  const doctor = assertCommand(runCli(initDir, ["doctor"]), 0, "ph doctor readiness")
  assertDoctorRuntimeReadiness(doctor.stdout, doctor)
  assertIncludes(doctor.stdout, "Session reachability: WARN", "doctor reachable warning", doctor)
  assertIncludes(doctor.stdout, "AGENTS.md steering: legacy observed", "doctor legacy steering", doctor)
  const observe = assertCommand(runCli(initDir, ["observe", "--json", "src/main/java"]), 0, "ph observe --json schema")
  assertObserveReport(observe.stdout, observe)

  const passDir = projectDir("workflow-pass")
  writeSpringishProject(passDir)
  assertCommand(runCli(passDir, ["intake", "--default", "backend"]), 0, "workflow pass intake")
  assertCommand(runCli(passDir, ["plan"]), 0, "workflow pass plan")
  assertCommand(runCli(passDir, ["plan", "--accept"]), 0, "workflow pass accept")
  writeWorkflowPassEvidence(passDir)
  assertCommand(runCli(passDir, ["workflow", "continue"]), 0, "workflow pass continue")
  const passCheck = assertCommand(runCli(passDir, ["workflow", "check"]), 0, "workflow pass check")
  assertIncludes(passCheck.stdout, "Workflow status: PASS", "workflow check PASS", passCheck)
  const passFinish = assertCommand(runCli(passDir, ["workflow", "finish", "implement"]), 0, "workflow pass finish")
  assertIncludes(passFinish.stdout, "Finish status: PASS", "workflow finish PASS", passFinish)

  const blockedDir = projectDir("workflow-blocked")
  writeSpringishProject(blockedDir)
  assertCommand(runCli(blockedDir, ["intake", "--default", "backend"]), 0, "workflow blocked intake")
  assertCommand(runCli(blockedDir, ["plan"]), 0, "workflow blocked plan")
  assertCommand(runCli(blockedDir, ["plan", "--accept"]), 0, "workflow blocked accept")
  const blockedContinue = assertCommand(runCli(blockedDir, ["workflow", "continue"]), 0, "workflow blocked continue")
  assertIncludes(blockedContinue.stdout, "No filled continuation evidence found.", "blocked continue next action", blockedContinue)
  assertIncludes(blockedContinue.stdout, "npx ph workflow implement", "blocked continue implement guidance", blockedContinue)
  assertNotIncludes(blockedContinue.stdout, "Finish status: PASS", "blocked continue completion claim", blockedContinue)
  const blockedCheck = assertCommand(runCli(blockedDir, ["workflow", "check"]), 0, "workflow blocked check")
  assertIncludes(blockedCheck.stdout, "Workflow status: WARN", "blocked check WARN", blockedCheck)
  assertIncludes(blockedCheck.stdout, "Next:", "blocked check next action", blockedCheck)
  assertNotIncludes(blockedCheck.stdout, "Workflow status: PASS", "blocked check completion claim", blockedCheck)
  const blockedFinish = assertCommand(runCli(blockedDir, ["workflow", "finish", "implement"]), 1, "workflow blocked finish")
  assertIncludes(blockedFinish.stderr, "Workflow finish failed: implement", "blocked finish failure", blockedFinish)
  assertIncludes(blockedFinish.stderr, "Next action: Run the project's supported test/build/runtime verification and record the outcome in workflow evidence.", "blocked finish next action", blockedFinish)
  assertIncludes(blockedFinish.stderr, "Next command: after completing the action, run npx ph workflow check", "blocked finish next command", blockedFinish)
  if ((blockedFinish.stderr.match(/^Next action:/gmu) ?? []).length !== 1 || (blockedFinish.stderr.match(/^Next command:/gmu) ?? []).length !== 1) {
    throw new SmokeAssertionError("blocked finish must render exactly one next action and next command", blockedFinish)
  }
  assertNotIncludes(blockedFinish.stdout, "Finish status: PASS", "blocked finish completion claim", blockedFinish)

  const ticketDir = projectDir("workflow-next-ticket")
  writeStepReadme(ticketDir)
  assertCommand(runCli(ticketDir, ["init"]), 0, "workflow next init")
  const split = assertCommand(runCli(ticketDir, ["workflow", "split", "README.md"]), 0, "workflow next split")
  assertIncludes(split.stdout, "Workflow split complete", "workflow split", split)
  const next = assertCommand(runCli(ticketDir, ["workflow", "next"]), 0, "workflow next pending ticket")
  assertIncludes(next.stdout, "Persona Workflow Next Ticket", "workflow next title", next)
  assertIncludes(next.stdout, "Ticket: step-1", "workflow next ticket", next)
  assertIncludes(next.stdout, "Implement only this ticket", "workflow next scope guard", next)

  console.log("Product MVP smoke: PASS")
  console.log(`Scope: no-token CLI/runtime product smoke; not eval evidence and not generated app quality certification.`)
  console.table(results)
  rmSync(tempRoot, { recursive: true, force: true })
} catch (error) {
  if (error instanceof SmokeAssertionError) {
    console.error(`Product MVP smoke: FAIL - ${error.message}`)
    if (error.commandResult !== undefined) {
      console.error(JSON.stringify(error.commandResult, null, 2))
    }
    console.error(`Temp root preserved for debugging: ${tempRoot}`)
    process.exitCode = 1
  } else if (error instanceof Error) {
    console.error(`Product MVP smoke: FAIL - ${error.message}`)
    console.error(`Temp root preserved for debugging: ${tempRoot}`)
    process.exitCode = 1
  } else {
    throw error
  }
}
