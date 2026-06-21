import { mkdirSync } from "node:fs"
import { join } from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadRulesForRole } from "../src/phase0/rule-loader.js"
import { cleanupProjects, createProject } from "./helpers/rule-fixtures.js"

afterEach(cleanupProjects)

describe("Phase 1.1 rule catalog fallback", () => {
  it("keeps fallback order when .persona/rules is missing or empty", () => {
    const missingRulesProject = createProject()
    const emptyRulesProject = createProject()
    mkdirSync(join(emptyRulesProject, ".persona", "rules"), { recursive: true })

    const expectedCleanControllerOrder = [
      "clean-code/common.md",
      "clean-code/method-design.md",
      "backend/java-common.md",
      "backend/spring-controller.md",
      "backend/spring-dto.md",
    ]
    const expectedRoomescapeControllerOrder = [
      ...expectedCleanControllerOrder,
      "backend/step1-api-contract.md",
    ]

    expect(loadRulesForRole(missingRulesProject, "controller").map((rule) => rule.path)).toEqual(expectedCleanControllerOrder)
    expect(loadRulesForRole(emptyRulesProject, "controller").map((rule) => rule.path)).toEqual(expectedCleanControllerOrder)
    expect(
      loadRulesForRole(missingRulesProject, "controller", "src/main/java/roomescape/ReservationController.java").map(
        (rule) => rule.path,
      ),
    ).toEqual(expectedRoomescapeControllerOrder)
  })
})
