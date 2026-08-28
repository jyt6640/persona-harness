import {
  parseEffectiveProfileInput,
} from "./effective-context-input.js"
import { resolveEffectiveContext } from "./effective-context-v2.js"
import type {
  ContextLayer,
  EffectiveProfileBlockReason,
  EffectiveProfileResolution,
  EffectiveProfileResolutionInput,
  EffectiveProfileRuleInput,
} from "./rule-types.js"

export * from "./rule-types.js"

export function resolveEffectiveProfile(value: unknown): EffectiveProfileResolution {
  const parsed = parseEffectiveProfileInput(value)
  if (parsed === undefined) return blocked("malformed-input")
  const resolution = resolveEffectiveContext(toV2Input(parsed))
  if (resolution.status === "blocked") return blocked(resolution.reason)

  return {
    capsules: resolution.selected.map(({ id, layer, rule, topic }) => ({ id, rule, source: toV1Layer(layer), topic })),
    selections: resolution.selected.map(({ id, layer, reason, topic }) => ({ id, reason, source: toV1Layer(layer), topic })),
    status: "resolved",
  }
}

function toV2Input(input: EffectiveProfileResolutionInput) {
  return {
    commonDefaults: input.starterDefaults.map(toV2Rule),
    languageDefaults: [],
    maxCapsules: input.maxCapsules,
    personalProfileAvailable: input.personalProfileAvailable,
    personalRules: input.personalRules.map(toV2Rule),
    productInvariants: input.productInvariants.map(toV2Rule),
    projectContracts: input.projectContracts.map(toV2Rule),
    relevance: {
      fileRole: input.relevance.fileRole,
      language: "common",
      projectKey: input.relevance.projectKey,
      skillIds: input.relevance.skillIds,
      taskKey: input.relevance.taskKey,
      topics: input.relevance.topics,
    },
    taskDecisions: input.taskDecisions.map(toV2Rule),
    teamContracts: [],
  }
}

function toV2Rule(rule: EffectiveProfileRuleInput) {
  return {
    fileRoles: rule.fileRoles,
    id: rule.id,
    rule: rule.rule,
    scope: rule.scope?.kind === "personal" ? undefined : rule.scope,
    skillIds: rule.skillIds,
    status: rule.status,
    topic: rule.topic,
  }
}

function toV1Layer(layer: ContextLayer): "invariant" | "task" | "project" | "personal" | "starter" {
  if (layer === "invariant" || layer === "task" || layer === "project" || layer === "personal") return layer
  return "starter"
}

function blocked(reason: EffectiveProfileBlockReason): EffectiveProfileResolution {
  return { capsules: [], reason, selections: [], status: "blocked" }
}
