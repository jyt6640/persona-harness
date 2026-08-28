import { describe, expect, it } from "vitest"

import {
  buildContextEnvelope,
  canonicalContextDigest,
  resolveEffectiveContext,
} from "../src/context-core/index.js"

describe("host-neutral Context Envelope", () => {
  it("builds a stable digest, capsule provenance, and budget from a resolved Core result", () => {
    const resolution = resolveEffectiveContext({
      commonDefaults: [rule("common", "style", "Keep naming explicit.")],
      languageDefaults: [],
      personalRules: [],
      productInvariants: [rule("invariant", "safety", "Do not weaken access controls.")],
      projectContracts: [],
      relevance: relevance(["safety", "style"]),
      taskDecisions: [],
      teamContracts: [],
    })
    const first = buildContextEnvelope({
      resolution,
      target: { fileRole: "service", language: "typescript", path: "src/auth/service.ts" },
    })
    const second = buildContextEnvelope({
      target: { path: "src/auth/service.ts", language: "typescript", fileRole: "service" },
      resolution,
    })

    expect(first).toMatchObject({ schemaVersion: "persona-context-envelope.v1", status: "resolved" })
    if (first.status !== "resolved") return
    expect(first.selected).toEqual([
      {
        content: "Do not weaken access controls.",
        contentDigest: canonicalContextDigest("Do not weaken access controls."),
        id: "invariant",
        layer: "invariant",
        reason: "topic+scope",
        topic: "safety",
      },
      {
        content: "Keep naming explicit.",
        contentDigest: canonicalContextDigest("Keep naming explicit."),
        id: "common",
        layer: "common",
        reason: "topic+scope",
        topic: "style",
      },
    ])
    expect(first.budget).toEqual({ maxCapsules: 8, maxChars: 1_600, usedCapsules: 2, usedChars: 51 })
    expect(first.digest).toBe(second.digest)
    expect(first.digest).toMatch(/^[0-9a-f]{64}$/u)
  })

  it("blocks before rendering when the envelope budget would overflow", () => {
    const result = buildContextEnvelope({
      budget: { maxCapsules: 1, maxChars: 1_600 },
      resolution: resolveEffectiveContext({
        commonDefaults: [rule("one", "one", "One"), rule("two", "two", "Two")],
        languageDefaults: [],
        personalRules: [],
        productInvariants: [],
        projectContracts: [],
        relevance: relevance(["one", "two"]),
        taskDecisions: [],
        teamContracts: [],
      }),
      target: { path: "src/example.ts" },
    })

    expect(result).toMatchObject({
      blockReason: "budget-exceeded",
      budget: { maxCapsules: 1, maxChars: 1_600, usedCapsules: 2, usedChars: 6 },
      selected: [],
      status: "blocked",
    })
  })

  it("preserves bounded conflict provenance without treating a blocked result as resolved", () => {
    const result = buildContextEnvelope({
      resolution: resolveEffectiveContext({
        commonDefaults: [],
        languageDefaults: [],
        personalRules: [],
        productInvariants: [],
        projectContracts: [rule("first", "architecture", "First"), rule("second", "architecture", "Second")],
        relevance: relevance(["architecture"]),
        taskDecisions: [],
        teamContracts: [],
      }),
      target: { path: "src/example.ts" },
    })

    expect(result).toEqual(expect.objectContaining({
      blockReason: "resolution-blocked",
      conflicts: [{ reason: "same-layer-conflict", ruleIds: ["first", "second"], topic: "architecture" }],
      selected: [],
      shadowed: [],
      status: "blocked",
    }))
  })

  it("fails closed without reflecting unsafe targets or selected content", () => {
    const invalidTarget = buildContextEnvelope({
      resolution: emptyResolution(),
      target: { path: "/Users/private/secret.ts" },
    })
    expect(invalidTarget).toMatchObject({ blockReason: "malformed-input", status: "blocked", target: { path: "unavailable" } })

    const unsafeContent = buildContextEnvelope({
      resolution: {
        conflicts: [],
        selected: [{ id: "unsafe", layer: "common", reason: "topic+scope", rule: "https://example.test/collect", topic: "style" }],
        shadowed: [],
        status: "resolved",
      },
      target: { path: "src/example.ts" },
    })
    expect(unsafeContent).toMatchObject({ blockReason: "unsafe-content", selected: [], status: "blocked" })
    expect(JSON.stringify(unsafeContent)).not.toContain("example.test")
  })
})

function relevance(topics: readonly string[]) {
  return { fileRole: "service", language: "typescript", skillIds: ["programming"], topics }
}

function rule(id: string, topic: string, content: string) {
  return { id, rule: content, status: "active", topic }
}

function emptyResolution() {
  return { conflicts: [], selected: [], shadowed: [], status: "resolved" }
}
