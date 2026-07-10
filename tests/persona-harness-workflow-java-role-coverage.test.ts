import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-java-role-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeReadyJpaProfile(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "project-profile.jsonc"),
    `${JSON.stringify(
      {
        schema: "persona.project-profile.v1",
        status: "ready",
        scope: { role: "backend", mvp: "java-spring-clean-code", productized: false },
        defaults: { language: "java", framework: "spring", buildTool: "gradle", testPolicy: "deferred" },
        questions: [
          { id: "user-language", prompt: "language", choices: [], answer: "ko" },
          { id: "project-context", prompt: "context", choices: [], answer: "solo" },
          { id: "project-goal", prompt: "goal", choices: [], answer: "production-service" },
          { id: "project-scale", prompt: "scale", choices: [], answer: "small" },
          { id: "application-type", prompt: "application", choices: [], answer: "rest-api" },
          { id: "storage", prompt: "storage", choices: [], answer: "database" },
          { id: "persistence-technology", prompt: "persistence", choices: [], answer: "jpa" },
          { id: "migration-style", prompt: "migration", choices: [], answer: "flyway" },
          { id: "package-style", prompt: "package", choices: [], answer: "domain-first" },
          { id: "architecture-style", prompt: "architecture", choices: [], answer: "clean-architecture-light" },
          { id: "boundary-strictness", prompt: "boundary", choices: [], answer: "strict" },
        ],
        notes: { project: "" },
      },
      null,
      2,
    )}\n`,
  )
}

function writeWorkflowEvidence(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    "Status: filled\n- README ranges read: 1-220\n- Project profile ranges read: all\n- `npx ph bearshell --shell './gradlew test'`\n",
  )
  writeFileSync(join(projectDir, ".persona", "workflow", "review-report.md"), "Status: filled\n- `npx ph bearshell --shell './gradlew bootRun'`\n")
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "verification.json"),
    `${JSON.stringify({ command: "npx ph bearshell --shell './gradlew test'", status: 0, tool: "bearshell", toolOutput: "BUILD SUCCESSFUL" }, null, 2)}\n`,
  )
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "project-profile.json"),
    `${JSON.stringify({ targetFile: join(projectDir, ".persona", "project-profile.jsonc"), fileRole: "project-profile" }, null, 2)}\n`,
  )
}

function writeSpringJpaProject(projectDir: string): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'spring-role-coverage'\n")
  writeFileSync(
    join(projectDir, "build.gradle"),
    [
      "plugins { id 'org.springframework.boot' version '3.5.0' }",
      "dependencies {",
      "  implementation 'org.springframework.boot:spring-boot-starter-web'",
      "  implementation 'org.springframework.boot:spring-boot-starter-data-jpa'",
      "  runtimeOnly 'com.h2database:h2'",
      "  implementation 'org.flywaydb:flyway-core'",
      "}",
    ].join("\n"),
  )
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nexit 0\n")
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "Application.java"),
    "package com.example;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass Application {}\n",
  )
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "presentation", "dto", "request"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "presentation", "dto", "response"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "application"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "domain"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "infrastructure"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "global", "exception"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "presentation", "BookController.java"),
    "package com.example.presentation;\nimport org.springframework.web.bind.annotation.RestController;\n@RestController\nclass BookController {}\n",
  )
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "application", "BookService.java"), "package com.example.application;\nclass BookService {}\n")
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "domain", "Book.java"), "package com.example.domain;\nclass Book {}\n")
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "domain", "BookRepository.java"), "package com.example.domain;\ninterface BookRepository {}\n")
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "infrastructure", "JpaBookRepository.java"), "package com.example.infrastructure;\nclass JpaBookRepository implements com.example.domain.BookRepository {}\n")
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "presentation", "dto", "request", "CreateBookRequest.java"),
    "package com.example.presentation.dto.request;\nrecord CreateBookRequest(String title) {}\n",
  )
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "presentation", "dto", "response", "BookResponse.java"),
    "package com.example.presentation.dto.response;\nrecord BookResponse(String title) {}\n",
  )
  writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "global", "exception", "BookNotFoundException.java"), "package com.example.global.exception;\nclass BookNotFoundException extends RuntimeException {}\n")
  mkdirSync(join(projectDir, "src", "main", "resources", "db", "migration"), { recursive: true })
  writeFileSync(join(projectDir, "src", "main", "resources", "db", "migration", "V1__init.sql"), "create table book(id bigint primary key);\n")
}

function writeJavaRoleReadEvidence(projectDir: string, relativePath: string, fileRole: string): void {
  const fileName = relativePath.replace(/[^a-zA-Z0-9._-]+/g, "-").toLowerCase()
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", `${fileName}.json`),
    `${JSON.stringify({ injectedInto: "model-input", targetFile: relativePath, fileRole }, null, 2)}\n`,
  )
}

function writeSufficientJavaRoleReadEvidence(projectDir: string): void {
  writeJavaRoleReadEvidence(projectDir, "src/main/java/com/example/presentation/BookController.java", "controller")
  writeJavaRoleReadEvidence(projectDir, "src/main/java/com/example/application/BookService.java", "service")
  writeJavaRoleReadEvidence(projectDir, "src/main/java/com/example/domain/Book.java", "domain")
  writeJavaRoleReadEvidence(projectDir, "src/main/java/com/example/domain/BookRepository.java", "repository")
  writeJavaRoleReadEvidence(projectDir, "src/main/java/com/example/infrastructure/JpaBookRepository.java", "repository")
  writeJavaRoleReadEvidence(projectDir, "src/main/java/com/example/presentation/dto/request/CreateBookRequest.java", "request-dto")
  writeJavaRoleReadEvidence(projectDir, "src/main/java/com/example/presentation/dto/response/BookResponse.java", "response-dto")
  writeJavaRoleReadEvidence(projectDir, "src/main/java/com/example/global/exception/BookNotFoundException.java", "exception")
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow Java role read coverage", () => {
  it("warns and blocks finish when generated Java role files have no read evidence", () => {
    const projectDir = createTempProject()
    writeReadyJpaProfile(projectDir)
    writeWorkflowEvidence(projectDir)
    writeSpringJpaProject(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: WARN")
    expect(check.stdout).toContain("java role read coverage: WARN")
    expect(check.stdout).toContain("workflow evidence/read coverage missing")
    expect(check.stdout).toContain("controller/presentation: src/main/java/com/example/presentation/BookController.java")
    expect(check.stdout).toContain("service/application: src/main/java/com/example/application/BookService.java")
    expect(check.stdout).toContain("repository/domain port: src/main/java/com/example/domain/BookRepository.java")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Workflow finish failed: implement")
    expect(finish.stderr).toContain("Blocker: report-coverage-missing")
    expect(finish.stderr).toContain("Next command: after completing the action, run npx ph workflow check")
    expect(finish.stderr).toContain("Other blockers:\n- java-role-read-coverage-missing")
  })

  it("keeps check and finish passing when Java role read evidence is sufficient", () => {
    const projectDir = createTempProject()
    writeReadyJpaProfile(projectDir)
    writeWorkflowEvidence(projectDir)
    writeSpringJpaProject(projectDir)
    writeSufficientJavaRoleReadEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(check.status).toBe(0)
    expect(check.stdout).toContain("Workflow status: PASS")
    expect(check.stdout).toContain("java role read coverage: generated Java role files have role read evidence")
    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
  })
})
