import type { ContextEnvelopeBlockReason } from "../context-core/context-envelope.js"
import type { ContextLayer, EffectiveContextInput } from "../context-core/rule-types.js"

export const CONTEXT_COMPARISON_MANIFEST_SCHEMA = "persona-context-comparison-manifest.1" as const
export const CONTEXT_COMPARISON_PROTOCOL = "persona-context-comparison-protocol.1" as const
export const CONTEXT_COMPARISON_RESULT_SCHEMA = "persona-context-comparison-result.1" as const
export const CONTEXT_COMPARISON_FIXTURE_SET = "p0-context-three-arm" as const
export const CONTEXT_COMPARISON_ARMS = ["off", "legacy-broad", "targeted-layered"] as const
export const CONTEXT_COMPARISON_LAYERS = ["invariant", "task", "project", "team", "personal", "language", "common"] as const
export const REQUIRED_CONTEXT_COMPARISON_FIXTURE_IDS = [
  "personal-vs-team",
  "team-vs-project",
  "project-vs-task",
  "invariant-vs-project-team",
  "same-layer-ambiguity",
  "java-controller",
  "java-service",
  "typescript-core-reference",
  "duplicate-delivery",
  "context-budget-overflow",
] as const

export type ContextComparisonArm = (typeof CONTEXT_COMPARISON_ARMS)[number]
export type ContextComparisonLayer = (typeof CONTEXT_COMPARISON_LAYERS)[number]
export type ContextComparisonFixtureId = (typeof REQUIRED_CONTEXT_COMPARISON_FIXTURE_IDS)[number]

export type ContextComparisonCandidate = {
  readonly commit: string
  readonly packageVersion: string
}

export type ContextComparisonTarget = {
  readonly fileRole: string
  readonly language: string
  readonly path: string
}

export type ContextComparisonBudget = {
  readonly maxCapsules: number
  readonly maxChars: number
}

export type ContextComparisonRuleReference = {
  readonly id: string
  readonly layer: ContextLayer
}

export type ContextComparisonConflict = {
  readonly reason: "same-layer-conflict"
  readonly ruleIds: readonly string[]
  readonly topic: string
}

export type ContextComparisonExpectation = {
  readonly blockReason?: ContextEnvelopeBlockReason
  readonly conflicts: readonly ContextComparisonConflict[]
  readonly envelopeStatus: "blocked" | "resolved"
  readonly resolutionStatus: "blocked" | "resolved"
  readonly selected: readonly ContextComparisonRuleReference[]
  readonly shadowed: readonly ContextComparisonRuleReference[]
}

export type ContextComparisonFixture = {
  readonly budget: ContextComparisonBudget
  readonly claimScope: "context-resolution" | "core-portability-only"
  readonly context: EffectiveContextInput
  readonly deliveryAttempts: 1 | 2
  readonly expectation: ContextComparisonExpectation
  readonly id: ContextComparisonFixtureId
  readonly target: ContextComparisonTarget
  readonly task: string
}

export type ContextComparisonManifest = {
  readonly fixtureSet: typeof CONTEXT_COMPARISON_FIXTURE_SET
  readonly fixtures: readonly ContextComparisonFixture[]
  readonly schemaVersion: typeof CONTEXT_COMPARISON_MANIFEST_SCHEMA
}

export type ContextComparisonMeasurements = {
  readonly conflictResolutionAccuracy: number | null
  readonly correctionCount: number | null
  readonly correctionRate: number | null
  readonly latencyMs: number | null
  readonly maintainerIntervention: boolean | null
  readonly policySurvival: boolean | null
  readonly taskSuccess: boolean | null
  readonly tokenOverhead: number | null
  readonly toolCallCount: number | null
}

export type ContextComparisonProductVerdict = "INCONCLUSIVE" | "PRODUCT_GO" | "PRODUCT_NO_GO"

export type ContextComparisonStructuralMetrics = {
  readonly activeRuleCount: number
  readonly applicableRuleCount: number
  readonly contradictionCount: number
  readonly overreachCount: number
}

export type ContextComparisonRecord = {
  readonly arm: ContextComparisonArm
  readonly candidate: ContextComparisonCandidate
  readonly capsules: {
    readonly chars: number
    readonly count: number
  }
  readonly claimScope: ContextComparisonFixture["claimScope"]
  readonly conflicts: readonly ContextComparisonConflict[]
  readonly context: {
    readonly blockReason: ContextEnvelopeBlockReason | null
    readonly digest: string | null
    readonly mode: "disabled" | "legacy-broad-compatibility" | "targeted-layered"
    readonly status: "blocked" | "disabled" | "resolved"
  }
  readonly delivery: {
    readonly attempts: 1 | 2
    readonly uniqueDigestCount: number
  }
  readonly fixtureId: ContextComparisonFixtureId
  readonly hostAdapter: string | null
  readonly measurements: ContextComparisonMeasurements
  readonly model: {
    readonly provider: string | null
    readonly version: string | null
  }
  readonly productVerdict: ContextComparisonProductVerdict
  readonly selected: readonly ContextComparisonRuleReference[]
  readonly shadowed: readonly ContextComparisonRuleReference[]
  readonly sourceDigest: string
  readonly structural: ContextComparisonStructuralMetrics
  readonly taskDigest: string
  readonly technicalVerdict: "TECHNICAL_FAIL" | "TECHNICAL_PASS"
  readonly warnings: readonly string[]
}

export type ContextComparisonResult =
  | {
      readonly code: "context-comparison-candidate-invalid" | "context-comparison-manifest-invalid"
      readonly schemaVersion: typeof CONTEXT_COMPARISON_RESULT_SCHEMA
      readonly status: "blocked"
    }
  | {
      readonly candidate: ContextComparisonCandidate
      readonly manifestDigest: string
      readonly productVerdict: ContextComparisonProductVerdict
      readonly protocolVersion: typeof CONTEXT_COMPARISON_PROTOCOL
      readonly records: readonly ContextComparisonRecord[]
      readonly schemaVersion: typeof CONTEXT_COMPARISON_RESULT_SCHEMA
      readonly status: "ready"
    }
