import { describe, expect, it } from "vitest"

import { createOpenCodeSkillRoute } from "../src/runtime/opencode-skill-adapter.js"

describe("OpenCode skill adapter", () => {
  it("renders ralplan as optional before the TDD handoff", () => {
    const route = createOpenCodeSkillRoute({
      decision: "suggest",
      skillId: "plan",
      reason: "The product and technical briefs are approved.",
    })

    expect(route).toContain("Handoff: optional ralplan, then tdd")
    expect(route).toContain("OpenCode advises and routes only")
    expect(route).not.toContain("npx ph")
  })
})
