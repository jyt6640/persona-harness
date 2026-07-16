import { execFileSync } from "node:child_process"
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runFreshFixedVerification } from "../src/cli/fresh-verification-runner.js"
import { readWorkflowFinishAuthority } from "../src/cli/workflow-finish-authority.js"
import { assessSemanticTddChain } from "../src/cli/workflow-semantic-tdd.js"
import {
  assessSemanticTddTransition,
  parseSemanticTddTransition,
} from "../src/cli/workflow-semantic-tdd-transition.js"

const projects: string[] = []

afterEach(() => {
  for (const project of projects) rmSync(project, { force: true, recursive: true })
  projects.length = 0
})

describe("source-aware semantic TDD transition", () => {
  it("accepts exactly one declared source edit as diagnostic-only", () => {
    const projectDir = createProject()
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("failed")
    writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App { int changed; }\n")
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("passed")

    const result = assessSemanticTddTransition(projectDir)

    expect(result.state).toBe("valid-untrusted")
    expect(result.decision.status).toBe("diagnostic-only")
    expect(result.envelope?.schemaVersion).toBe("semantic-tdd-transition.1")
    expect(result.envelope?.sourceDelta.changedEntryCount).toBe(1)
    expect(JSON.stringify(result)).not.toContain(projectDir)
    expect(JSON.stringify(readTransitionRecords(projectDir))).not.toContain("App.java")
    const integrated = assessSemanticTddChain(projectDir)
    expect(integrated.state).toBe("valid-untrusted")
    expect(integrated.sourceAwareTransition?.schemaVersion).toBe("semantic-tdd-transition.1")
    expect(readWorkflowFinishAuthority(projectDir).blocker.id).toBe("trusted-authority-required")
  })

  it("rejects a same-source red-to-green pair", () => {
    const projectDir = createProject()
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("failed")
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("passed")

    const result = assessSemanticTddTransition(projectDir)

    expect(result.state).toBe("invalid")
    expect(result.diagnosticCodes).toContain("source-transition-required")
  })

  it("rejects an allowed source edit combined with unrelated content", () => {
    const projectDir = createProject()
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("failed")
    writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App { int changed; }\n")
    writeFileSync(join(projectDir, "package.json"), '{"name":"unrelated"}\n')
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("passed")

    const result = assessSemanticTddTransition(projectDir)

    expect(result.state).toBe("invalid")
    expect(result.diagnosticCodes).toContain("source-delta-unrelated")
  })

  it("fails closed for strict envelope shape mutations", () => {
    const projectDir = createProject()
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("failed")
    writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App { int changed; }\n")
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("passed")
    const result = assessSemanticTddTransition(projectDir)
    expect(result.envelope).toBeDefined()

    const mutated = { ...result.envelope, unexpected: true }

    expect(parseSemanticTddTransition(JSON.stringify(mutated), ".persona/evidence/transition.json").ok).toBe(false)
  })

  it("rejects rename, delete, and mode transitions", () => {
    for (const mutation of ["rename", "delete", "mode"] as const) {
      const projectDir = createProject()
      expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("failed")
      const sourcePath = join(projectDir, "src", "main", "java", "App.java")
      if (mutation === "rename") {
        renameSync(sourcePath, join(projectDir, "src", "main", "java", "Renamed.java"))
      } else if (mutation === "delete") {
        unlinkSync(sourcePath)
      } else {
        chmodSync(sourcePath, 0o755)
      }
      expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("passed")

      expect(assessSemanticTddTransition(projectDir).state).toBe("invalid")
    }
  })

  it("rejects replayed or stale source snapshots", () => {
    const projectDir = createProject()
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("failed")
    writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App { int changed; }\n")
    expect(runFreshFixedVerification(projectDir, "ci", fixedOptions()).finalStatus).toBe("passed")
    const snapshotDir = join(projectDir, ".persona", "evidence", "semantic-tdd", "source-snapshots")
    const redSnapshot = readdirSync(snapshotDir).find((entry) => {
      const value = JSON.parse(readFileSync(join(snapshotDir, entry), "utf8")) as { readonly phase?: string }
      return value.phase === "red"
    })
    expect(redSnapshot).toBeDefined()
    if (redSnapshot === undefined) throw new Error("red source snapshot was not created")
    copyFileSync(join(snapshotDir, redSnapshot), join(snapshotDir, "replayed.json"))
    expect(assessSemanticTddTransition(projectDir).diagnosticCodes).toContain("semantic-transition-red-required")
  })
})

type FixedOptions = {
  readonly finishId: string
  readonly idFactory: () => string
  readonly now: () => number
}

function fixedOptions(): FixedOptions {
  let now = 1_000
  return {
    finishId: "semantic-transition-finish",
    idFactory: (() => {
      let index = 0
      return () => `semantic-transition-${index++}`
    })(),
    now: () => {
      now += 1_000
      return now
    },
  }
}

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-semantic-transition-"))
  projects.push(projectDir)
  mkdirSync(join(projectDir, ".persona", "evidence"), { recursive: true })
  mkdirSync(join(projectDir, "src", "main", "java"), { recursive: true })
  writeFileSync(join(projectDir, ".gitignore"), "build/\n.persona/evidence/\n")
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), '{"enforce":{"executeVerification":true}}\n')
  writeFileSync(join(projectDir, ".persona", "project-profile.jsonc"), JSON.stringify({
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
  }, null, 2))
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'java' }\n")
  writeFileSync(join(projectDir, "src", "main", "java", "App.java"), "class App {}\n")
  const stateDir = mkdtempSync(join(tmpdir(), "persona-semantic-transition-state-"))
  projects.push(stateDir)
  const statePath = join(stateDir, "run.txt")
  writeFileSync(statePath, "0")
  const script = join(projectDir, "gradlew")
  writeFileSync(script, [
    "#!/bin/sh",
    "set -eu",
    `run="$(cat '${statePath.replaceAll("'", "'\\''")}')"`,
    `printf '%s' "$((run + 1))" > '${statePath.replaceAll("'", "'\\''")}'`,
    'if [ "$run" = "0" ]; then',
    "  mkdir -p build/test-results/test/red",
    "  cat > build/test-results/test/red/TEST-tdd.xml <<'XML'",
    '<testsuite tests="1" failures="1" errors="0"><testcase classname="com.example.TodoTest" name="createsTodo"><failure message="expected">red</failure></testcase></testsuite>',
    "XML",
    "  exit 1",
    "fi",
    "mkdir -p build/test-results/test/green",
    "cat > build/test-results/test/green/TEST-tdd.xml <<'XML'",
    '<testsuite tests="1" failures="0" errors="0"><testcase classname="com.example.TodoTest" name="createsTodo"/></testsuite>',
    "XML",
    "exit 0",
    "",
  ].join("\n"))
  chmodSync(script, 0o755)
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "ph@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "PH Test"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "semantic transition fixture"], { cwd: projectDir })
  return projectDir
}

function readTransitionRecords(projectDir: string): readonly string[] {
  const root = join(projectDir, ".persona", "evidence", "semantic-tdd")
  if (!readdirSync(join(projectDir, ".persona", "evidence"), { withFileTypes: true }).some((entry) => entry.name === "semantic-tdd")) {
    return []
  }
  const files: string[] = []
  function visit(directory: string): void {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile()) files.push(readFileSync(path, "utf8"))
    }
  }
  visit(root)
  return files
}
