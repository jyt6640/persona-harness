import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadAstGrepConventionDefinitions } from "../src/cli/ast-grep-convention-runner.js"
import { summarizeConventionPackDiagnostics } from "../src/cli/convention-pack-diagnostics.js"

const tempProjects: string[] = []

const DIFF_RULE_CONVENTION_IDS = [
  "architecture.no-common-util-package",
  "method.no-composite-and-name",
  "naming.no-generic-manager-class",
  "validation.no-util-based-validation",
] as const

function createTempProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-convention-pack-test-"))
  tempProjects.push(projectDir)
  return projectDir
}

function writeConvention(projectDir: string, relativePath: string, content: string): void {
  const fullPath = join(projectDir, ".persona", "conventions", relativePath)
  mkdirSync(join(fullPath, ".."), { recursive: true })
  writeFileSync(fullPath, content)
}

afterEach(() => {
  for (const projectDir of tempProjects) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  tempProjects.length = 0
})

describe("convention pack diagnostics", () => {
  it("does not treat a built-in ast-grep rule file as a duplicate dynamic convention", () => {
    const projectDir = createTempProject()
    writeConvention(
      projectDir,
      "controller-persistence-import.yml",
      [
        "id: controller.persistence-import",
        "language: Java",
        "message: Controllers should not import persistence types.",
        "# persona-harness-fix-path: move persistence access behind a Service.",
        "# persona-harness-step-id: fix-controller-persistence-import",
        "rule:",
        "  pattern: import jakarta.persistence.$ENTITY;",
        "",
      ].join("\n"),
    )

    const summary = summarizeConventionPackDiagnostics(projectDir)

    expect(summary.finding).toBe("PASS")
    expect(summary.diagnostics).toEqual([])
  })

  it("reports duplicate id, invalid glob, invalid pattern, unknown role, and missing remediation metadata", () => {
    const projectDir = createTempProject()
    writeConvention(
      projectDir,
      "one.yml",
      [
        "id: custom.duplicate",
        "language: Java",
        "message: First duplicate.",
        "# persona-harness-fix-path: move this behind a boundary.",
        "# persona-harness-step-id: fix-custom-duplicate",
        "# persona-harness-target-glob: src/[broken.java",
        "# persona-harness-roles: main, robot",
        "rule:",
        "  pattern:",
        "",
      ].join("\n"),
    )
    writeConvention(
      projectDir,
      "two.yml",
      [
        "id: custom.duplicate",
        "language: Java",
        "message: Second duplicate.",
        "# persona-harness-fix-path: move this behind a boundary.",
        "# persona-harness-step-id: fix-custom-duplicate-two",
        "rule:",
        "  pattern: class $A {}",
        "",
      ].join("\n"),
    )
    writeConvention(
      projectDir,
      "missing.yml",
      ["id: custom.missing", "language: Java", "message: Missing remediation.", "rule:", "  pattern: class $A {}", ""].join(
        "\n",
      ),
    )

    const summary = summarizeConventionPackDiagnostics(projectDir)
    const diagnostics = summary.diagnostics.map((item) => ({
      code: item.code,
      field: item.field,
      path: item.path,
    }))

    expect(summary.finding).toBe("WARN")
    expect(diagnostics).toEqual(
      expect.arrayContaining([
        { code: "duplicate_convention_id", field: "id", path: ".persona/conventions/one.yml" },
        { code: "duplicate_convention_id", field: "id", path: ".persona/conventions/two.yml" },
        { code: "invalid_glob", field: "persona-harness-target-glob", path: ".persona/conventions/one.yml" },
        { code: "invalid_pattern", field: "rule.pattern", path: ".persona/conventions/one.yml" },
        { code: "unknown_role", field: "roles", path: ".persona/conventions/one.yml" },
        { code: "missing_required_field", field: "persona-harness-fix-path", path: ".persona/conventions/missing.yml" },
        { code: "missing_required_field", field: "persona-harness-step-id", path: ".persona/conventions/missing.yml" },
      ]),
    )
  })

  it("loads migrated diff-rule conventions as report-level candidates with remediation metadata", () => {
    const summary = summarizeConventionPackDiagnostics(process.cwd())
    const definitions = loadAstGrepConventionDefinitions(process.cwd()).filter((definition) =>
      DIFF_RULE_CONVENTION_IDS.some((id) => id === definition.id),
    )

    expect(summary.finding).toBe("PASS")
    expect(summary.diagnostics).toEqual([])
    expect(definitions.map((definition) => definition.id).sort()).toEqual([...DIFF_RULE_CONVENTION_IDS].sort())
    for (const definition of definitions) {
      expect(definition.defaultLevel).toBe("report")
      expect(definition.stepId).toMatch(/^fix-/u)
      expect(definition.fixPath).not.toBe("")
      expect(definition.check.kind).toBe("ast-grep")
    }
  })
})
