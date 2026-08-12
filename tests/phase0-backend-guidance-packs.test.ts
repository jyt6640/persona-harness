import { cpSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadHarnessConfig, loadHarnessConfigResult } from "../src/config/harness-config.js"
import { selectRulesForDelivery } from "../src/rules/rule-delivery.js"
import { loadRulesForRole } from "../src/rules/rule-loader.js"
import { cleanupProjects, createProject, writeHarnessConfig } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

function copyPackagedRules(projectDir: string): void {
  cpSync(join(process.cwd(), ".persona", "rules"), join(projectDir, ".persona", "rules"), { recursive: true })
}

describe("Java backend guidance packs", () => {
  it("keeps JDBC selection explicit without adding JPA or global error defaults", () => {
    const projectDir = createProject()
    copyPackagedRules(projectDir)
    writeHarnessConfig(projectDir, { backendPacks: ["persistence-jdbc"] })

    const selectedRules = loadRulesForRole(
      projectDir,
      "repository",
      "src/main/java/example/domain/BookRepository.java",
    ).map((rule) => rule.path)

    expect(selectedRules).toContain("backend/packs/persistence-jdbc.md")
    expect(selectedRules).not.toContain("backend/packs/persistence-jpa.md")
    expect(selectedRules).not.toContain("backend/packs/error-contract-global.md")
  })

  it("loads only the conditional packs explicitly named by configuration", () => {
    const projectDir = createProject()
    copyPackagedRules(projectDir)
    writeHarnessConfig(projectDir, { backendPacks: ["testing-direct-class", "testing-gwt"] })

    const selectedRules = loadRulesForRole(
      projectDir,
      "test",
      "src/test/java/example/BookTest.java",
    ).map((rule) => rule.path)

    expect(selectedRules).toContain("backend/packs/testing-direct-class.md")
    expect(selectedRules).toContain("backend/packs/testing-gwt.md")
    expect(selectedRules).not.toContain("backend/packs/persistence-jpa.md")
  })

  it("delivers a conditional pack only after the same explicit selection", () => {
    const projectDir = createProject()
    copyPackagedRules(projectDir)

    const defaultDelivery = selectRulesForDelivery(projectDir, "implementer")
    expect(defaultDelivery.rules.some((rule) => rule.path.startsWith("backend/packs/"))).toBe(false)

    writeHarnessConfig(projectDir, { backendPacks: ["persistence-jdbc"] })
    const selectedDelivery = selectRulesForDelivery(projectDir, "implementer")
    expect(selectedDelivery.rules.map((rule) => rule.path)).toContain("backend/packs/persistence-jdbc.md")
    expect(selectedDelivery.rules.map((rule) => rule.path)).not.toContain("backend/packs/persistence-jpa.md")
  })

  it("rejects an unknown conditional pack before rule loading", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { backendPacks: ["persistence-jpa", "unreviewed-pack"] })

    const result = loadHarnessConfigResult(projectDir)

    expect(result.safe).toBe(false)
    expect(loadRulesForRole(projectDir, "entity")).toEqual([])
  })

  it("keeps runtime injection disabled when a pack is configured", () => {
    const projectDir = createProject()
    writeHarnessConfig(projectDir, { backendPacks: ["persistence-jpa"] })

    const config = loadHarnessConfig(projectDir)

    expect(config.features.runtimeInjection).toBe(false)
    expect(config.backendPacks).toEqual(["persistence-jpa"])
  })
})
