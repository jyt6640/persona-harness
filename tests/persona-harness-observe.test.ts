import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import process from "node:process"

import { afterEach, describe, expect, it } from "vitest"

import { runPersonaCli } from "../src/cli/index.js"
import { CONTROLLER_PERSISTENCE_IMPORT_CONVENTION } from "../src/config/convention-registry.js"

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

function optionalFindingByRule(findings: readonly unknown[], ruleId: string): Record<string, unknown> | undefined {
  return findings.map(recordValue).find((entry) => entry.ruleId === ruleId)
}

function writeControllerPersistenceImportRule(projectDir: string): void {
  mkdirSync(join(projectDir, ".persona", "conventions"), { recursive: true })
  writeFileSync(
    join(projectDir, ".persona", "conventions", "controller-persistence-import.yml"),
    [
      "id: controller.persistence-import",
      "language: Java",
      "message: Controllers should not import Jakarta persistence types; keep entities behind service/DTO boundaries.",
      "rule:",
      "  pattern: import jakarta.persistence.$ENTITY;",
    ].join("\n"),
  )
}

function writeFakeAstGrepBinary(projectDir: string): string {
  const fakeBinary = join(projectDir, "fake-sg.js")
  writeFileSync(
    fakeBinary,
    [
      "#!/usr/bin/env node",
      "const { existsSync, readdirSync, readFileSync, statSync } = require('node:fs')",
      "const { join } = require('node:path')",
      "const root = process.argv[process.argv.length - 1]",
      "const findings = []",
      "function visit(dir) {",
      "  if (!existsSync(dir)) return",
      "  for (const entry of readdirSync(dir)) {",
      "    const path = join(dir, entry)",
      "    const stat = statSync(path)",
      "    if (stat.isDirectory()) visit(path)",
      "    if (stat.isFile() && path.endsWith('.java')) {",
      "      const source = readFileSync(path, 'utf8')",
      "      if (source.includes('import jakarta.persistence.')) {",
      "        findings.push({ file: path, message: 'Controllers should not import Jakarta persistence types; keep entities behind service/DTO boundaries.', range: { start: { line: 1 } } })",
      "      }",
      "    }",
      "  }",
      "}",
      "visit(root)",
      "process.stdout.write(JSON.stringify(findings))",
    ].join("\n"),
  )
  chmodSync(fakeBinary, 0o755)
  return fakeBinary
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

    const serviceFinding = findingByRule(findings, "controller.service-dependency")
    expect(serviceFinding.result).toBe("PASS")
    expect(serviceFinding.confidence).toBe("HIGH")
    expect(serviceFinding.source).toBe("manual/text")
    expect(serviceFinding.filePath).toBe("src/main/java/com/example/ReservationController.java")

    const storageFinding = findingByRule(findings, "service.storage-ownership")
    expect(storageFinding.result).toBe("WARN")
    expect(storageFinding.confidence).toBe("HIGH")
    expect(storageFinding.source).toBe("manual/text")
    expect(storageFinding.filePath).toBe("src/main/java/com/example/ReservationService.java")
  })

  it("emits request and response DTO boundary findings from real Java files", () => {
    const projectDir = createProject()
    writeJava(
      projectDir,
      "src/main/java/com/example/api/CreateOrderRequest.java",
      `
class CreateOrderRequest {
  String customerEmail;
}
`,
    )
    writeJava(
      projectDir,
      "src/main/java/com/example/api/OrderResponse.java",
      `
class OrderResponse {
  String id;
}
`,
    )

    const result = runPersonaCli(["observe", "--json", "src/main/java"], { cwd: projectDir, invocationName: "ph" })

    expect(result.status).toBe(0)
    const report = recordValue(JSON.parse(result.stdout))
    const findings = arrayValue(report.findings).map(recordValue)
    const dtoFindings = findings.filter((finding) => finding.ruleId === "dto.boundary")
    expect(dtoFindings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          result: "PASS",
          confidence: "MEDIUM",
          source: "manual/text",
          filePath: "src/main/java/com/example/api/CreateOrderRequest.java",
          evidence: expect.objectContaining({ role: "request" }),
        }),
        expect.objectContaining({
          result: "PASS",
          confidence: "MEDIUM",
          source: "manual/text",
          filePath: "src/main/java/com/example/api/OrderResponse.java",
          evidence: expect.objectContaining({ role: "response" }),
        }),
      ]),
    )
  })

  it("emits BYO ast-grep convention findings with registry metadata", () => {
    const projectDir = createProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = writeFakeAstGrepBinary(projectDir)
    try {
      writeControllerPersistenceImportRule(projectDir)
      writeJava(
        projectDir,
        "src/main/java/com/example/TodoController.java",
        `
import jakarta.persistence.Entity;

class TodoController {
}
`,
      )

      const result = runPersonaCli(["observe", "--json", "src/main/java"], { cwd: projectDir, invocationName: "ph" })

      expect(result.status).toBe(0)
      expect(result.stderr).toBe("")
      const report = recordValue(JSON.parse(result.stdout))
      const finding = findingByRule(arrayValue(report.findings), CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id)
      expect(finding).toEqual(expect.objectContaining({
        ruleId: CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id,
        result: "WARN",
        confidence: "HIGH",
        source: "ast-grep",
        filePath: "src/main/java/com/example/TodoController.java",
        checkKind: "ast-grep",
        fixPath: CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.fixPath,
        level: CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.defaultLevel,
        line: 2,
        message: CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.actionableMessage,
      }))
      expect(recordValue(finding.evidence).source).toBe("src/main/java/com/example/TodoController.java")
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("does not emit a BYO ast-grep finding for compliant Java files", () => {
    const projectDir = createProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = writeFakeAstGrepBinary(projectDir)
    try {
      writeControllerPersistenceImportRule(projectDir)
      writeJava(
        projectDir,
        "src/main/java/com/example/TodoController.java",
        `
class TodoController {
}
`,
      )

      const result = runPersonaCli(["observe", "--json", "src/main/java"], { cwd: projectDir, invocationName: "ph" })

      expect(result.status).toBe(0)
      const report = recordValue(JSON.parse(result.stdout))
      expect(optionalFindingByRule(arrayValue(report.findings), CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id)).toBeUndefined()
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
  })

  it("surfaces BYO ast-grep skip warnings when the binary is unavailable", () => {
    const projectDir = createProject()
    const previousAstGrep = process.env.PH_AST_GREP_BIN
    process.env.PH_AST_GREP_BIN = join(projectDir, "missing-sg")
    try {
      writeControllerPersistenceImportRule(projectDir)
      writeJava(
        projectDir,
        "src/main/java/com/example/TodoController.java",
        `
import jakarta.persistence.Entity;

class TodoController {
}
`,
      )

      const result = runPersonaCli(["observe", "--json", "src/main/java"], { cwd: projectDir, invocationName: "ph" })

      expect(result.status).toBe(0)
      const report = recordValue(JSON.parse(result.stdout))
      const finding = findingByRule(arrayValue(report.findings), CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id)
      expect(finding).toEqual(expect.objectContaining({
        ruleId: CONTROLLER_PERSISTENCE_IMPORT_CONVENTION.id,
        result: "WARN",
        confidence: "NONE",
        source: "ast-grep",
        filePath: ".persona/conventions",
        checkKind: "ast-grep",
        message: expect.stringContaining("ast-grep binary not found"),
      }))
      expect(recordValue(finding.evidence).status).toBe("skipped")
    } finally {
      if (previousAstGrep === undefined) {
        delete process.env.PH_AST_GREP_BIN
      } else {
        process.env.PH_AST_GREP_BIN = previousAstGrep
      }
    }
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
