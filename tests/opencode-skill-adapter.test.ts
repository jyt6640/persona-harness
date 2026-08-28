import { describe, expect, it } from "vitest"

import { createOpenCodeSkillRoute } from "../src/runtime/opencode-skill-adapter.js"
import {
  readOpenCodeSharedSkillRoutingStatus,
  type OpenCodeSharedSkillRoutingConfig,
} from "../src/runtime/opencode-shared-skill-routing-status.js"

function routingConfig(
  overrides: Partial<OpenCodeSharedSkillRoutingConfig> = {},
): OpenCodeSharedSkillRoutingConfig {
  return {
    configSafe: true,
    enabled: true,
    enabledDomains: ["workflow"],
    pluginConfigured: true,
    runtimeInjection: false,
    ...overrides,
  }
}

function describedSkill(skillId: string): string {
  return [
    "---",
    `name: ${skillId}`,
    `description: Bounded ${skillId} guidance for the current request.`,
    "---",
    "",
    "# Skill",
  ].join("\n")
}

describe("OpenCode skill adapter", () => {
  it("renders ralplan as optional before the TDD handoff", () => {
    const route = createOpenCodeSkillRoute({
      decision: "activate",
      firstAction: "advisory-reference",
      skillId: "plan",
      reason: "The product and technical briefs are approved.",
    })

    expect(route).toContain("Handoff: optional ralplan, then tdd")
    expect(route).toContain("OpenCode advises and routes only")
    expect(route).not.toContain("npx ph")
  })

  it("shows a compact user-visible notice only after the adapter selects one skill", () => {
    const route = createOpenCodeSkillRoute({
      decision: "explicit",
      firstAction: "advisory-reference",
      skillId: "grill-me",
      reason: "The user explicitly requested a pressure test.",
    })

    expect(route).toContain("Decision: explicit")
    expect(route).toContain("Skill: grill-me")
    expect(route).toContain("User-visible skill notice:")
    expect(route).toContain("naming Persona Harness skill `grill-me`")
    expect(route).not.toContain("# Decision Grill")
  })

  it("distinguishes a host-described catalog from automatic routing and unobserved session selection", () => {
    const status = readOpenCodeSharedSkillRoutingStatus(routingConfig({ runtimeInjection: true }))

    expect(status).toEqual({
      adapterReachability: "unobserved",
      automaticRoute: "configured",
      hostDelivery: "unobserved",
      hostSelection: "unobserved",
      nativeCatalog: {
        describedSkillCount: 17,
        skillCount: 17,
        state: "ready",
      },
      schemaVersion: "opencode-shared-skill-routing-status.1",
    })
  })

  it("fails closed for malformed or unavailable native-skill metadata", () => {
    const malformed = readOpenCodeSharedSkillRoutingStatus(routingConfig({ runtimeInjection: true }), {
      readSkill: (skillId) => skillId === "programming"
        ? "---\nname: programming\n---\n\n# Programming\n"
        : describedSkill(skillId),
    })
    const unavailable = readOpenCodeSharedSkillRoutingStatus(routingConfig(), {
      readSkill: () => {
        throw new Error("fixture source was unavailable")
      },
    })
    const catalogUnavailable = readOpenCodeSharedSkillRoutingStatus(routingConfig(), {
      listSkills: () => {
        throw new Error("fixture catalog was unavailable")
      },
    })

    expect(malformed.nativeCatalog).toEqual({
      describedSkillCount: 16,
      skillCount: 17,
      state: "invalid",
    })
    expect(malformed.automaticRoute).toBe("unavailable")
    expect(malformed.hostSelection).toBe("unobserved")
    expect(unavailable.nativeCatalog).toEqual({
      describedSkillCount: 0,
      skillCount: 17,
      state: "unavailable",
    })
    expect(unavailable.automaticRoute).toBe("unavailable")
    expect(catalogUnavailable.nativeCatalog).toEqual({
      describedSkillCount: 0,
      skillCount: 0,
      state: "unavailable",
    })
    expect(catalogUnavailable.automaticRoute).toBe("unavailable")
  })

  it("keeps automatic advisory routing disabled unless configuration and an automatic routing domain both allow it", () => {
    const runtimeDisabled = readOpenCodeSharedSkillRoutingStatus(routingConfig())
    const workflowDisabled = readOpenCodeSharedSkillRoutingStatus(routingConfig({
      enabledDomains: ["programming"],
      runtimeInjection: true,
    }))
    const productEnabled = readOpenCodeSharedSkillRoutingStatus(routingConfig({
      enabledDomains: ["product"],
      runtimeInjection: true,
    }))
    const unsafeConfig = readOpenCodeSharedSkillRoutingStatus(routingConfig({
      configSafe: false,
      runtimeInjection: true,
    }))
    const pluginUnavailable = readOpenCodeSharedSkillRoutingStatus(routingConfig({
      pluginConfigured: false,
      runtimeInjection: true,
    }))

    expect(runtimeDisabled.automaticRoute).toBe("disabled")
    expect(workflowDisabled.automaticRoute).toBe("disabled")
    expect(productEnabled.automaticRoute).toBe("configured")
    expect(unsafeConfig.automaticRoute).toBe("unavailable")
    expect(pluginUnavailable.automaticRoute).toBe("unavailable")
    expect(runtimeDisabled.hostSelection).toBe("unobserved")
  })
})
