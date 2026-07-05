import { describe, expect, it, afterEach } from "vitest"

import {
  rederiveDeliveredRulePaths,
  ruleDeliveryRoleForBlocker,
  ruleDeliveryRoleForWorkText,
  rulePackContentHash,
  selectRulesForDelivery,
} from "../src/rules/rule-delivery.js"
import { summarizeConventionPackDiagnostics } from "../src/cli/convention-pack-diagnostics.js"
import {
  cleanupProjects,
  createProject,
  writeHarnessConfig,
  writeRule,
} from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

describe("role-scoped rule delivery", () => {
  it("selects only matching frontmatter roles within the maxRulesPerInjection budget", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { maxRulesPerInjection: 1 })
    writeRule(
      projectDir,
      "backend/implementer-first.md",
      `
id: backend.implementer-first
source: backend-policy
domain: backend
topic: implementation
roles:
  - implementer
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
`,
      ["implementer first policy", "implementer second policy"],
    )
    writeRule(
      projectDir,
      "backend/implementer-second.md",
      `
id: backend.implementer-second
source: backend-policy
domain: backend
topic: implementation-extra
roles:
  - implementer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
`,
      ["implementer extra policy"],
    )
    writeRule(
      projectDir,
      "backend/reviewer-only.md",
      `
id: backend.reviewer-only
source: backend-policy
domain: backend
topic: review
roles:
  - reviewer
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
`,
      ["reviewer policy"],
    )

    const delivery = selectRulesForDelivery(projectDir, "implementer")

    expect(delivery.role).toBe("implementer")
    expect(delivery.rulePackHash).toMatch(/^sha256:[a-f0-9]{64}$/u)
    expect(delivery.rules.map((rule) => rule.path)).toEqual(["backend/implementer-first.md"])
    expect(delivery.rules[0]?.policies).toEqual(["implementer first policy", "implementer second policy"])
    expect(delivery.ruleCount).toBe(1)
    expect(delivery.estimatedTokens).toBeGreaterThan(0)
  })

  it("rederives delivered rule paths from the current hash and role", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "backend/test-writer.md",
      `
id: backend.test-writer
source: backend-policy
domain: backend
topic: tests
roles:
  - test-writer
globs:
  - "**/*.java"
severity: must
enforcement: inject_only
`,
      ["test policy"],
    )

    const hash = rulePackContentHash(projectDir)
    const result = rederiveDeliveredRulePaths(projectDir, "test-writer", hash)

    expect(result).toEqual({
      kind: "matched",
      role: "test-writer",
      rulePackHash: hash,
      rulePaths: ["backend/test-writer.md"],
    })
  })

  it("maps blocker and ticket work text to scoped delivery roles without changing gate behavior", () => {
    expect(ruleDeliveryRoleForBlocker("verification-failed")).toBe("test-writer")
    expect(ruleDeliveryRoleForBlocker("review-report-missing")).toBe("reviewer")
    expect(ruleDeliveryRoleForBlocker("implementation-report-missing")).toBe("implementer")
    expect(ruleDeliveryRoleForWorkText("Add controller tests for the API")).toBe("test-writer")
    expect(ruleDeliveryRoleForWorkText("Review the completed slice")).toBe("reviewer")
    expect(ruleDeliveryRoleForWorkText("Implement task CRUD")).toBe("implementer")
  })

  it("keeps clean rule and convention diagnostics report-only", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "backend/clean.md",
      `
id: backend.clean
source: backend-policy
domain: backend
topic: clean
roles:
  - main
globs:
  - "**/*.java"
severity: should
enforcement: inject_only
`,
      ["clean policy"],
    )

    const delivery = selectRulesForDelivery(projectDir, "main")
    const conventions = summarizeConventionPackDiagnostics(projectDir)

    expect(delivery.diagnostics).toEqual([])
    expect(conventions.finding).toBe("PASS")
  })
})
