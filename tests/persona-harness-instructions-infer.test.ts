import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { isRecord } from "../src/config/jsonc.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-instructions-infer-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeProfile(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "project-profile.jsonc"),
    `${JSON.stringify(
      {
        defaults: { buildTool: "gradle", framework: "spring", language: "java" },
        questions: [
          { answer: "domain-first", id: "package-style" },
          { answer: "clean-architecture-light", id: "architecture-style" },
        ],
      },
      null,
      2,
    )}\n`,
  )
}

function writeJavaFixture(projectDir: string): void {
  writeFileSync(join(projectDir, "README.md"), "# Task API\n\nBuild with Gradle.\n")
  writeFileSync(join(projectDir, "settings.gradle"), "rootProject.name = 'task-api'\n")
  writeFileSync(join(projectDir, "build.gradle"), "plugins { id 'org.springframework.boot' version '3.5.0' }\n")
  const root = join(projectDir, "src", "main", "java", "com", "example", "task")
  mkdirSync(join(root, "presentation", "dto"), { recursive: true })
  mkdirSync(join(root, "application"), { recursive: true })
  mkdirSync(join(root, "domain"), { recursive: true })
  writeFileSync(join(root, "presentation", "TaskController.java"), "class TaskController {}\n")
  writeFileSync(join(root, "application", "TaskService.java"), "class TaskService {}\n")
  writeFileSync(join(root, "domain", "TaskRepository.java"), "interface TaskRepository {}\n")
  writeFileSync(join(root, "domain", "Task.java"), "class Task {}\n")
  writeFileSync(join(root, "presentation", "dto", "TaskResponse.java"), "record TaskResponse() {}\n")
  mkdirSync(join(projectDir, "src", "test", "java", "com", "example", "task"), { recursive: true })
  writeFileSync(join(projectDir, "src", "test", "java", "com", "example", "task", "TaskControllerTest.java"), "class TaskControllerTest {}\n")
}

function readJsonObject(path: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  expect(isRecord(parsed)).toBe(true)
  return isRecord(parsed) ? parsed : {}
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph instructions infer backend", () => {
  it("writes inferred instruction candidates with provenance without mutating adopted policy", () => {
    const projectDir = createTempProject()
    writeProfile(projectDir)
    writeJavaFixture(projectDir)

    const result = runPersonaCli(["instructions", "infer", "backend", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const inferred = readJsonObject(join(projectDir, ".persona", "instructions", "inferred.json"))
    const conflicts = readJsonObject(join(projectDir, ".persona", "instructions", "conflicts.json"))
    expect(inferred.schemaVersion).toBe("instructions-inferred.1")
    expect(conflicts.schemaVersion).toBe("instructions-conflicts.1")
    expect(result.stdout).toContain("instructions-inferred.1")
    expect(result.stdout).toContain("architecture.controller-service-repository")
    expect(result.stdout).toContain("testing.java-test-suffix")
    expect(result.stdout).toContain("build.gradle-shape")
    expect(existsSync(join(projectDir, ".persona", "instructions", "adopted.json"))).toBe(false)
    expect(existsSync(join(projectDir, ".persona", "harness.jsonc"))).toBe(false)
  })

  it("reports docs/profile conflicts instead of auto-fixing or blocking", () => {
    const projectDir = createTempProject()
    writeProfile(projectDir)
    writeJavaFixture(projectDir)
    writeFileSync(join(projectDir, "README.md"), "# Task API\n\nUse Maven and pom.xml for builds.\n")

    const result = runPersonaCli(["instructions", "infer", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const conflicts = readJsonObject(join(projectDir, ".persona", "instructions", "conflicts.json"))

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Conflicts reported: 1")
    expect(JSON.stringify(conflicts)).toContain("conflict.docs-buildtool-maven-vs-profile-gradle")
    expect(existsSync(join(projectDir, ".persona", "workflow", "closure.json"))).toBe(false)
  })

  it("degrades honestly when profile and docs are missing", () => {
    const projectDir = createTempProject()

    const result = runPersonaCli(["instructions", "infer", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const inferred = readJsonObject(join(projectDir, ".persona", "instructions", "inferred.json"))

    expect(result.status).toBe(0)
    expect(inferred.schemaVersion).toBe("instructions-inferred.1")
    expect(inferred.rules).toEqual([])
    expect(result.stdout).toContain("Rules inferred: 0")
  })

  it("prints help and rejects unknown instruction commands", () => {
    const projectDir = createTempProject()

    const help = runPersonaCli(["instructions", "--help"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const bad = runPersonaCli(["instructions", "unknown"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const rootHelp = runPersonaCli(["--help"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(help.status).toBe(0)
    expect(help.stdout).toContain("Usage: ph instructions <command> [--json]")
    expect(help.stdout).toContain("instructions check [--json]")
    expect(bad.status).toBe(1)
    expect(bad.stderr).toContain("Unknown instructions command")
    expect(rootHelp.stdout).toContain("instructions infer backend")
  })
})

describe("ph instructions check", () => {
  it("does not check inferred-only rules when no adopted policy exists", () => {
    const projectDir = createTempProject()
    writeProfile(projectDir)
    writeJavaFixture(projectDir)
    const infer = runPersonaCli(["instructions", "infer", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })

    const check = runPersonaCli(["instructions", "check", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const report = JSON.parse(check.stdout)

    expect(infer.status).toBe(0)
    expect(check.status).toBe(0)
    expect(report.schemaVersion).toBe("instructions-check.1")
    expect(report.adoptedRules).toBe(0)
    expect(report.findings).toEqual([])
    expect(report.limitations.join("\n")).toContain("Only adopted rules are checked")
  })

  it("reports drift only for adopted deterministic rules without blocking closure", () => {
    const projectDir = createTempProject()
    writeProfile(projectDir)
    writeJavaFixture(projectDir)
    const adoptedDir = join(projectDir, ".persona", "instructions")
    mkdirSync(adoptedDir, { recursive: true })
    writeFileSync(
      join(adoptedDir, "adopted.json"),
      `${JSON.stringify(
        {
          rules: [{ id: "architecture.controller-service-repository", mode: "advisory" }],
          schemaVersion: "instructions-adopted.1",
        },
        null,
        2,
      )}\n`,
    )
    const controllerPath = join(projectDir, "src", "main", "java", "com", "example", "task", "presentation", "TaskController.java")
    writeFileSync(
      controllerPath,
      "import com.example.task.domain.TaskRepository;\nclass TaskController { private final TaskRepository repository; }\n",
    )

    const check = runPersonaCli(["instructions", "check", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const report = JSON.parse(check.stdout)

    expect(check.status).toBe(0)
    expect(JSON.stringify(report)).toContain("drift.controller-repository-direct-dependency")
    expect(JSON.stringify(report)).toContain("TaskController.java")
    expect(existsSync(join(projectDir, ".persona", "workflow", "closure.json"))).toBe(false)
  })
})

describe("ph instructions adopt", () => {
  it("copies reviewed inferred candidates into adopted policy by confidence without adopting conflicts", () => {
    const projectDir = createTempProject()
    writeProfile(projectDir)
    writeJavaFixture(projectDir)
    writeFileSync(join(projectDir, "README.md"), "# Task API\n\nUse Maven and pom.xml for builds.\n")
    const infer = runPersonaCli(["instructions", "infer", "backend"], { cwd: projectDir, env: {}, invocationName: "ph" })

    const adopt = runPersonaCli(["instructions", "adopt", "--min-confidence", "high", "--json"], { cwd: projectDir, env: {}, invocationName: "ph" })
    const adopted = readJsonObject(join(projectDir, ".persona", "instructions", "adopted.json"))

    expect(infer.status).toBe(0)
    expect(adopt.status).toBe(0)
    expect(adopted.schemaVersion).toBe("instructions-adopted.1")
    expect(JSON.stringify(adopted)).toContain("profile.package-style")
    expect(JSON.stringify(adopted)).toContain("architecture.controller-service-repository")
    expect(JSON.stringify(adopted)).not.toContain("conflict.docs-buildtool-maven-vs-profile-gradle")
    expect(existsSync(join(projectDir, ".persona", "workflow", "closure.json"))).toBe(false)
  })
})
