import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import {
  CONTEXT_COMPARISON_RESULT_SCHEMA,
  evaluateContextComparison,
} from "../src/context-comparison/index.js"
import type { ContextComparisonRecord, ContextComparisonResult } from "../src/context-comparison/index.js"

const repositoryRoot = resolve(process.cwd())

describe("Context three-arm comparison", () => {
  it("evaluates the complete ten-fixture corpus across OFF, legacy broad, and targeted layered arms", () => {
    const result = evaluateContextComparison(loadManifest(), candidate())

    expect(result.status).toBe("ready")
    if (result.status !== "ready") return

    expect(result.schemaVersion).toBe(CONTEXT_COMPARISON_RESULT_SCHEMA)
    expect(result.productVerdict).toBe("INCONCLUSIVE")
    expect(result.records).toHaveLength(30)
    expect(result.records.every((record) => record.technicalVerdict === "TECHNICAL_PASS")).toBe(true)
    expect(result.records.every((record) => record.productVerdict === "INCONCLUSIVE")).toBe(true)
    expect(result.records.every((record) => record.measurements.tokenOverhead === null)).toBe(true)
    expect(result.records.every((record) => record.measurements.latencyMs === null)).toBe(true)
    expect(result.records.every((record) => record.measurements.taskSuccess === null)).toBe(true)
    expect(result.records.every((record) => record.measurements.maintainerIntervention === null)).toBe(true)
    expect(result.records.every((record) => record.model.provider === null && record.hostAdapter === null)).toBe(true)

    const personalTeam = record(result, "personal-vs-team", "targeted-layered")
    expect(personalTeam.selected).toEqual([{ id: "team-naming", layer: "team" }])
    expect(personalTeam.shadowed).toEqual([{ id: "personal-naming", layer: "personal" }])

    const ambiguity = record(result, "same-layer-ambiguity", "targeted-layered")
    expect(ambiguity.context.status).toBe("blocked")
    expect(ambiguity.context.blockReason).toBe("resolution-blocked")
    expect(ambiguity.conflicts).toEqual([{ reason: "same-layer-conflict", ruleIds: ["project-first", "project-second"], topic: "persistence" }])

    const overflow = record(result, "context-budget-overflow", "targeted-layered")
    expect(overflow.context.status).toBe("blocked")
    expect(overflow.context.blockReason).toBe("budget-exceeded")

    const duplicateDelivery = record(result, "duplicate-delivery", "targeted-layered")
    expect(duplicateDelivery.delivery).toEqual({ attempts: 2, uniqueDigestCount: 1 })

    const typescriptReference = record(result, "typescript-core-reference", "targeted-layered")
    expect(typescriptReference.claimScope).toBe("core-portability-only")

    const broad = record(result, "personal-vs-team", "legacy-broad")
    expect(broad.context.mode).toBe("legacy-broad-compatibility")
    expect(broad.capsules.count).toBe(2)
    expect(broad.structural.overreachCount).toBe(0)
    expect(JSON.stringify(result)).not.toContain("Use role nouns.")
  })

  it("fails closed when the manifest no longer has the exact P0 fixture set", () => {
    const manifest = loadManifest() as { fixtures: unknown[] }
    const result = evaluateContextComparison({ ...manifest, fixtures: manifest.fixtures.slice(1) }, candidate())

    expect(result).toEqual({
      code: "context-comparison-manifest-invalid",
      schemaVersion: CONTEXT_COMPARISON_RESULT_SCHEMA,
      status: "blocked",
    })

    expect(evaluateContextComparison({ ...manifest, fixtureSet: "other-context-comparison" }, candidate())).toEqual({
      code: "context-comparison-manifest-invalid",
      schemaVersion: CONTEXT_COMPARISON_RESULT_SCHEMA,
      status: "blocked",
    })
  })

  it("rejects a missing candidate binding before evaluating the fixture corpus", () => {
    const result = evaluateContextComparison(loadManifest(), { commit: "", packageVersion: "0.8.32" })

    expect(result).toEqual({
      code: "context-comparison-candidate-invalid",
      schemaVersion: CONTEXT_COMPARISON_RESULT_SCHEMA,
      status: "blocked",
    })
  })

  it("does not reflect an arbitrary active rule body into a comparison result", () => {
    const manifest = loadManifest() as {
      fixtures: Array<{ context: { personalRules: Array<{ rule: string }> } }>
    }
    const privateMarker = "Private rule body must never appear in comparison output."
    const fixture = manifest.fixtures[0]
    const rule = fixture?.context.personalRules[0]
    if (fixture === undefined || rule === undefined) throw new Error("comparison privacy fixture is unavailable")
    fixture.context.personalRules[0] = { ...rule, rule: privateMarker }

    const result = evaluateContextComparison(manifest, candidate())

    expect(result.status).toBe("ready")
    expect(JSON.stringify(result)).not.toContain(privateMarker)
  })

  it("keeps the result schema capable of recording a future real observation without promoting this local run", () => {
    const observation: Pick<ContextComparisonRecord, "hostAdapter" | "measurements" | "model" | "productVerdict"> = {
      hostAdapter: "opencode.experimental.chat.messages.transform",
      measurements: {
        conflictResolutionAccuracy: 1,
        correctionCount: 0,
        correctionRate: 0,
        latencyMs: 42,
        maintainerIntervention: false,
        policySurvival: true,
        taskSuccess: true,
        tokenOverhead: 12,
        toolCallCount: 3,
      },
      model: { provider: "example", version: "1" },
      productVerdict: "PRODUCT_GO",
    }

    expect(observation.productVerdict).toBe("PRODUCT_GO")

    const summary: Pick<Extract<ContextComparisonResult, { readonly status: "ready" }>, "productVerdict"> = {
      productVerdict: "PRODUCT_NO_GO",
    }
    expect(summary.productVerdict).toBe("PRODUCT_NO_GO")
  })
})

function candidate(): { readonly commit: string; readonly packageVersion: string } {
  return { commit: "a562331f9db321845b05da1e16edc4b83bf78ece", packageVersion: "0.8.32" }
}

function loadManifest(): unknown {
  return JSON.parse(readFileSync(resolve(repositoryRoot, "docs/current/context-comparison-manifest.json"), "utf8"))
}

function record(
  result: Extract<ReturnType<typeof evaluateContextComparison>, { readonly status: "ready" }>,
  fixtureId: string,
  arm: string,
) {
  const found = result.records.find((entry) => entry.fixtureId === fixtureId && entry.arm === arm)
  if (found === undefined) throw new Error(`missing comparison record: ${fixtureId}/${arm}`)
  return found
}
