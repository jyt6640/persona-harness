import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
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

describe.sequential("ph evidence read", () => {
  it("records a bounded public read without retaining source content", () => {
    // Given: a project with a generated Java service that contains sensitive-looking text.
    const projectDir = createProject()
    const target = join("src", "main", "java", "example", "GreetingService.java")
    writeFileSync(join(projectDir, target), "class GreetingService { String marker = \"sk-live-read-marker\"; }\n")
    commitProject(projectDir)

    // When: the public CLI records the project-contained read.
    const result = runPh(projectDir, ["evidence", "read", target])

    // Then: the bounded record identifies the file and role but never includes its bytes.
    expect(result).toEqual({ status: 0, stdout: "Evidence read recorded.\n", stderr: "" })
    const phase0 = join(projectDir, ".persona", "evidence", "phase0")
    const records = readdirSync(phase0).filter((name) => name.startsWith("workflow-read-") && name.endsWith(".json"))
    expect(records).toHaveLength(1)
    const record = readRecord(join(phase0, records[0] ?? ""))
    expect(record).toMatchObject({
      evidenceKind: "workflow-read",
      fileRole: "source-read",
      schemaVersion: "workflow-read-evidence.1",
      targetFile: target,
    })
    expect(JSON.stringify(record)).not.toContain("sk-live-read-marker")
  })

  it("rejects unsafe, oversized, and aliased targets without creating evidence", () => {
    // Given: attacker-controlled target forms outside the public project read boundary.
    const projectDir = createProject()
    const target = join("src", "main", "java", "example", "GreetingService.java")
    writeFileSync(join(projectDir, target), "class GreetingService {}\n")
    commitProject(projectDir)
    const outside = join(projectDir, "outside-secret.java")
    writeFileSync(outside, "sk-live-evidence-read-marker\n")
    symlinkSync(outside, join(projectDir, "src", "main", "java", "example", "LinkedService.java"))
    writeFileSync(join(projectDir, "too-large.java"), "x".repeat(256 * 1024 + 1))

    // When: each unsafe public target is submitted.
    const results = [
      runPh(projectDir, ["evidence", "read", "../../outside-secret.java"]),
      runPh(projectDir, ["evidence", "read", "src/main/java/example/LinkedService.java"]),
      runPh(projectDir, ["evidence", "read", "too-large.java"]),
    ]

    // Then: every block is bounded, non-reflective, and leaves no evidence write.
    for (const result of results) {
      expect(result).toEqual({ status: 1, stdout: "", stderr: "Evidence read unavailable.\n" })
      expect(`${result.stdout}${result.stderr}`).not.toContain("sk-live-evidence-read-marker")
      expect(`${result.stdout}${result.stderr}`).not.toContain(outside)
    }
    expect(existsSync(join(projectDir, ".persona", "evidence"))).toBe(false)
  })

  it("rejects an aliased evidence destination without writing outside the project", () => {
    // Given: an otherwise valid source read and a replaced configured evidence parent.
    const projectDir = createProject()
    const target = join("src", "main", "java", "example", "GreetingService.java")
    writeFileSync(join(projectDir, target), "class GreetingService {}\n")
    commitProject(projectDir)
    const outside = join(projectDir, "outside-evidence")
    mkdirSync(outside)
    symlinkSync(outside, join(projectDir, ".persona", "evidence"))

    // When: the public CLI attempts to record the bounded read.
    const result = runPh(projectDir, ["evidence", "read", target])

    // Then: the unsafe output boundary blocks before any external record is created.
    expect(result).toEqual({ status: 1, stdout: "", stderr: "Evidence read unavailable.\n" })
    expect(readdirSync(outside)).toEqual([])
  })

  it("requires an initialized workflow boundary without creating one", () => {
    // Given: a partial Persona directory that has not completed strict bootstrap.
    const projectDir = createProject({ workflow: false })
    const target = join("src", "main", "java", "example", "GreetingService.java")
    writeFileSync(join(projectDir, target), "class GreetingService {}\n")

    // When: a public source-read record is requested before the lifecycle boundary exists.
    const result = runPh(projectDir, ["evidence", "read", target])

    // Then: the command blocks without materializing workflow state as a side effect.
    expect(result).toEqual({ status: 1, stdout: "", stderr: "Evidence read unavailable.\n" })
    expect(existsSync(join(projectDir, ".persona", "workflow"))).toBe(false)
  })
})

function runPh(projectDir: string, args: readonly string[]) {
  return runPersonaCli(args, { cwd: projectDir, env: {}, invocationName: "ph" })
}

function createProject(options: { readonly workflow?: boolean } = {}): string {
  const projectDir = createDirectProjectRoot("persona-evidence-read")
  projects.push(projectDir)
  mkdirSync(join(projectDir, "src", "main", "java", "example"), { recursive: true })
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  if (options.workflow !== false) {
    mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  }
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), "{}\n")
  return projectDir
}

function readRecord(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"))
}

function commitProject(projectDir: string): void {
  execFileSync("git", ["init", "-q"], { cwd: projectDir })
  execFileSync("git", ["config", "gc.auto", "0"], { cwd: projectDir })
  execFileSync("git", ["config", "maintenance.auto", "false"], { cwd: projectDir })
  execFileSync("git", ["config", "user.email", "evidence@example.invalid"], { cwd: projectDir })
  execFileSync("git", ["config", "user.name", "Evidence"], { cwd: projectDir })
  execFileSync("git", ["add", "."], { cwd: projectDir })
  execFileSync("git", ["commit", "-qm", "evidence fixture"], { cwd: projectDir })
}
