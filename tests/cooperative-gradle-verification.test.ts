import { execFileSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { prepareCooperativeFinishContext } from "../src/cli/cooperative-finish-context.js"
import {
  runCooperativeGradleVerification,
} from "../src/cli/cooperative-gradle-verification.js"
import type { BoundedProcessResult } from "../src/cli/bounded-process.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("cooperative Gradle verification", () => {
  it("runs only the fixed test and build argv and accepts unchanged dirty source", () => {
    // Given: a Git-backed Java/Spring/Gradle project with an unchanged dirty file.
    const projectDir = createProject()
    writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App { int dirty; }\n")
    const context = readyContext(projectDir)
    const calls: { readonly args: readonly string[]; readonly command: string }[] = []

    // When: the cooperative verifier runs both fixed commands.
    const result = runCooperativeGradleVerification(projectDir, context, {
      now: () => 0,
      runProcess: (options) => {
        calls.push({ args: options.args, command: options.command })
        if (options.args.includes("test")) writeReport(projectDir, "fresh")
        return passed(options.args.includes("test")
          ? "> Task :cleanTest\n> Task :test\nBUILD SUCCESSFUL\n"
          : "> Task :test UP-TO-DATE\n> Task :build\nBUILD SUCCESSFUL\n")
      },
    })

    // Then: exact argv, semantic JUnit, and dirty source binding all pass.
    expect(calls).toEqual([
      {
        args: ["--no-daemon", "--no-build-cache", "cleanTest", "test", "--console=plain"],
        command: "./gradlew",
      },
      {
        args: ["--no-daemon", "--no-build-cache", "build", "--console=plain"],
        command: "./gradlew",
      },
    ])
    expect(result).toMatchObject({ kind: "passed", value: { testCount: 1 } })
  })

  it.each([
    ["stale JUnit", (projectDir: string) => undefined, "junit-stale-report"],
    ["compile failure", (_projectDir: string) => passed("> Task :cleanTest\n> Task :test\nBUILD FAILED\n", 1), "test-command-failed"],
    ["timeout", (_projectDir: string) => timedOut(), "test-timeout"],
    ["source drift", (projectDir: string) => {
      writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App { int drift; }\n")
      return undefined
    }, "source-identity-drift"],
  ])("blocks %s", (_name, behavior, code) => {
    // Given: a project whose command or source ownership condition is invalid.
    const projectDir = createProject("stale JUnit")
    const context = readyContext(projectDir)
    let command = 0

    // When: the fixed verification is attempted.
    const result = runCooperativeGradleVerification(projectDir, context, {
      now: () => 0,
      runProcess: (options) => {
        command += 1
        const outcome = behavior(projectDir)
        if (outcome !== undefined) return outcome
        if (options.args.includes("test")) {
          if (_name !== "stale JUnit") writeReport(projectDir, "fresh")
          return passed("> Task :cleanTest\n> Task :test\nBUILD SUCCESSFUL\n")
        }
        return passed("> Task :build\nBUILD SUCCESSFUL\n")
      },
    })

    // Then: no failing condition can produce cooperative facts.
    expect(result).toEqual({ code, kind: "blocked" })
    expect(command).toBeGreaterThan(0)
  })

  it("rejects a reported nonexecution outcome", () => {
    // Given: a test command that claims success but leaves test UP-TO-DATE.
    const projectDir = createProject()
    const context = readyContext(projectDir)

    // When: cooperative verification observes the fixed test output.
    const result = runCooperativeGradleVerification(projectDir, context, {
      now: () => 0,
      runProcess: () => passed("> Task :cleanTest\n> Task :test UP-TO-DATE\nBUILD SUCCESSFUL\n"),
    })

    // Then: the nonexecuted test task blocks before JUnit can be trusted.
    expect(result).toEqual({ code: "test-task-nonfresh", kind: "blocked" })
  })
})

function createProject(initialReport?: "stale JUnit"): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-cooperative-gradle-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), "{}\n")
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(readyProfile())}\n`)
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "gradlew"), "#!/bin/sh\nexit 0\n")
  chmodSync(join(projectDir, "gradlew"), 0o755)
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  if (initialReport !== undefined) writeReport(projectDir, "stale")
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: projectDir })
  return projectDir
}

function readyContext(projectDir: string) {
  const result = prepareCooperativeFinishContext(projectDir)
  if (result.kind !== "ready") throw new Error(`expected ready context, received ${result.code}`)
  return result.value
}

function writeReport(projectDir: string, name: string): void {
  const root = join(projectDir, "build", "test-results", "test")
  mkdirSync(root, { recursive: true })
  writeFileSync(
    join(root, "TEST-example.xml"),
    `<testsuite tests="1" failures="0" errors="0" skipped="0"><testcase name="${name}"/></testsuite>`,
  )
}

function passed(stdout: string, status = 0): BoundedProcessResult {
  return {
    killed: false,
    outcome: status === 0 ? "passed" : "failed",
    outputLimited: false,
    signal: null,
    status,
    stderr: "",
    stdout,
    timedOut: false,
  }
}

function timedOut(): BoundedProcessResult {
  return {
    killed: false,
    outcome: "timeout",
    outputLimited: false,
    signal: null,
    status: 1,
    stderr: "",
    stdout: "",
    timedOut: true,
  }
}

function readyProfile(): Readonly<Record<string, unknown>> {
  return {
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    questions: [
      { answer: "ko", id: "user-language" },
      { answer: "team", id: "project-context" },
      { answer: "production-service", id: "project-goal" },
      { answer: "long-lived", id: "project-scale" },
      { answer: "rest-api", id: "application-type" },
      { answer: "database", id: "storage" },
      { answer: "jpa", id: "persistence-technology" },
      { answer: "flyway", id: "migration-style" },
      { answer: "domain-first", id: "package-style" },
      { answer: "clean-architecture-light", id: "architecture-style" },
      { answer: "strict", id: "boundary-strictness" },
    ],
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }
}
