import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"

const tempProjects: string[] = []

afterEach(() => {
  for (const projectDir of tempProjects.splice(0)) {
    rmSync(projectDir, { recursive: true, force: true })
  }
})

function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-observe-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeJava(projectDir: string, relativePath: string, source: string): void {
  const filePath = join(projectDir, relativePath)
  mkdirSync(join(filePath, ".."), { recursive: true })
  writeFileSync(filePath, source)
}

function parseHumanJson(stdout: string): unknown {
  const jsonStart = stdout.indexOf("{\n")
  expect(jsonStart).toBeGreaterThanOrEqual(0)
  return JSON.parse(stdout.slice(jsonStart))
}

function recordValue(value: unknown): Record<string, unknown> {
  if (isRecordValue(value)) {
    return value
  }
  throw new Error("Expected JSON object")
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function arrayValue(value: unknown): readonly unknown[] {
  if (Array.isArray(value)) {
    return value
  }
  throw new Error("Expected JSON array")
}

describe("ph observe", () => {
  it("prints a human summary plus normalized JSON findings for Java directories", () => {
    const projectDir = createProject()
    writeJava(
      projectDir,
      "src/main/java/com/example/ReservationController.java",
      `
class ReservationController {
  ReservationController(CrudRepository<Foo, Bar> repository, ReservationService service) {
    repository.findAll();
  }
}
`,
    )
    writeJava(
      projectDir,
      "src/main/java/com/example/ReservationService.java",
      `
class ReservationService {
  ReservationService(long idCounter, ReservationRepository repository) {
  }
}
`,
    )

    const result = runPersonaCli(["observe", "src/main/java"], { cwd: projectDir, invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    expect(result.stdout).toContain("Observe summary:")
    expect(result.stdout).toContain("Report-only: not enforcement, not generated app quality certification.")
    const report = parseHumanJson(result.stdout)
    expect(report).toMatchObject({
      command: "ph observe",
      targetPath: "src/main/java",
      limitations: expect.arrayContaining(["Report-only observer output; not enforcement and not generated app quality certification."]),
    })
    const findings = arrayValue(recordValue(report).findings)
    expect(findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ruleId: "controller.repository-dependency",
          result: "WARN",
          confidence: "NONE",
          source: "manual/text",
          filePath: "src/main/java/com/example/ReservationController.java",
          limitations: expect.any(Array),
        }),
        expect.objectContaining({
          ruleId: "service.storage-ownership",
          result: "WARN",
          confidence: "HIGH",
          source: "manual/text",
          filePath: "src/main/java/com/example/ReservationService.java",
          limitations: expect.any(Array),
        }),
      ]),
    )
  })

  it("runs against the repo example Java app with --json", () => {
    const result = runPersonaCli(["observe", "--json", "example/"], { cwd: process.cwd(), invocationName: "ph" })

    expect(result.status).toBe(0)
    expect(result.stderr).toBe("")
    const report = recordValue(JSON.parse(result.stdout))
    const inspectedFiles = arrayValue(report.inspectedFiles)
    const findings = arrayValue(report.findings)
    expect(inspectedFiles.some((filePath) => typeof filePath === "string" && filePath.endsWith(".java"))).toBe(true)
    expect(findings.length).toBeGreaterThan(0)
  })
})
