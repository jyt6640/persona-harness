import { execFileSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { createDirectProjectRoot } from "./helpers/direct-project-root.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("public cooperative Finish", () => {
  it("creates the required lifecycle through public commands before explicit cooperative Finish", () => {
    const projectDir = createProject()
    const bootstrap = run(projectDir, ["bootstrap", "backend", "--strict"])
    const testEvidence = run(projectDir, ["bearshell", "./gradlew", "test"])
    const cleanEvidence = run(projectDir, ["bearshell", "./gradlew", "clean"])
    const implementation = run(
      projectDir,
      ["plan", "--report-filled", "implementation", "--stdin"],
      implementationReport(),
    )
    const review = run(
      projectDir,
      ["plan", "--report-filled", "review", "--stdin"],
      reviewReport(),
    )

    expect(bootstrap.status).toBe(0)
    expect(existsSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"))).toBe(true)
    expect(existsSync(join(projectDir, ".persona", "workflow", "ralph-loop-state.json"))).toBe(true)
    expect(testEvidence.status).toBe(0)
    expect(cleanEvidence.status).toBe(0)
    expect(implementation.status).toBe(0)
    expect(review.status).toBe(0)

    const defaultFinish = run(projectDir, ["workflow", "finish", "implement"])
    const cooperativeFinish = run(projectDir, ["workflow", "finish", "implement", "--assurance", "cooperative"])
    const closure = run(projectDir, ["workflow", "closure", "next", "--json"])
    const replay = run(projectDir, ["workflow", "finish", "implement", "--assurance", "cooperative"])
    rmSync(join(projectDir, ".persona", "workflow", "workflow-loop-state.json"))
    const missingLoop = run(projectDir, ["workflow", "closure", "next", "--json"])

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
    expect(missingLoop.status).toBe(0)
    expect(missingLoop.stdout).toContain("workflow-loop-state-absent")
  })

  it("preserves malformed lifecycle state as a bounded blocker during bootstrap", () => {
    const projectDir = createProject()
    expect(run(projectDir, ["bootstrap", "backend", "--strict"]).status).toBe(0)
    const workflowStatePath = join(projectDir, ".persona", "workflow", "workflow-loop-state.json")
    writeFileSync(workflowStatePath, "{ malformed\n")

    const rerun = run(projectDir, ["bootstrap", "backend", "--strict"])
    const closure = run(projectDir, ["workflow", "closure", "next", "--json"])

    expect(rerun.status).toBe(0)
    expect(closure.status).toBe(0)
    expect(closure.stdout).toContain("workflow-loop-state-malformed")
    expect(existsSync(workflowStatePath)).toBe(true)
  })

  it("keeps an unsafe loop-state path blocked across bootstrap, closure, and Finish", () => {
    const projectDir = createProject()
    expect(run(projectDir, ["bootstrap", "backend", "--strict"]).status).toBe(0)
    const workflowStatePath = join(projectDir, ".persona", "workflow", "workflow-loop-state.json")
    const outside = join(projectDir, "outside-workflow-loop-state.json")
    unlinkSync(workflowStatePath)
    symlinkSync(outside, workflowStatePath)

    const bootstrap = run(projectDir, ["bootstrap", "backend", "--strict"])
    const status = run(projectDir, ["workflow", "closure", "status", "--json"])
    const next = run(projectDir, ["workflow", "closure", "next", "--json"])
    const finish = run(projectDir, ["workflow", "finish", "implement"])

    expect(bootstrap.status).toBe(1)
    expect(status.status).toBe(0)
    expect(JSON.parse(status.stdout)).toMatchObject({
      state: {
        finish: "blocked",
        lifecycle: { loops: { workflow: "unsafe" }, readiness: "blocked" },
      },
    })
    expect(status.stdout).toContain("workflow-loop-state-unsafe")
    expect(next.status).toBe(0)
    expect(next.stdout).toContain("workflow-loop-state-unsafe")
    expect(next.stdout).toContain("repair-unsafe-workflow-loop-state")
    expect(finish.status).toBe(1)
    expect(finish.stderr).toContain("workflow-loop-state-unsafe")
    expect(`${status.stdout}${next.stdout}${finish.stderr}`).not.toContain(outside)
    expect(existsSync(outside)).toBe(false)
  })
})

function run(projectDir: string, args: readonly string[], stdin?: string) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph", stdin })
}

function createProject(): string {
  const projectDir = createDirectProjectRoot("persona-cooperative-public")
  projects.push(projectDir)
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, "README.md"), "# Cooperative fixture\n")
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
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "gc.auto", "0"], { cwd: projectDir })
  execFileSync("git", ["config", "maintenance.auto", "false"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "fixture"], { cwd: projectDir })
  return projectDir
}

function implementationReport(): string {
  return [
    "Status: filled",
    "- README ranges read: all",
    "- Project profile ranges read: all",
    "- `npx ph bearshell ./gradlew test`",
  ].join("\n")
}

function reviewReport(): string {
  return [
    "Status: filled",
    "- Manual QA reviewed the Java/Gradle fixture.",
    "- `npx ph bearshell ./gradlew clean`",
  ].join("\n")
}
