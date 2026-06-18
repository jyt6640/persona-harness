import { afterEach, describe, expect, it } from "vitest"

import { loadRuleCatalog, targetPathForMatching } from "../src/phase0/rule-catalog.js"
import { createInjectionBlock } from "../src/phase0/injection.js"
import { loadRulesForRole } from "../src/phase0/rule-loader.js"
import {
  cleanupProjects,
  createProject,
  eligible,
  findEntry,
  writeMalformedRule,
  writeRule,
} from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

describe("Phase 1.1 rule frontmatter behavior", () => {
  it("limits injected policy bullets when max_bullets is present", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "backend/spring-controller.md",
      `
id: backend.spring.controller
globs:
  - "**/*Controller.java"
max_bullets: 1
`,
      ["first controller policy", "second controller policy"],
    )

    const injection = createInjectionBlock("src/main/java/com/example/ReservationController.java", projectDir)

    expect(injection.selectedRules).toContain("backend/spring-controller.md")
    expect(injection.policies).toContain("first controller policy")
    expect(injection.policies).not.toContain("second controller policy")
  })

  it("loads malformed frontmatter without breaking the loader", () => {
    const projectDir = createProject()
    writeMalformedRule(projectDir, "clean-code/common.md")

    const targetPath = targetPathForMatching(
      projectDir,
      "controller",
      "src/main/java/com/example/ReservationController.java",
    )
    const commonRule = findEntry(loadRuleCatalog(projectDir), "clean-code/common.md")
    const selectedRules = loadRulesForRole(
      projectDir,
      "controller",
      "src/main/java/com/example/ReservationController.java",
    ).map((rule) => rule.path)

    expect(eligible(commonRule, "controller", "step1", targetPath)).toBe(true)
    expect(selectedRules).toContain("clean-code/common.md")
  })
})
