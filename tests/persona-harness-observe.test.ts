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

function stringArrayValue(value: unknown): readonly string[] {
  const values = arrayValue(value)
  if (values.every((entry) => typeof entry === "string")) {
    return values
  }
  throw new Error("Expected JSON string array")
}

function findingByRule(findings: readonly unknown[], ruleId: string): Record<string, unknown> {
  const finding = findings.map(recordValue).find((entry) => entry.ruleId === ruleId)
  if (finding !== undefined) {
    return finding
  }
  throw new Error(`Missing observe finding: ${ruleId}`)
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
    expect(result.stdout.startsWith("Observe summary:")).toBe(true)
    const report = parseHumanJson(result.stdout)
    const reportRecord = recordValue(report)
    expect(reportRecord.command).toBe("ph observe")
    expect(reportRecord.targetPath).toBe("src/main/java")
    expect(stringArrayValue(reportRecord.limitations)).toEqual([
      "Report-only observer output; not enforcement and not generated app quality certification.",
      "Java parsing is text based and may miss equivalent AST shapes.",
    ])
    const findings = arrayValue(reportRecord.findings)
    const repositoryFinding = findingByRule(findings, "controller.repository-dependency")
    expect(repositoryFinding.result).toBe("WARN")
    expect(repositoryFinding.confidence).toBe("NONE")
    expect(repositoryFinding.source).toBe("manual/text")
    expect(repositoryFinding.filePath).toBe("src/main/java/com/example/ReservationController.java")
    expect(stringArrayValue(repositoryFinding.limitations)).toEqual([
      "String-based observation; false positives or false negatives remain possible for unusual Java formatting.",
    ])

    const storageFinding = findingByRule(findings, "service.storage-ownership")
    expect(storageFinding.result).toBe("WARN")
    expect(storageFinding.confidence).toBe("HIGH")
    expect(storageFinding.source).toBe("manual/text")
    expect(storageFinding.filePath).toBe("src/main/java/com/example/ReservationService.java")
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
