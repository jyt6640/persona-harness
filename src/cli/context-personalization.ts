import { canonicalContextDigest } from "../context-core/context-digest.js"
import { renderContextEnvelope } from "../context-core/context-renderer.js"
import type { ContextEnvelope, ContextWarning } from "../context-core/context-envelope.js"
import type { ContextRelevance, ContextRule, ContextScope } from "../context-core/rule-types.js"
import type { PersonalizationRule } from "./personalization-profile-model.js"
import { readPersonalizationStoreSnapshot, type PersonalizationStoreOptions } from "./personalization-store-io.js"

export type ContextPersonalization = {
  readonly personalRules: readonly ContextRule[]
  readonly projectContracts: readonly ContextRule[]
  readonly taskDecisions: readonly ContextRule[]
  readonly warnings: readonly ContextWarning[]
}

export function readContextPersonalization(
  options?: PersonalizationStoreOptions,
  scopeKeys: Pick<ContextRelevance, "projectKey" | "taskKey"> = {},
): ContextPersonalization {
  const snapshot = readPersonalizationStoreSnapshot(options)
  const rules = snapshot.document.profile.activeRules
  const warnings: ContextWarning[] = snapshot.status === "missing"
    ? [{ code: "personal-profile-missing", message: "No personal profile is initialized; defaults are not approved personal philosophy." }]
    : rules.length === 0
      ? [{ code: "personal-profile-empty", message: "The personal profile contains no active approved rules." }]
      : []
  if (scopeKeys.projectKey === undefined && rules.some((rule) => rule.scope.kind === "project")) {
    warnings.push({ code: "project-scope-unbound", message: "Project-scoped rules exist, but no project identity was supplied; those rules were not applied." })
  }
  if (scopeKeys.taskKey === undefined && rules.some((rule) => rule.scope.kind === "task")) {
    warnings.push({ code: "task-scope-unbound", message: "Task-scoped rules exist, but no task identity was supplied; those rules were not applied." })
  }
  return {
    personalRules: rules.filter((rule) => rule.scope.kind === "personal").map(toContextRule),
    projectContracts: rules.filter((rule) => rule.scope.kind === "project").map(toContextRule),
    taskDecisions: rules.filter((rule) => rule.scope.kind === "task").map(toContextRule),
    warnings,
  }
}

export function withPersonalizationWarnings(
  envelope: ContextEnvelope,
  profile: ContextPersonalization,
  scopeKeys: Pick<ContextRelevance, "projectKey" | "taskKey"> = {},
): ContextEnvelope {
  const warnings = profile.warnings.filter((warning) =>
    !(warning.code === "project-scope-unbound" && scopeKeys.projectKey !== undefined)
    && !(warning.code === "task-scope-unbound" && scopeKeys.taskKey !== undefined),
  )
  if (warnings.length === 0) return envelope
  const { digest: _digest, ...body } = envelope
  const payload = { ...body, warnings: [...body.warnings, ...warnings] }
  if (payload.status === "blocked") return { ...payload, digest: canonicalContextDigest(payload) }
  const usedChars = renderContextEnvelope({ ...payload, digest: "" }).length
  const budget = { ...payload.budget, usedChars }
  if (usedChars > budget.maxChars) {
    const blocked = { ...payload, budget, status: "blocked", blockReason: "budget-exceeded", selected: [] } as const
    return { ...blocked, digest: canonicalContextDigest(blocked) }
  }
  const resolved = { ...payload, budget }
  return { ...resolved, digest: canonicalContextDigest(resolved) }
}

function toContextRule(rule: PersonalizationRule): ContextRule {
  return { id: rule.ruleId, rule: rule.rule, scope: contextScope(rule.scope), status: "active", topic: rule.topic }
}

export function contextScope(
  scope: { readonly key: string; readonly kind: "personal" | "project" | "task" } | null | undefined,
): ContextScope | undefined {
  if (scope === undefined || scope === null || scope.kind === "personal") return undefined
  return { key: scope.key, kind: scope.kind }
}
