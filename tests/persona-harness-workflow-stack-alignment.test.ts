import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-workflow-stack-test-"))
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
  writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "sample.json"), "{}\n")
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "2026-06-24T00-00-00-000Z-project-profile.jsonc.json"),
    `${JSON.stringify({ targetFile: join(projectDir, ".persona", "project-profile.jsonc"), fileRole: "project-profile" }, null, 2)}\n`,
  )
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph workflow check stack alignment", () => {
  it("warns when a Java Spring Gradle JPA database profile is implemented as fake HttpServer Gradle", () => {
    const projectDir = createTempProject()
    writeReadyJpaProfile(projectDir)
    writeWorkflowEvidence(projectDir)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'fake-http-server'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
    writeFileSync(join(projectDir, "gradle-shim.js"), "console.log('fake gradle build')\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "package com.example;\nimport com.sun.net.httpserver.HttpServer;\nclass Application { HttpServer server; }\n")

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: WARN")
    expect(result.stdout).toContain("stack alignment: STACK_MISMATCH")
    expect(result.stdout).toContain("profile/generated stack mismatch")
    expect(result.stdout).toContain("fake Gradle shim observed")
    expect(result.stdout).toContain("missing Spring Boot plugin/dependency")
    expect(result.stdout).toContain("missing JPA dependency")
    expect(result.stdout).toContain("missing DB dependency")
    expect(result.stdout).toContain("missing Flyway migration")
    expect(result.stdout).toContain("Next: review profile/generated stack mismatch before archiving workflow")
  })

  it("blocks workflow finish when profile/generated stack mismatch remains", () => {
    const projectDir = createTempProject()
    writeReadyJpaProfile(projectDir)
    writeWorkflowEvidence(projectDir)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'fake-http-server'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
    writeFileSync(join(projectDir, "gradle-shim.js"), "console.log('fake gradle build')\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "package com.example;\nimport com.sun.net.httpserver.HttpServer;\nclass Application { HttpServer server; }\n")

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Workflow finish failed: implement")
    expect(result.stderr).toContain("Project profile and generated stack mismatch")
    expect(result.stderr).toContain("STACK_MISMATCH")
    expect(result.stderr).toContain("This is a workflow/profile alignment gate, not generated app product-quality certification.")
    expect(result.stderr).toContain("Re-read `.persona/project-profile.jsonc`.")
    expect(result.stderr).toContain("Change the generated project to Spring Boot/Gradle/JPA/database structure.")
    expect(result.stderr).toContain("Remove fake `gradle-shim.js`/Node shim files.")
    expect(result.stderr).toContain("Re-run `npx ph workflow check`.")
  })

  it("keeps pending ticket guidance when stack mismatch and pending tickets both remain", () => {
    const projectDir = createTempProject()
    writeReadyJpaProfile(projectDir)
    writeWorkflowEvidence(projectDir)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'fake-http-server'\n")
    writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
    writeFileSync(join(projectDir, "gradle-shim.js"), "console.log('fake gradle build')\n")
    mkdirSync(join(projectDir, "src", "main", "java", "com", "example"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "package com.example;\nimport com.sun.net.httpserver.HttpServer;\nclass Application { HttpServer server; }\n")
    writeFileSync(
      join(projectDir, ".persona", "workflow", "backlog.md"),
      [
        "# Persona Workflow Backlog",
        "",
        "Status: active",
        "",
        "| Order | Ticket | Title | Status | Path |",
        "| --- | --- | --- | --- | --- |",
        "| 1 | req-1 | First request | pending | .persona/workflow/work/req-1/00-task-card.md |",
      ].join("\n"),
    )

    const result = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(1)
    expect(result.stderr).toContain("Project profile and generated stack mismatch")
    expect(result.stderr).toContain("Pending workflow tickets remain: req-1")
    expect(result.stderr).toContain("Run `npx ph workflow next`")
  })

  it("passes stack alignment for a minimal Spring Boot Gradle JPA database project", () => {
    const projectDir = createTempProject()
    writeReadyJpaProfile(projectDir)
    writeWorkflowEvidence(projectDir)
    writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'spring-jpa'\n")
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
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "Application.java"), "package com.example;\nimport org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass Application {}\n")
    writeFileSync(join(projectDir, "src", "main", "java", "com", "example", "SampleController.java"), "package com.example;\nimport org.springframework.web.bind.annotation.RestController;\n@RestController\nclass SampleController {}\n")
    mkdirSync(join(projectDir, "src", "main", "resources", "db", "migration"), { recursive: true })
    writeFileSync(join(projectDir, "src", "main", "resources", "db", "migration", "V1__init.sql"), "create table sample(id bigint primary key);\n")

    const result = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Workflow status: PASS")
    expect(result.stdout).toContain("stack alignment: profile expects Java/Spring/Gradle/JPA/database and generated project has Spring Boot + Gradle + JPA/database evidence")

    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    expect(finish.status).toBe(0)
    expect(finish.stdout).toContain("Finish status: PASS")
  })
})
