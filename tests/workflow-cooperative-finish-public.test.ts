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

import { runPersonaCli } from "../src/cli/index.js"
import { writeCurrentWorkflowLifecycleLoopStates } from "./helpers/workflow-lifecycle-loop-state.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("public cooperative Finish", () => {
  it("passes only through the explicit current invocation while default and closure remain external", () => {
    // Given: a workflow-ready Java/Spring/Gradle project with diagnostic evidence only.
    const projectDir = createProject()

    // When: default, explicit cooperative, closure, and reused-report paths are invoked publicly.
    const defaultFinish = run(projectDir, ["workflow", "finish", "implement"])
    const cooperativeFinish = run(projectDir, ["workflow", "finish", "implement", "--assurance", "cooperative"])
    const closure = run(projectDir, ["workflow", "closure", "next", "--json"])
    const replay = run(projectDir, ["workflow", "finish", "implement", "--assurance", "cooperative"])

    // Then: only the same-invocation cooperative path passes.
    expect(defaultFinish.status).toBe(1)
    expect(defaultFinish.stderr).toContain("trusted-authority-required")
    expect(cooperativeFinish.status).toBe(0)
    expect(cooperativeFinish.stdout).toContain("Finish status: PASS")
    expect(cooperativeFinish.stdout).toContain("only in this CLI invocation")
    expect(JSON.parse(closure.stdout)).toMatchObject({
      state: { finish: "blocked" },
    })
    expect(closure.stdout).toContain("trusted-authority-required")
    expect(replay.status).toBe(1)
    expect(replay.stderr).toContain("junit-stale-report")
  })
})

function run(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph" })
}

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-cooperative-public-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "custom-evidence", "phase0"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Cooperative fixture\n")
  writeFileSync(
    join(projectDir, ".persona", "harness.jsonc"),
    `${JSON.stringify({
      enforce: { executeVerification: false },
      evidenceDir: ".persona/custom-evidence",
    })}\n`,
  )
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(profile())}\n`)
  writeFileSync(join(projectDir, ".persona", "workflow", "plan.md"), "Status: accepted\n")
  writeFileSync(
    join(projectDir, ".persona", "workflow", "implementation-report.md"),
    [
      "Status: filled",
      "- README ranges read: all",
      "- Project profile ranges read: all",
      "- `npx ph bearshell --shell './gradlew test'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "workflow", "review-report.md"),
    [
      "Status: filled",
      "- Manual QA reviewed the Java/Spring fixture.",
      "- `npx ph bearshell --shell './gradlew build'`",
    ].join("\n"),
  )
  writeFileSync(
    join(projectDir, ".persona", "custom-evidence", "phase0", "verification.json"),
    `${JSON.stringify({
      command: "npx ph bearshell --shell './gradlew test'",
      status: 0,
      tool: "bearshell",
      toolOutput: "BUILD SUCCESSFUL",
    })}\n`,
  )
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'cooperative-public'\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  writeFileSync(
    join(projectDir, "gradlew"),
    [
      "#!/bin/sh",
      "if printf '%s\\n' \"$*\" | grep -q cleanTest; then",
      "  mkdir -p build/test-results/test",
      "  printf '%s\\n' '<testsuite tests=\"1\" failures=\"0\" errors=\"0\" skipped=\"0\"><testcase name=\"works\"/></testsuite>' > build/test-results/test/TEST-example.xml",
      "  printf '%s\\n' '> Task :cleanTest' '> Task :test' 'BUILD SUCCESSFUL'",
      "else",
      "  printf '%s\\n' '> Task :test UP-TO-DATE' '> Task :build' 'BUILD SUCCESSFUL'",
      "fi",
    ].join("\n") + "\n",
  )
  chmodSync(join(projectDir, "gradlew"), 0o755)
  writeCurrentWorkflowLifecycleLoopStates(projectDir)
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: projectDir })
  return projectDir
}

function profile(): Readonly<Record<string, unknown>> {
  return {
    defaults: { buildTool: "gradle", framework: "spring", language: "java" },
    questions: [
      { answer: "ko", id: "user-language" },
      { answer: "team", id: "project-context" },
      { answer: "production-service", id: "project-goal" },
      { answer: "long-lived", id: "project-scale" },
      { answer: "rest-api", id: "application-type" },
      { answer: "memory", id: "storage" },
      { answer: "none", id: "persistence-technology" },
      { answer: "none", id: "migration-style" },
      { answer: "domain-first", id: "package-style" },
      { answer: "clean-architecture-light", id: "architecture-style" },
      { answer: "strict", id: "boundary-strictness" },
    ],
    schema: "persona.project-profile.v1",
    scope: { mvp: "java-spring-clean-code", role: "backend" },
    status: "ready",
  }
}
