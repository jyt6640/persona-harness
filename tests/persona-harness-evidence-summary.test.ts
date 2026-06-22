import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-evidence-summary-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeEvidence(projectDir: string, filename: string, content: unknown): void {
  const evidenceDir = join(projectDir, ".persona", "evidence", "phase0")
  mkdirSync(evidenceDir, { recursive: true })
  writeFileSync(join(evidenceDir, filename), `${JSON.stringify(content, null, 2)}\n`)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("ph evidence summary", () => {
  it("writes a human-readable evidence summary with role, target, rule, and skill counts", () => {
    const projectDir = createTempProject()
    writeEvidence(projectDir, "controller.json", {
      targetFile: "/demo/src/main/java/com/example/book/presentation/BookController.java",
      fileRole: "controller",
      selectedRules: ["backend/spring-controller.md", "backend/java-common.md"],
      selectedSharedSkills: [{ name: "programming", domain: "programming" }],
    })
    writeEvidence(projectDir, "service.json", {
      targetFile: "/demo/src/main/java/com/example/book/application/BookService.java",
      fileRole: "service",
      selectedRules: ["backend/spring-service.md"],
      selectedSharedSkills: [{ name: "programming", domain: "programming" }],
    })

    const result = runPersonaCli(["evidence", "summary"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stdout).toContain("Evidence summary written")
    const summary = readFileSync(join(projectDir, ".persona", "evidence", "summary.md"), "utf8")
    expect(summary).toContain("# Persona Evidence Summary")
    expect(summary).toContain("Total evidence files: 2")
    expect(summary).toContain("- controller: 1")
    expect(summary).toContain("- service: 1")
    expect(summary).toContain("- backend/java-common.md: 1")
    expect(summary).toContain("- programming: 2")
    expect(summary).toContain("BookController.java")
    expect(summary).toContain("BookService.java")
  })

  it("does not fail when evidence is missing or unreadable", () => {
    const projectDir = createTempProject()
    mkdirSync(join(projectDir, ".persona", "evidence", "phase0"), { recursive: true })
    writeFileSync(join(projectDir, ".persona", "evidence", "phase0", "bad.json"), "{ nope\n")

    const result = runPersonaCli(["evidence", "summary"], { cwd: projectDir, env: {}, invocationName: "ph" })

    expect(result.status).toBe(0)
    const summaryPath = join(projectDir, ".persona", "evidence", "summary.md")
    expect(existsSync(summaryPath)).toBe(true)
    const summary = readFileSync(summaryPath, "utf8")
    expect(summary).toContain("Unreadable evidence files: 1")
    expect(summary).toContain("bad.json")
  })
})
