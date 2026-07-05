import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import { describe, expect, it, afterEach } from "vitest"

import {
  rederiveDeliveredRulePaths,
  ruleDeliveryRoleForBlocker,
  ruleDeliveryRoleForWorkText,
  rulePackContentHash,
  selectRulesForDelivery,
} from "../src/rules/rule-delivery.js"
import { summarizeConventionPackDiagnostics } from "../src/cli/convention-pack-diagnostics.js"
import { loadRuleCatalog } from "../src/rules/rule-catalog.js"
import {
  cleanupProjects,
  createProject,
  writeHarnessConfig,
  writeRule,
} from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

const DIFF_RULE_DELIVERY_ONLY_RULES = [
  { path: "diff-rules/architecture/index.md", roles: ["main"] },
  { path: "diff-rules/decisions/README.md", roles: ["main"] },
  { path: "diff-rules/decisions/accepted/domain-validation-over-getter.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/accepted/exception-hierarchy.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/accepted/explicit-over-reuse.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/accepted/fake-over-mock-in-service-test.md", roles: ["test-writer"] },
  { path: "diff-rules/decisions/accepted/policy-object-separation.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/accepted/service-orchestration-only.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/pending/aggregate-boundary.md", roles: ["main", "implementer"] },
  { path: "diff-rules/decisions/pending/domain-entity-separation.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/pending/event-driven-boundary.md", roles: ["main"] },
  { path: "diff-rules/decisions/pending/fake-package-location.md", roles: ["test-writer"] },
  { path: "diff-rules/decisions/pending/security-auth-pattern.md", roles: ["main"] },
  { path: "diff-rules/decisions/pending/validator-package-location.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/rejected/anemic-domain-model.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/rejected/overuse-of-builder-pattern.md", roles: ["implementer"] },
  { path: "diff-rules/decisions/rejected/service-layer-business-logic.md", roles: ["implementer", "reviewer"] },
  { path: "diff-rules/principles/architecture-evolution.md", roles: ["main"] },
  { path: "diff-rules/principles/exceptions.md", roles: ["implementer"] },
  { path: "diff-rules/principles/index.md", roles: ["main"] },
  { path: "diff-rules/principles/naming.md", roles: ["implementer"] },
  { path: "diff-rules/principles/oop.md", roles: ["implementer", "reviewer"] },
  { path: "diff-rules/workflow/code-review.md", roles: ["reviewer"] },
  { path: "diff-rules/workflow/git-convention.md", roles: ["main"] },
  { path: "diff-rules/workflow/how-to-add-new-feature.md", roles: ["main", "test-writer", "implementer"] },
  { path: "diff-rules/workflow/how-to-review-legacy-code.md", roles: ["reviewer"] },
  { path: "diff-rules/workflow/index.md", roles: ["main"] },
  { path: "diff-rules/workflow/refactoring.md", roles: ["implementer", "reviewer"] },
] as const

const DIFF_RULE_DUPLICATE_PATHS = [
  "diff-rules/architecture/layered-architecture.md",
  "diff-rules/decisions/accepted/domain-first-testing.md",
  "diff-rules/decisions/accepted/public-behavior-based-tdd.md",
  "diff-rules/principles/method-design.md",
  "diff-rules/principles/testing.md",
  "diff-rules/workflow/tdd.md",
] as const

function copyProjectRule(projectDir: string, rulePath: string): void {
  const sourcePath = join(process.cwd(), ".persona", "rules", rulePath)
  const targetPath = join(projectDir, ".persona", "rules", rulePath)
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(targetPath, readFileSync(sourcePath, "utf8"))
}

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

  it("loads delivery-only diff rules with clean diagnostics and scoped roles", () => {
    const catalog = loadRuleCatalog(process.cwd())

    for (const expectedRule of DIFF_RULE_DELIVERY_ONLY_RULES) {
      const entry = catalog.find((candidate) => candidate.path === expectedRule.path)

      expect(entry?.diagnostics).toEqual([])
      expect(entry?.metadata.roles).toEqual(expectedRule.roles)
      expect(entry?.metadata.enforcement).toBe("inject_only")
    }
  })

  it("preserves rejected diff-rule patterns and reasons as negative examples", () => {
    const markdown = readFileSync(
      join(process.cwd(), ".persona", "rules", "diff-rules", "decisions", "rejected", "anemic-domain-model.md"),
      "utf8",
    )

    expect(markdown).toContain("## 상태\n\nrejected")
    expect(markdown).toContain("## 선택 이유")
    expect(markdown).toContain("지양하는 예시")
    expect(markdown).toContain("if (order.getStatus() == ...)")
  })

  it("delivers migrated diff rules through hash rederivation", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { maxRulesPerInjection: 20 })
    copyProjectRule(projectDir, "diff-rules/decisions/rejected/anemic-domain-model.md")

    const delivery = selectRulesForDelivery(projectDir, "implementer")
    const result = rederiveDeliveredRulePaths(projectDir, "implementer", delivery.rulePackHash)

    expect(delivery.rules.map((rule) => rule.path)).toEqual([
      "diff-rules/decisions/rejected/anemic-domain-model.md",
    ])
    expect(result).toEqual({
      kind: "matched",
      role: "implementer",
      rulePackHash: delivery.rulePackHash,
      rulePaths: ["diff-rules/decisions/rejected/anemic-domain-model.md"],
    })
  })

  it("deduplicates overlapping diff rules into existing PH rule surfaces", () => {
    const catalog = loadRuleCatalog(process.cwd())
    const catalogPaths = catalog.map((entry) => entry.path)

    for (const duplicatePath of DIFF_RULE_DUPLICATE_PATHS) {
      expect(catalogPaths).not.toContain(duplicatePath)
    }

    const layeredArchitecture = readFileSync(
      join(process.cwd(), ".persona", "rules", "backend", "layered-architecture.md"),
      "utf8",
    )
    const springTest = readFileSync(join(process.cwd(), ".persona", "rules", "backend", "spring-test.md"), "utf8")
    const methodDesign = readFileSync(
      join(process.cwd(), ".persona", "rules", "clean-code", "method-design.md"),
      "utf8",
    )

    expect(layeredArchitecture).toContain("Request DTO를 Application Command/Query로 변환한다")
    expect(layeredArchitecture).toContain("Infrastructure는 Repository 인터페이스를 구현한다")
    expect(springTest).toContain("Domain public behavior 테스트부터")
    expect(springTest).toContain("Acceptance Test는 마지막 전체 시나리오 검증으로만 사용한다")
    expect(methodDesign).toContain("validateAndCancel")
    expect(methodDesign).toContain("boolean 파라미터")
  })
})
