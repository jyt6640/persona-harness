import { afterEach, describe, expect, it } from "vitest"

import { loadRuleCatalog } from "../src/rules/rule-catalog.js"
import { cleanupProjects, createProject, eligible, findEntry, writeRule } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

describe("Phase 1.1 rule glob matching", () => {
  it("rejects glob mismatches and accepts Controller, Test, and DTO glob matches", () => {
    const projectDir = createProject()
    writeRule(
      projectDir,
      "backend/glob-check.md",
      `
id: backend.glob-check
globs:
  - "**/*Controller.java"
  - "**/*Test.java"
  - "**/*Request.java"
  - "**/*Response.java"
`,
      ["glob policy"],
    )

    const globRule = findEntry(loadRuleCatalog(projectDir), "backend/glob-check.md")

    expect(eligible(globRule, "controller", "step1", "src/main/java/com/example/ReservationController.java")).toBe(
      true,
    )
    expect(eligible(globRule, "test", "step1", "src/test/java/com/example/ReservationControllerTest.java")).toBe(true)
    expect(eligible(globRule, "request-dto", "step1", "src/main/java/com/example/dto/ReservationRequest.java")).toBe(
      true,
    )
    expect(eligible(globRule, "response-dto", "step1", "src/main/java/com/example/dto/ReservationResponse.java")).toBe(
      true,
    )
    expect(eligible(globRule, "service", "step1", "src/main/java/com/example/ReservationService.java")).toBe(false)
  })
})
