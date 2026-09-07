import { describe, expect, it } from "vitest"

import { buildContextEnvelope, type EffectiveContextResolution } from "../src/context-core/index.js"

describe("complete Context rendering budget", () => {
  it("rejects two 790-character rules whose bodies fit but complete block does not", () => {
    const envelope = envelopeFor(["a".repeat(790), "b".repeat(790)], 1_600)

    expect(envelope).toMatchObject({
      status: "blocked",
      blockReason: "budget-exceeded",
      budget: { usedChars: 1_607, usedCapsules: 2 },
      selected: [],
    })
  })

  it.each([1_606, 1_607, 1_608])("uses the exact rendered boundary at %i characters", (maxChars) => {
    const envelope = envelopeFor(["a".repeat(790), "b".repeat(790)], maxChars)

    expect(envelope.budget.usedChars).toBe(1_607)
    expect(envelope.status).toBe(maxChars < 1_607 ? "blocked" : "resolved")
    if (envelope.status === "resolved") {
      expect(envelope.selected.map((capsule) => capsule.content)).toEqual(["a".repeat(790), "b".repeat(790)])
    }
  })

  it("keeps a valid empty selection at zero rather than manufacturing a heading", () => {
    const envelope = envelopeFor([], 1)

    expect(envelope).toMatchObject({ status: "resolved", selected: [], budget: { usedChars: 0 } })
  })

  it("counts non-ASCII content as characters under the character budget, not as tokens", () => {
    const envelope = envelopeFor(["도메인 규칙", "Keep domain names explicit."], 1_600)
    const complete = "[Persona Harness Context]\n도메인 규칙\nKeep domain names explicit."

    expect(envelope.budget.usedChars).toBe(complete.length)
  })
})

function envelopeFor(contents: readonly string[], maxChars: number) {
  const resolution: EffectiveContextResolution = {
    status: "resolved",
    selected: contents.map((rule, index) => ({
      id: `rule-${index}`,
      layer: "personal",
      reason: "topic+scope",
      rule,
      topic: `topic-${index}`,
    })),
    shadowed: [],
    conflicts: [],
  }
  return buildContextEnvelope({ resolution, target: { path: "src/domain.ts" }, budget: { maxCapsules: 8, maxChars } })
}
