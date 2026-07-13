import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { SPRING_BOOTJAR_ENABLED_CONVENTION } from "../src/config/convention-registry.js"

const tempProjects: string[] = []

function createProfiledProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-bootjar-convention-"))
  tempProjects.push(projectDir)
  expect(runPersonaCli(["intake", "--default", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  expect(runPersonaCli(["plan"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  expect(runPersonaCli(["plan", "--accept"], { cwd: projectDir, env: {}, invocationName: "ph" }).status).toBe(0)
  return projectDir
}

function writeBuild(projectDir: string, lines: readonly string[]): void {
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'task-api'\n")
  writeFileSync(join(projectDir, "build.gradle"), lines.join("\n"))
}

function writeExecutableSpringSource(projectDir: string): void {
  mkdirSync(join(projectDir, "src", "main", "java", "com", "example", "task"), { recursive: true })
  writeFileSync(
    join(projectDir, "src", "main", "java", "com", "example", "task", "TaskApplication.java"),
    "import org.springframework.boot.autoconfigure.SpringBootApplication;\n@SpringBootApplication\nclass TaskApplication {}\n",
  )
}

function writeReportsAndEvidence(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    "Status: filled\n- Project profile ranges read: all\n- Plan ranges read: all\n- `npx ph bearshell --shell './gradlew test'`\n- BUILD SUCCESSFUL\n",
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    "Status: filled\n- `npx ph bearshell --shell './gradlew build'`\n- BUILD SUCCESSFUL\n",
  )
  mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "evidence", "phase0", "workflow.json"),
    `${JSON.stringify(
      {
        command: "npx ph bearshell --shell './gradlew test'",
        status: 0,
        tool: "bearshell",
        toolOutput: [".persona/project-profile.jsonc", "src/main/java/com/example/task/TaskApplication.java", "BUILD SUCCESSFUL"].join("\n"),
      },
      null,
      2,
    )}\n`,
  )
}

function writePendingTicket(projectDir: string): void {
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

function writeConventionLevel(projectDir: string, level: "warn"): void {
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({ conventions: { [SPRING_BOOTJAR_ENABLED_CONVENTION.id]: level } }, null, 2)}\n`,
  )
}

function writeLibraryApplicationType(projectDir: string): void {
  const profilePath = join(projectDir, ".persona", "project-profile.jsonc")
  const profile = readFileSync(profilePath, "utf8").replace("\"answer\": \"rest-api\"", "\"answer\": \"library\"")
  writeFileSync(profilePath, profile)
}

function writeDisabledBootJar(projectDir: string): void {
  writeBuild(projectDir, [
    "plugins { id 'java'; id 'org.springframework.boot' version '3.5.0' }",
    "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }",
    "tasks.named('bootJar') {",
    "  enabled = false",
    "}",
  ])
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("Spring bootJar convention", () => {
  it("blocks closure when an executable Spring Boot app disables bootJar", () => {
    const projectDir = createProfiledProject()
    writeExecutableSpringSource(projectDir)
    writeDisabledBootJar(projectDir)
    writeReportsAndEvidence(projectDir)
    writePendingTicket(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const archive = runPersonaCli(["workflow", "archive", "req-1"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain(`${SPRING_BOOTJAR_ENABLED_CONVENTION.id} block`)
    expect(check.stdout).toContain("Executable Spring Boot app disables bootJar")
    expect(check.stdout).toContain("build.gradle:3")
    expect(check.stdout).toContain(SPRING_BOOTJAR_ENABLED_CONVENTION.fixPath)
    expect(closureJson.nextStep).toMatchObject({
      blockerId: SPRING_BOOTJAR_ENABLED_CONVENTION.blockerId,
      id: SPRING_BOOTJAR_ENABLED_CONVENTION.stepId,
      status: "blocked",
    })
    expect(finish.status).toBe(1)
    expect(archive.status).toBe(1)
  })

  it("warns without convention blocking while finish requires trusted authority", () => {
    const projectDir = createProfiledProject()
    writeConventionLevel(projectDir, "warn")
    writeExecutableSpringSource(projectDir)
    writeDisabledBootJar(projectDir)
    writeReportsAndEvidence(projectDir)

    const check = runPersonaCli(["workflow", "check"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const finish = runPersonaCli(["workflow", "finish", "implement"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const closureJson = JSON.parse(closure.stdout)

    expect(check.status).toBe(0)
    expect(check.stdout).toContain(`${SPRING_BOOTJAR_ENABLED_CONVENTION.id} warn`)
    expect(closureJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
      SPRING_BOOTJAR_ENABLED_CONVENTION.blockerId,
    )
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("Blocker: trusted-authority-required")
  })

  it("does not block on comments, strings, other tasks, or non-executable profiles", () => {
    const lookalikeProjectDir = createProfiledProject()
    writeExecutableSpringSource(lookalikeProjectDir)
    writeBuild(lookalikeProjectDir, [
      "plugins { id 'java'; id 'org.springframework.boot' version '3.5.0' }",
      "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }",
      "// bootJar { enabled = false }",
      "def note = \"bootJar { enabled = false }\"",
      "tasks.named('jar') { enabled = false }",
    ])
    writeReportsAndEvidence(lookalikeProjectDir)

    const libraryProjectDir = createProfiledProject()
    writeLibraryApplicationType(libraryProjectDir)
    writeExecutableSpringSource(libraryProjectDir)
    writeDisabledBootJar(libraryProjectDir)
    writeReportsAndEvidence(libraryProjectDir)

    const lookalikeClosure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: lookalikeProjectDir, env: {}, invocationName: "ph" })
    const libraryClosure = runPersonaCli(["workflow", "closure", "next", "--json"], { cwd: libraryProjectDir, env: {}, invocationName: "ph" })
    const lookalikeJson = JSON.parse(lookalikeClosure.stdout)
    const libraryJson = JSON.parse(libraryClosure.stdout)

    expect(lookalikeJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
      SPRING_BOOTJAR_ENABLED_CONVENTION.blockerId,
    )
    expect(libraryJson.state.blockers.map((blocker: { readonly id: string }) => blocker.id)).not.toContain(
      SPRING_BOOTJAR_ENABLED_CONVENTION.blockerId,
    )
  })
})
