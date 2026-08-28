export const EFFECTIVE_PROFILE_SCHEMA = "effective-profile.v1" as const

export type EffectiveProfileScope = {
  readonly kind: "personal" | "project" | "task"
  readonly key: string
}

export type EffectiveProfileLayer = "invariant" | "task" | "project" | "personal" | "starter"

export type ContextLayer = "invariant" | "task" | "project" | "team" | "personal" | "language" | "common"

export type ContextScope = {
  readonly kind: "project" | "task" | "team"
  readonly key: string
}

export type ContextRule = {
  readonly id: string
  readonly topic: string
  readonly rule: string
  readonly scope?: ContextScope | null
  readonly fileRoles?: readonly string[]
  readonly languages?: readonly string[]
  readonly skillIds?: readonly string[]
  readonly status?: "active" | "pending" | "superseded"
}

export type ContextRelevance = {
  readonly topics: readonly string[]
  readonly fileRole: string
  readonly language: string
  readonly skillIds: readonly string[]
  readonly projectKey?: string
  readonly taskKey?: string
  readonly teamKey?: string
}

export type EffectiveContextInput = {
  readonly productInvariants: readonly ContextRule[]
  readonly taskDecisions: readonly ContextRule[]
  readonly projectContracts: readonly ContextRule[]
  readonly teamContracts: readonly ContextRule[]
  readonly personalRules: readonly ContextRule[]
  readonly languageDefaults: readonly ContextRule[]
  readonly commonDefaults: readonly ContextRule[]
  readonly relevance: ContextRelevance
  readonly maxCapsules?: number
  readonly personalProfileAvailable?: boolean
}

export type ContextBlockReason = EffectiveProfileBlockReason

export type EffectiveContextSelection = {
  readonly id: string
  readonly layer: ContextLayer
  readonly topic: string
  readonly rule: string
  readonly reason: string
}

export type EffectiveContextShadow = {
  readonly id: string
  readonly winnerId: string
  readonly topic: string
  readonly reason: "higher-precedence"
}

export type EffectiveContextConflict = {
  readonly topic: string
  readonly ruleIds: readonly string[]
  readonly reason: "same-layer-conflict"
}

export type EffectiveContextResolution =
  | {
      readonly status: "resolved"
      readonly selected: readonly EffectiveContextSelection[]
      readonly shadowed: readonly EffectiveContextShadow[]
      readonly conflicts: readonly []
    }
  | {
      readonly status: "blocked"
      readonly reason: ContextBlockReason
      readonly selected: readonly []
      readonly shadowed: readonly []
      readonly conflicts: readonly EffectiveContextConflict[]
    }

export type EffectiveProfileBlockReason =
  | "malformed-input"
  | "profile-unavailable"
  | "ambiguous-conflict"
  | "selection-overflow"

export type EffectiveProfileRuleInput = {
  readonly id: string
  readonly topic: string
  readonly rule: string
  readonly scope?: EffectiveProfileScope | null
  readonly fileRoles?: readonly string[]
  readonly skillIds?: readonly string[]
  readonly status?: "active" | "pending" | "superseded"
}

export type EffectiveProfileRelevance = {
  readonly topics: readonly string[]
  readonly fileRole: string
  readonly skillIds: readonly string[]
  readonly projectKey?: string
  readonly taskKey?: string
}

export type EffectiveProfileResolutionInput = {
  readonly productInvariants: readonly EffectiveProfileRuleInput[]
  readonly taskDecisions: readonly EffectiveProfileRuleInput[]
  readonly projectContracts: readonly EffectiveProfileRuleInput[]
  readonly personalRules: readonly EffectiveProfileRuleInput[]
  readonly starterDefaults: readonly EffectiveProfileRuleInput[]
  readonly relevance: EffectiveProfileRelevance
  readonly maxCapsules?: number
  readonly personalProfileAvailable?: boolean
}

export type EffectiveProfileCapsule = {
  readonly id: string
  readonly source: EffectiveProfileLayer
  readonly topic: string
  readonly rule: string
}

export type EffectiveProfileSelection = {
  readonly id: string
  readonly source: EffectiveProfileLayer
  readonly topic: string
  readonly reason: string
}

export type EffectiveProfileResolution =
  | {
      readonly status: "resolved"
      readonly capsules: readonly EffectiveProfileCapsule[]
      readonly selections: readonly EffectiveProfileSelection[]
    }
  | {
      readonly status: "blocked"
      readonly reason: EffectiveProfileBlockReason
      readonly capsules: readonly []
      readonly selections: readonly []
    }

export const STARTER_PROFILE = Object.freeze([
  "Put responsibility with the object or data owner.",
  "Separate business judgment from execution flow.",
  "Prefer explicit intent over clever reuse.",
  "Add abstractions only after a demonstrated need.",
  "Require evidence before claiming completion.",
])

const PRODUCT_SAFETY_INVARIANTS: readonly EffectiveProfileRuleInput[] = [
  {
    id: "invariant-no-inference",
    rule: "Do not infer unknown or conflicting decisions; stop for explicit input.",
    status: "active",
    topic: "safety-no-inference",
  },
  {
    id: "invariant-no-sensitive-persistence",
    rule: "Keep raw prompts, output, source, credentials, and absolute paths out of profile state.",
    status: "active",
    topic: "safety-no-sensitive-persistence",
  },
]

export function createProductSafetyInvariants(): readonly EffectiveProfileRuleInput[] {
  return PRODUCT_SAFETY_INVARIANTS.map((rule) => ({ ...rule }))
}

export function createStarterProfileDefaults(): readonly EffectiveProfileRuleInput[] {
  return STARTER_PROFILE.map((rule, index) => ({
    id: `starter-${index + 1}`,
    rule,
    status: "active",
    topic: `starter-${index + 1}`,
  }))
}
