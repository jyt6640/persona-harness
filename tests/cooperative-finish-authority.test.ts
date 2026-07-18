import { execFileSync } from "node:child_process"
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  isLiveCooperativeDecision,
  runCurrentProcessCooperativeFinish,
} from "../src/cli/cooperative-finish-authority.js"
import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("cooperative current-process authority", () => {
  it("consumes in memory without creating a receipt or terminal record", () => {
    // Given: a custom evidence root and a project whose wrapper produces a fresh report.
    const projectDir = createProject()

    // When: the cooperative authority completes one verification invocation.
    const result = runCurrentProcessCooperativeFinish(projectDir)

    // Then: only that invocation passes; later authority readers remain external-only.
    expect(result).toEqual({ kind: "passed", testCount: 1 })
    expect(existsSync(join(projectDir, ".persona", "custom-evidence"))).toBe(false)
    expect(readWorkflowFinishAuthority(projectDir).status).toBe("blocked")
  })

  it("rejects copied decision data and reused JUnit content in a new invocation", () => {
    // Given: a completed in-memory run and a copied cooperative-looking object.
    const projectDir = createProject()
    const first = runCurrentProcessCooperativeFinish(projectDir)
    const copied: unknown = JSON.parse(JSON.stringify({
      assurance: "cooperative",
      authorityProvider: "cooperative-current-process",
      completionEligible: true,
      consumptionState: "unconsumed",
      kind: "cooperative-current-process",
    }))

    // When: a second invocation sees the unchanged report content.
    const replay = runCurrentProcessCooperativeFinish(projectDir)

    // Then: neither copied data nor reused report content can recreate authority.
    expect(first).toEqual({ kind: "passed", testCount: 1 })
    expect(isLiveCooperativeDecision(copied)).toBe(false)
    expect(replay).toEqual({ code: "junit-stale-report", kind: "blocked" })
  })
})

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-cooperative-authority-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), '{"evidenceDir":".persona/custom-evidence"}\n')
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), `${JSON.stringify(profile())}\n`)
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
