import { afterEach, describe, expect, it } from "vitest"

import {
  renderRuleDiagnosticsReport,
  summarizeRuleDiagnostics,
} from "../src/phase0/rule-diagnostics-report.js"
import {
  cleanupProjects,
  createProject,
  writeMalformedRule,
  writeRule,
} from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

describe("rule diagnostics report surface", () => {
  it("renders PASS when rule frontmatter has no diagnostics", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "backend/spring-controller.md",
      `
id: backend.spring.controller
source: backend-policy
domain: backend
topic: controller-responsibility
globs:
  - "**/*Controller.java"
severity: must
enforcement: inject_only
`,
      ["controller policy"],
    )

    const summary = summarizeRuleDiagnostics(projectDir)
    const report = renderRuleDiagnosticsReport(summary)

    expect(summary.finding).toBe("PASS")
    expect(summary.diagnosticCount).toBe(0)
    expect(report).toContain("Finding: PASS")
    expect(report).toContain("Diagnostics: 0")
    expect(report).toContain("No rule frontmatter diagnostics found.")
  })

  it("renders WARN with rule path, code, field, and message when diagnostics exist", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "backend/missing-metadata.md",
      `
id: backend.missing-metadata
source: backend-policy
domain: backend
severity: must
enforcement: inject_only
`,
      ["missing metadata policy"],
    )
    writeMalformedRule(projectDir, "clean-code/common.md")

    const summary = summarizeRuleDiagnostics(projectDir)
    const report = renderRuleDiagnosticsReport(summary)

    expect(summary.finding).toBe("WARN")
    expect(summary.ruleCount).toBe(2)
    expect(summary.diagnosticCount).toBeGreaterThan(0)
    expect(report).toContain("Finding: WARN")
    expect(report).toContain("backend/missing-metadata.md")
    expect(report).toContain("missing_required_field")
    expect(report).toContain("topic")
    expect(report).toContain("Required frontmatter field 'topic' is missing.")
    expect(report).toContain("clean-code/common.md")
    expect(report).toContain("malformed_frontmatter")
    expect(report).toContain("Frontmatter block is missing a closing marker.")
  })
})
