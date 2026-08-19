import { describe, expect, it } from "vitest"

import {
  activateAutomaticPersonaSkill,
  activateExplicitPersonaSkill,
} from "../src/runtime/persona-shared-skill-activation.js"
import {
  PORTABLE_HOSTS,
  createPortableSkillCapsule,
} from "../src/runtime/portable-skill-contract.js"
import {
  createAntigravitySkillAdapter,
  createClaudeCodeSkillAdapter,
  createCodexSkillAdapter,
  createOpenCodeSkillAdapter,
} from "../src/runtime/portable-skill-adapters.js"

describe("portable shared-skill contract", () => {
  it("builds a versioned metadata capsule from an existing activation", () => {
    const activation = activateAutomaticPersonaSkill(
      "product-interview",
      "raw prompt with credential-shaped content",
      "new-product",
    )

    const capsule = createPortableSkillCapsule(activation)

    expect(capsule).toMatchObject({
      contractVersion: "persona-portable-skill-contract.1",
      capsuleVersion: "persona-skill-capsule.1",
      skillId: "deep-interview",
      decision: "automatic",
      firstAction: "one-question-product-interview",
      reasonCode: "ambiguous-product",
    })
    expect(capsule.inputSchema.length).toBeGreaterThan(0)
    expect(capsule.outputSchema.length).toBeGreaterThan(0)
    expect(capsule.requiredCapabilities).toContain("one-question")
    expect(JSON.stringify(capsule)).not.toContain("raw prompt with credential-shaped content")
  })

  it("lets every supported host consume the same capsule without changing selection", () => {
    const capsule = createPortableSkillCapsule(
      activateExplicitPersonaSkill("frontend", "explicit optional overlay"),
    )
    const adapters = [
      createCodexSkillAdapter(),
      createOpenCodeSkillAdapter(),
      createClaudeCodeSkillAdapter(),
      createAntigravitySkillAdapter(),
    ] as const

    const routes = adapters.map((adapter) => adapter.consume({ capsule }))

    expect(routes.map((route) => route.host)).toEqual([...PORTABLE_HOSTS])
    expect(routes.every((route) => route.status === "ready")).toBe(true)
    for (const route of routes) {
      if (route.status !== "ready") {
        continue
      }
      expect(route.capsule.skillId).toBe("frontend")
      expect(route.capsule.requiredCapabilities).toContain("optional-overlay")
    }
  })

  it("fails closed when a host cannot provide a required capability", () => {
    const capsule = createPortableSkillCapsule(
      activateAutomaticPersonaSkill("product-interview", "ambiguous request"),
    )
    const result = createOpenCodeSkillAdapter().consume({
      capsule,
      capabilities: ["compact-reference", "structured-handoff"],
    })

    expect(result).toMatchObject({
      status: "unsupported",
      code: "unsupported-capability",
      host: "opencode",
    })
    expect("capsule" in result).toBe(false)
  })
})
