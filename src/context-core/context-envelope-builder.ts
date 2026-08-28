import { DEFAULT_CONTEXT_BUDGET, type ContextBudget } from "./context-budget.js"
import { canonicalContextDigest } from "./context-digest.js"
import {
  isSafeEnvelopeIdentifier,
  parseContextEnvelopeInput,
  type ParsedContextSelection,
  type ParsedContextShadow,
} from "./context-envelope-input.js"
import {
  CONTEXT_ENVELOPE_SCHEMA,
  type ContextCapsule,
  type ContextConflict,
  type ContextDecision,
  type ContextEnvelope,
  type ContextEnvelopeBlockReason,
  type ContextEnvelopeBudget,
  type ContextTarget,
} from "./context-envelope.js"
import type { ContextLayer } from "./rule-types.js"

type ResolvedEnvelopePayload = Omit<Extract<ContextEnvelope, { readonly status: "resolved" }>, "digest">
type BlockedEnvelopePayload = Omit<Extract<ContextEnvelope, { readonly status: "blocked" }>, "digest">

export function buildContextEnvelope(value: unknown): ContextEnvelope {
  const parsed = parseContextEnvelopeInput(value)
  if (parsed === undefined) return blockedEnvelope("malformed-input", unavailableTarget(), [], DEFAULT_CONTEXT_BUDGET, 0, 0)
  if (parsed.resolution.status === "blocked") {
    return blockedEnvelope("resolution-blocked", parsed.target, parsed.resolution.conflicts, parsed.budget, 0, 0)
  }
  const selected = normalizeSelections(parsed.resolution.selected)
  if (selected === undefined) return blockedEnvelope("unsafe-content", parsed.target, [], parsed.budget, 0, 0)
  const usedCapsules = selected.length
  const usedChars = selected.reduce((total, capsule) => total + capsule.content.length, 0)
  if (usedCapsules > parsed.budget.maxCapsules || usedChars > parsed.budget.maxChars) {
    return blockedEnvelope("budget-exceeded", parsed.target, [], parsed.budget, usedCapsules, usedChars)
  }
  return resolvedEnvelope(parsed.target, selected, normalizeShadows(parsed.resolution.shadowed), parsed.budget, usedCapsules, usedChars)
}

function normalizeSelections(selections: readonly ParsedContextSelection[]): readonly ContextCapsule[] | undefined {
  const normalized: ContextCapsule[] = []
  for (const selection of selections) {
    if (!isSafeEnvelopeIdentifier(selection.id) || !isContextLayer(selection.layer) || !isSafeEnvelopeIdentifier(selection.topic)
      || !isSelectionReason(selection.reason) || !isSafeRuleText(selection.rule)) return undefined
    normalized.push({
      content: selection.rule,
      contentDigest: canonicalContextDigest(selection.rule),
      id: selection.id,
      layer: selection.layer,
      reason: selection.reason,
      topic: selection.topic,
    })
  }
  return normalized.sort(compareCapsules)
}

function normalizeShadows(shadows: readonly ParsedContextShadow[]): readonly ContextDecision[] {
  return shadows
    .map(({ id, reason, winnerId }) => ({ id, reason, winnerId }))
    .sort((left, right) => left.id.localeCompare(right.id) || left.winnerId.localeCompare(right.winnerId))
}

function resolvedEnvelope(
  target: ContextTarget,
  selected: readonly ContextCapsule[],
  shadowed: readonly ContextDecision[],
  budget: ContextBudget,
  usedCapsules: number,
  usedChars: number,
): ContextEnvelope {
  const envelopeBudget: ContextEnvelopeBudget = { ...budget, usedCapsules, usedChars }
  const payload: ResolvedEnvelopePayload = {
    budget: envelopeBudget,
    conflicts: [],
    schemaVersion: CONTEXT_ENVELOPE_SCHEMA,
    selected,
    shadowed,
    status: "resolved",
    target,
    warnings: [],
  }
  return { ...payload, digest: canonicalContextDigest(payload) }
}

function blockedEnvelope(
  blockReason: ContextEnvelopeBlockReason,
  target: ContextTarget,
  conflicts: readonly ContextConflict[],
  budget: ContextBudget,
  usedCapsules: number,
  usedChars: number,
): ContextEnvelope {
  const envelopeBudget: ContextEnvelopeBudget = { ...budget, usedCapsules, usedChars }
  const payload: BlockedEnvelopePayload = {
    blockReason,
    budget: envelopeBudget,
    conflicts,
    schemaVersion: CONTEXT_ENVELOPE_SCHEMA,
    selected: [],
    shadowed: [],
    status: "blocked",
    target,
    warnings: [],
  }
  return { ...payload, digest: canonicalContextDigest(payload) }
}

function compareCapsules(left: ContextCapsule, right: ContextCapsule): number {
  return layerPriority(right.layer) - layerPriority(left.layer)
    || left.topic.localeCompare(right.topic)
    || left.id.localeCompare(right.id)
}

function layerPriority(layer: ContextLayer): number {
  return ["common", "language", "personal", "team", "project", "task", "invariant"].indexOf(layer)
}

function unavailableTarget(): ContextTarget {
  return { path: "unavailable" }
}

function isContextLayer(value: string): value is ContextLayer {
  return value === "invariant" || value === "task" || value === "project" || value === "team"
    || value === "personal" || value === "language" || value === "common"
}

function isSelectionReason(value: string): boolean {
  return value === "topic+scope" || value === "topic+scope+file-role" || value === "topic+scope+file-role+language"
    || value === "topic+scope+file-role+language+skill" || value === "topic+scope+file-role+skill"
    || value === "topic+scope+language" || value === "topic+scope+language+skill" || value === "topic+scope+skill"
}

function isSafeRuleText(value: string): boolean {
  return value.length > 0 && value.length <= 1_000 && !/[\u0000-\u001f\u007f]/u.test(value)
    && !/(?:https?:\/\/|(?:api[_-]?key|access[_-]?token|password|secret|authorization)\s*[:=])/iu.test(value)
    && !/(?:^|\s)(?:[A-Za-z]:[\\/]|[\\/]{1,2})[^\s]*/u.test(value)
    && !/(?:^|\n)\s*(?:class|const|export|function|import|package|private|public)\b/iu.test(value)
}
