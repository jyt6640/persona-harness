import type { ContextBudget } from "./context-budget.js"
import type { ContextLayer, EffectiveContextResolution } from "./rule-types.js"

export const CONTEXT_ENVELOPE_SCHEMA = "persona-context-envelope.v1" as const

export type ContextTarget = {
  readonly path: string
  readonly language?: string
  readonly fileRole?: string
}

export type ContextCapsule = {
  readonly id: string
  readonly layer: ContextLayer
  readonly topic: string
  readonly content: string
  readonly contentDigest: string
  readonly reason: string
}

export type ContextDecision = {
  readonly id: string
  readonly winnerId: string
  readonly reason: string
}

export type ContextConflict = {
  readonly topic: string
  readonly ruleIds: readonly string[]
  readonly reason: string
}

export type ContextWarning = {
  readonly code: string
  readonly message: string
}

export type ContextEnvelopeBudget = ContextBudget & {
  readonly usedCapsules: number
  readonly usedChars: number
}

export type ContextEnvelopeBlockReason =
  | "malformed-input"
  | "resolution-blocked"
  | "budget-exceeded"
  | "unsafe-content"

export type ContextEnvelopeInput = {
  readonly target: ContextTarget
  readonly resolution: EffectiveContextResolution
  readonly budget?: ContextBudget
}

export type ContextEnvelope =
  | {
      readonly schemaVersion: typeof CONTEXT_ENVELOPE_SCHEMA
      readonly status: "resolved"
      readonly target: ContextTarget
      readonly selected: readonly ContextCapsule[]
      readonly shadowed: readonly ContextDecision[]
      readonly conflicts: readonly ContextConflict[]
      readonly warnings: readonly ContextWarning[]
      readonly budget: ContextEnvelopeBudget
      readonly digest: string
    }
  | {
      readonly schemaVersion: typeof CONTEXT_ENVELOPE_SCHEMA
      readonly status: "blocked"
      readonly blockReason: ContextEnvelopeBlockReason
      readonly target: ContextTarget
      readonly selected: readonly []
      readonly shadowed: readonly ContextDecision[]
      readonly conflicts: readonly ContextConflict[]
      readonly warnings: readonly ContextWarning[]
      readonly budget: ContextEnvelopeBudget
      readonly digest: string
    }
