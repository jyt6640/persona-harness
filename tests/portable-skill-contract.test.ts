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
  HOST_CAPABILITY_IDS,
  HOST_CAPABILITY_MANIFEST_SCHEMA,
  type HostCapabilityId,
  type HostCapabilityManifest,
  type HostCapabilityState,
  type PortableHost,
} from "../src/runtime/host-capability-manifest.js"
import {
  createAntigravitySkillAdapter,
  createClaudeCodeSkillAdapter,
  createCodexSkillAdapter,
  createOpenCodeSkillAdapter,
} from "../src/runtime/portable-skill-adapters.js"

function manifestFor(
  host: PortableHost,
  overrides: Readonly<Partial<Record<HostCapabilityId, HostCapabilityState>>> = {},
): HostCapabilityManifest {
  return {
    schemaVersion: HOST_CAPABILITY_MANIFEST_SCHEMA,
    host,
    hostVersion: "1.0.0",
    adapterVersion: "0.9.0",
    capabilities: HOST_CAPABILITY_IDS.map((id) => ({ id, state: overrides[id] ?? "supported" })),
  }
}

function bindingFor(host: PortableHost): Readonly<Record<string, string>> {
  return { host, hostVersion: "1.0.0", adapterVersion: "0.9.0" }
}

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

    const routes = adapters.map((adapter) => adapter.consume({
      capsule,
      manifest: manifestFor(adapter.host),
      binding: bindingFor(adapter.host),
    }))

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

  it("fails closed for absent and malformed host manifests", () => {
    const capsule = createPortableSkillCapsule(
      activateAutomaticPersonaSkill("product-interview", "ambiguous request"),
    )
    const invalidInputs: readonly unknown[] = [
      undefined,
      null,
      { schemaVersion: "unknown" },
      ["compact-reference", "unknown-capability"],
    ]

    for (const manifest of invalidInputs) {
      const result = createOpenCodeSkillAdapter().consume({
        capsule,
        manifest,
        binding: bindingFor("opencode"),
      })
      expect(result).toMatchObject({
        status: "unsupported",
        code: "host-assurance-blocked",
        host: "opencode",
      })
      expect("capsule" in result).toBe(false)
    }
  })

  it("fails closed when a host cannot provide a required portable capability", () => {
    const capsule = createPortableSkillCapsule(
      activateAutomaticPersonaSkill("product-interview", "ambiguous request"),
    )
    const result = createOpenCodeSkillAdapter().consume({
      capsule,
      manifest: manifestFor("opencode", { "skill-discovery": "unavailable" }),
      binding: bindingFor("opencode"),
    })

    expect(result).toMatchObject({
      status: "unsupported",
      code: "host-assurance-blocked",
      host: "opencode",
    })
    expect("capsule" in result).toBe(false)
  })
})
