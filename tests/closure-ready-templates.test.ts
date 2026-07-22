import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const issueTemplates = [
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
  ".github/ISSUE_TEMPLATE/maintenance.yml",
] as const

describe("closure-ready repository templates", () => {
  it("requires every issue category to state its close condition, full boundary, fail-closed case, and evidence residual", () => {
    for (const templatePath of issueTemplates) {
      const template = readFileSync(join(root, templatePath), "utf8")

      expect(template).toContain("id: close_condition")
      expect(template).toContain("id: full_boundary")
      expect(template).toContain("id: independent_evidence")
      expect(template).toContain("fail-closed")
      expect(template).toContain("hosted-only")
    }
  })

  it("requires PRs to carry issue linkage, closure proof, residual, External decision, and remaining implementation", () => {
    const githubEntries = readdirSync(join(root, ".github"))

    expect(githubEntries).toContain("PULL_REQUEST_TEMPLATE.md")
    expect(githubEntries).not.toContain("pull_request_template.md")

    const template = readFileSync(join(root, ".github/PULL_REQUEST_TEMPLATE.md"), "utf8")

    expect(template).toContain("Closes #")
    expect(template).toContain("## Closure readiness")
    expect(template).toContain("fail-closed")
    expect(template).toContain("hosted-only residual")
    expect(template).toContain("## External decision")
    expect(template).toContain("## Further implementation")
  })
})
