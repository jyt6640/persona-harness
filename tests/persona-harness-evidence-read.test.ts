import { randomUUID } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const projects: string[] = []

afterEach(() => {
  for (const projectDir of projects.splice(0)) {
    rmSync(projectDir, { force: true, recursive: true })
  }
})

describe("ph evidence read", () => {
  it("records a bounded public read without retaining source content", () => {
    // Given: a project with a generated Java service that contains sensitive-looking text.
    const projectDir = createProject()
    const target = join("src", "main", "java", "example", "GreetingService.java")
    writeFileSync(join(projectDir, target), "class GreetingService { String marker = \"sk-live-read-marker\"; }\n")

    // When: the public CLI records the project-contained read.
    const result = runPersonaCli(["evidence", "read", target], { cwd: projectDir, env: {}, invocationName: "ph" })

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
    const outside = join(projectDir, "outside-secret.java")
    writeFileSync(outside, "sk-live-evidence-read-marker\n")
    symlinkSync(outside, join(projectDir, "src", "main", "java", "example", "LinkedService.java"))
    writeFileSync(join(projectDir, "too-large.java"), "x".repeat(256 * 1024 + 1))

    // When: each unsafe public target is submitted.
    const results = [
      runPersonaCli(["evidence", "read", "../../outside-secret.java"], { cwd: projectDir, env: {}, invocationName: "ph" }),
      runPersonaCli(["evidence", "read", "src/main/java/example/LinkedService.java"], { cwd: projectDir, env: {}, invocationName: "ph" }),
      runPersonaCli(["evidence", "read", "too-large.java"], { cwd: projectDir, env: {}, invocationName: "ph" }),
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
    const outside = join(projectDir, "outside-evidence")
    mkdirSync(outside)
    symlinkSync(outside, join(projectDir, ".persona", "evidence"))

    // When: the public CLI attempts to record the bounded read.
    const result = runPersonaCli(["evidence", "read", target], { cwd: projectDir, env: {}, invocationName: "ph" })

    // Then: the unsafe output boundary blocks before any external record is created.
    expect(result).toEqual({ status: 1, stdout: "", stderr: "Evidence read unavailable.\n" })
    expect(readdirSync(outside)).toEqual([])
  })
})

function createProject(): string {
  const projectDir = join(tmpdir(), `persona-evidence-read-${randomUUID()}`)
  projects.push(projectDir)
  mkdirSync(join(projectDir, "src", "main", "java", "example"), { recursive: true })
  mkdirSync(join(projectDir, ".persona", "workflow"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), "{}\n")
  return projectDir
}

function readRecord(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"))
}
