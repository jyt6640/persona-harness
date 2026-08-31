import { describe, expect, it } from "vitest"

import {
  HOST_CAPABILITY_IDS,
  HOST_CAPABILITY_MANIFEST_SCHEMA,
  evaluateHostAssurance,
  parseHostCapabilityManifest,
  type HostCapabilityId,
  type HostCapabilityManifest,
  type HostCapabilityState,
  type PortableHost,
} from "../src/runtime/host-capability-manifest.js"

function manifestFor(
  host: PortableHost,
  overrides: Readonly<Partial<Record<HostCapabilityId, HostCapabilityState>>> = {},
): HostCapabilityManifest {
  return {
    schemaVersion: HOST_CAPABILITY_MANIFEST_SCHEMA,
    host,
    hostVersion: "1.0.0",
    adapterVersion: "0.9.0",
    capabilities: HOST_CAPABILITY_IDS.map((id) => ({
      id,
      state: overrides[id] ?? "supported",
    })),
  }
}

function bindingFor(host: PortableHost): Readonly<Record<string, string>> {
  return {
    host,
    hostVersion: "1.0.0",
    adapterVersion: "0.9.0",
  }
}

describe("host capability manifest", () => {
  it("accepts one complete versioned manifest for every supported host", () => {
    const hosts = ["codex", "opencode", "claude-code", "antigravity"] as const

    for (const host of hosts) {
      expect(parseHostCapabilityManifest(manifestFor(host))).toMatchObject({
        kind: "ready",
        value: { host, schemaVersion: "persona-host-capability-manifest.1" },
      })
    }
  })

  it("derives enforced assurance only when every capability is directly supported", () => {
    const result = evaluateHostAssurance({
      manifest: manifestFor("codex"),
      binding: bindingFor("codex"),
      requiredAssurance: "portable",
    })

    expect(result).toEqual({
      kind: "ready",
      assurance: "enforced",
      host: "codex",
      reason: "enforcement-capabilities-supported",
    })
  })

  it("visibly degrades to portable unless the project requires enforced assurance", () => {
    const manifest = manifestFor("claude-code", {
      "activation-notice": "emulated",
      "completion-gate": "unavailable",
      "pre-tool-gate": "unavailable",
    })
    const binding = bindingFor("claude-code")

    expect(evaluateHostAssurance({ manifest, binding, requiredAssurance: "portable" })).toEqual({
      kind: "ready",
      assurance: "portable",
      host: "claude-code",
      reason: "enforcement-capabilities-unavailable",
    })
    expect(evaluateHostAssurance({ manifest, binding, requiredAssurance: "enforced" })).toEqual({
      kind: "blocked",
      code: "enforced-capability-unavailable",
    })
  })

  it("blocks when a portable capability is unavailable", () => {
    const manifest = manifestFor("antigravity", { "philosophy-injection": "unavailable" })

    expect(evaluateHostAssurance({
      manifest,
      binding: bindingFor("antigravity"),
      requiredAssurance: "portable",
    })).toEqual({ kind: "blocked", code: "portable-capability-unavailable" })
  })

  it("fails closed for schema, host, binding, capability, duplicate, and missing cases", () => {
    const valid = manifestFor("opencode")
    const rawMarker = "raw-secret-marker"
    const malformedCases: readonly unknown[] = [
      { ...valid, schemaVersion: "unknown-schema" },
      { ...valid, host: "unknown-host" },
      { ...valid, hostVersion: rawMarker },
      { ...valid, capabilities: [...valid.capabilities, { id: "unknown-capability", state: "supported" }] },
      { ...valid, capabilities: [...valid.capabilities, valid.capabilities[0]] },
      { ...valid, capabilities: valid.capabilities.slice(1) },
      {
        ...valid,
        capabilities: valid.capabilities.map((entry) => entry.id === "input-routing"
          ? { ...entry, state: "unknown-state" }
          : entry),
      },
      { ...valid, unexpected: rawMarker },
      null,
    ]

    for (const input of malformedCases) {
      const result = parseHostCapabilityManifest(input)
      expect(result.kind).toBe("blocked")
      expect(JSON.stringify(result)).not.toContain(rawMarker)
    }
  })

  it("fails closed when the evaluated host binding differs from the manifest", () => {
    expect(evaluateHostAssurance({
      manifest: manifestFor("opencode"),
      binding: { host: "opencode", hostVersion: "2.0.0", adapterVersion: "0.9.0" },
      requiredAssurance: "portable",
    })).toEqual({ kind: "blocked", code: "host-binding-mismatch" })
  })

  it("does not treat an unknown assurance requirement as portable", () => {
    expect(evaluateHostAssurance({
      manifest: manifestFor("codex"),
      binding: bindingFor("codex"),
      requiredAssurance: "unknown-assurance",
    })).toEqual({ kind: "blocked", code: "assurance-requirement-invalid" })
  })
})
