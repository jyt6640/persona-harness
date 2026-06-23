import { afterEach, describe, expect, it } from "vitest"

import { loadRuleCatalog, targetPathForMatching } from "../src/rules/rule-catalog.js"
import { createInjectionBlock } from "../src/runtime/injection.js"
import { loadRulesForRole } from "../src/rules/rule-loader.js"
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
  it("parses the canonical rule metadata fields used by .persona/rules", () => {
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

    const controllerRule = findEntry(loadRuleCatalog(projectDir), "backend/spring-controller.md")

    expect(controllerRule.diagnostics).toEqual([])
    expect(controllerRule.metadata.id).toBe("backend.spring.controller")
    expect(controllerRule.metadata.source).toBe("backend-policy")
    expect(controllerRule.metadata.domain).toBe("backend")
    expect(controllerRule.metadata.topic).toBe("controller-responsibility")
    expect(controllerRule.metadata.severity).toBe("must")
    expect(controllerRule.metadata.enforcement).toBe("inject_only")
  })

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

    expect(commonRule.diagnostics).toContainEqual({
      code: "malformed_frontmatter",
      message: "Frontmatter block is missing a closing marker.",
    })
    expect(eligible(commonRule, "controller", "step1", targetPath)).toBe(true)
    expect(selectedRules).toContain("clean-code/common.md")
  })

  it("records diagnostics for missing required topic and globs without crashing catalog loading", () => {
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

    const catalog = loadRuleCatalog(projectDir)
    const missingMetadataRule = findEntry(catalog, "backend/missing-metadata.md")
    const controllerRule = findEntry(catalog, "backend/spring-controller.md")

    expect(catalog.map((entry) => entry.path)).toContain("backend/missing-metadata.md")
    expect(missingMetadataRule.diagnostics).toContainEqual({
      code: "missing_required_field",
      field: "topic",
      message: "Required frontmatter field 'topic' is missing.",
    })
    expect(missingMetadataRule.diagnostics).toContainEqual({
      code: "missing_required_field",
      field: "globs",
      message: "Required frontmatter field 'globs' is missing.",
    })
    expect(controllerRule.diagnostics).toEqual([])
  })

  it("records diagnostics for unsupported enum values without blocking rule loading", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "backend/invalid-enums.md",
      `
id: backend.invalid-enums
source: imported
domain: mobile
topic: controller-responsibility
globs:
  - "**/*Controller.java"
scenario: tomorrow
severity: critical
enforcement: block
`,
      ["invalid enum policy"],
    )

    const invalidRule = findEntry(loadRuleCatalog(projectDir), "backend/invalid-enums.md")

    expect(invalidRule.metadata.id).toBe("backend.invalid-enums")
    expect(invalidRule.diagnostics).toEqual([
      {
        code: "invalid_enum_value",
        field: "source",
        message: "Unsupported frontmatter value for 'source': imported.",
      },
      {
        code: "invalid_enum_value",
        field: "domain",
        message: "Unsupported frontmatter value for 'domain': mobile.",
      },
      {
        code: "invalid_enum_value",
        field: "scenario",
        message: "Unsupported frontmatter value for 'scenario': tomorrow.",
      },
      {
        code: "invalid_enum_value",
        field: "severity",
        message: "Unsupported frontmatter value for 'severity': critical.",
      },
      {
        code: "invalid_enum_value",
        field: "enforcement",
        message: "Unsupported frontmatter value for 'enforcement': block.",
      },
    ])
  })

  it("records selected rule metadata without changing selectedRules path shape", () => {
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
`,
      ["controller policy"],
    )

    const injection = createInjectionBlock("src/main/java/com/example/ReservationController.java", projectDir)
    const controllerMetadata = injection.selectedRuleMetadata.find(
      (metadata) => metadata.path === "backend/spring-controller.md",
    )

    expect(injection.selectedRules).toContain("backend/spring-controller.md")
    expect(controllerMetadata).toMatchObject({
      path: "backend/spring-controller.md",
      id: "backend.spring.controller",
      source: "backend-policy",
      domain: "backend",
      topic: "controller-responsibility",
      severity: "must",
    })
  })
})
