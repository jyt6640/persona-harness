import { afterEach, describe, expect, it } from "vitest"

import { loadRuleCatalog } from "../src/phase0/rule-catalog.js"
import { loadRulesForRole } from "../src/phase0/rule-loader.js"
import { cleanupProjects, createProject, eligible, findEntry, writeRule, writeScenario } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

describe("Phase 1.1 rule catalog scenario selection", () => {
  it("matches scenario frontmatter only for its active scenario", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "backend/step1-api-contract.md",
      `
id: backend.step1.api-contract
scenario: step1
globs:
  - "**/*Controller.java"
`,
      ["step1 policy"],
    )
    writeRule(
      projectDir,
      "backend/step2-3-api-contract.md",
      `
id: backend.step2-3.api-contract
scenario: step2-3
globs:
  - "**/*Controller.java"
`,
      ["step2-3 policy"],
    )

    const catalog = loadRuleCatalog(projectDir)
    const step1Rule = findEntry(catalog, "backend/step1-api-contract.md")
    const step23Rule = findEntry(catalog, "backend/step2-3-api-contract.md")
    const targetPath = "src/main/java/roomescape/ReservationController.java"

    expect(eligible(step1Rule, "controller", "step1", targetPath)).toBe(true)
    expect(eligible(step1Rule, "controller", "step2-3", targetPath)).toBe(false)
    expect(eligible(step23Rule, "controller", "step2-3", targetPath)).toBe(true)
    expect(eligible(step23Rule, "controller", "step1", targetPath)).toBe(false)
  })

  it("does not select the other scenario contract rule through loadRulesForRole", () => {
    const projectDir = createProject()
    writeScenario(projectDir, "step1")
    writeRule(
      projectDir,
      "backend/step1-api-contract.md",
      `
id: backend.step1.api-contract
scenario: step1
globs:
  - "**/*Controller.java"
`,
      ["step1 policy"],
    )
    writeRule(
      projectDir,
      "backend/step2-3-api-contract.md",
      `
id: backend.step2-3.api-contract
scenario: step2-3
globs:
  - "**/*Controller.java"
`,
      ["step2-3 policy"],
    )

    const selectedRules = loadRulesForRole(
      projectDir,
      "controller",
      "src/main/java/roomescape/ReservationController.java",
    ).map((rule) => rule.path)

    expect(selectedRules).toContain("backend/step1-api-contract.md")
    expect(selectedRules).not.toContain("backend/step2-3-api-contract.md")
  })

  it("keeps common rules without scenario eligible for every scenario", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "clean-code/common.md",
      `
id: clean-code.common
globs:
  - "**/*.java"
`,
      ["common policy"],
    )

    const commonRule = findEntry(loadRuleCatalog(projectDir), "clean-code/common.md")
    const targetPath = "src/main/java/com/example/ReservationService.java"

    expect(eligible(commonRule, "service", "step1", targetPath)).toBe(true)
    expect(eligible(commonRule, "service", "step2-3", targetPath)).toBe(true)
  })
})
