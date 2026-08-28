import {
  contextSelectionReason,
  matchesContextRelevance,
  parseEffectiveContextInput,
} from "./effective-context-v2-input.js"
import type {
  ContextBlockReason,
  ContextLayer,
  ContextRule,
  EffectiveContextConflict,
  EffectiveContextInput,
  EffectiveContextResolution,
  EffectiveContextShadow,
} from "./rule-types.js"

type Candidate = {
  readonly layer: ContextLayer
  readonly priority: number
  readonly reason: string
  readonly rule: ContextRule
}

type ShadowedCandidate = {
  readonly priority: number
  readonly shadow: EffectiveContextShadow
}

const LAYER_DEFINITIONS: readonly {
  readonly key: keyof Pick<EffectiveContextInput, "commonDefaults" | "languageDefaults" | "personalRules" | "productInvariants" | "projectContracts" | "taskDecisions" | "teamContracts">
  readonly layer: ContextLayer
  readonly priority: number
}[] = [
  { key: "productInvariants", layer: "invariant", priority: 6 },
  { key: "taskDecisions", layer: "task", priority: 5 },
  { key: "projectContracts", layer: "project", priority: 4 },
  { key: "teamContracts", layer: "team", priority: 3 },
  { key: "personalRules", layer: "personal", priority: 2 },
  { key: "languageDefaults", layer: "language", priority: 1 },
  { key: "commonDefaults", layer: "common", priority: 0 },
]

export function resolveEffectiveContext(value: unknown): EffectiveContextResolution {
  const parsed = parseEffectiveContextInput(value)
  if (parsed === undefined) return blocked("malformed-input")
  if (parsed.personalProfileAvailable === false) return blocked("profile-unavailable")

  const selection = selectHighestPrecedence(collectCandidates(parsed))
  if (selection.conflicts.length > 0) return blocked("ambiguous-conflict", selection.conflicts)
  const selected = selection.winners.sort(compareCandidates)
  if (selected.length > (parsed.maxCapsules ?? 8)) return blocked("selection-overflow")
  return {
    conflicts: [],
    selected: selected.map(({ layer, reason, rule }) => ({ id: rule.id, layer, reason, rule: rule.rule, topic: rule.topic })),
    shadowed: selection.shadowed.sort(compareShadowed).map(({ shadow }) => shadow),
    status: "resolved",
  }
}

function collectCandidates(input: EffectiveContextInput): Candidate[] {
  const candidates: Candidate[] = []
  for (const definition of LAYER_DEFINITIONS) {
    for (const rule of input[definition.key]) {
      if (rule.status !== undefined && rule.status !== "active") continue
      if (!matchesContextRelevance(rule, input.relevance)) continue
      candidates.push({ layer: definition.layer, priority: definition.priority, reason: contextSelectionReason(rule), rule })
    }
  }
  return candidates
}

function selectHighestPrecedence(candidates: readonly Candidate[]): {
  readonly winners: Candidate[]
  readonly shadowed: ShadowedCandidate[]
  readonly conflicts: EffectiveContextConflict[]
} {
  const byTopic = new Map<string, Candidate[]>()
  for (const candidate of candidates) {
    const topicCandidates = byTopic.get(candidate.rule.topic) ?? []
    topicCandidates.push(candidate)
    byTopic.set(candidate.rule.topic, topicCandidates)
  }
  const winners: Candidate[] = []
  const shadowed: ShadowedCandidate[] = []
  const conflicts: EffectiveContextConflict[] = []
  for (const topic of [...byTopic.keys()].sort()) {
    const topicCandidates = byTopic.get(topic)
    if (topicCandidates === undefined) continue
    const highestPriority = Math.max(...topicCandidates.map((candidate) => candidate.priority))
    const highest = topicCandidates.filter((candidate) => candidate.priority === highestPriority).sort(compareCandidates)
    if (highest.length !== 1) {
      conflicts.push({
        reason: "same-layer-conflict",
        ruleIds: highest.map((candidate) => candidate.rule.id).sort(),
        topic,
      })
      continue
    }
    const winner = highest[0]
    if (winner === undefined) continue
    winners.push(winner)
    for (const candidate of topicCandidates) {
      if (candidate === winner) continue
      shadowed.push({
        priority: winner.priority,
        shadow: { id: candidate.rule.id, reason: "higher-precedence", topic, winnerId: winner.rule.id },
      })
    }
  }
  return { conflicts, shadowed, winners }
}

function compareCandidates(left: Candidate, right: Candidate): number {
  return right.priority - left.priority
    || left.rule.topic.localeCompare(right.rule.topic)
    || left.rule.id.localeCompare(right.rule.id)
}

function compareShadowed(left: ShadowedCandidate, right: ShadowedCandidate): number {
  return right.priority - left.priority
    || left.shadow.topic.localeCompare(right.shadow.topic)
    || left.shadow.id.localeCompare(right.shadow.id)
}

function blocked(reason: ContextBlockReason, conflicts: readonly EffectiveContextConflict[] = []): EffectiveContextResolution {
  return { conflicts, reason, selected: [], shadowed: [], status: "blocked" }
}
