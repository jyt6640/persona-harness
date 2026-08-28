import { buildContextEnvelope, canonicalContextDigest, resolveEffectiveContext } from "../context-core/index.js"
import { matchesContextRelevance } from "../context-core/effective-context-v2-input.js"
import type { ContextLayer } from "../context-core/rule-types.js"
import {
  contextComparisonRules,
  parseContextComparisonCandidate,
  parseContextComparisonManifest,
} from "./context-comparison-manifest.js"
import {
  CONTEXT_COMPARISON_ARMS,
  CONTEXT_COMPARISON_PROTOCOL,
  CONTEXT_COMPARISON_RESULT_SCHEMA,
  type ContextComparisonArm,
  type ContextComparisonCandidate,
  type ContextComparisonConflict,
  type ContextComparisonFixture,
  type ContextComparisonRecord,
  type ContextComparisonResult,
  type ContextComparisonRuleReference,
} from "./context-comparison-types.js"

export function evaluateContextComparison(manifestInput: unknown, candidateInput: unknown): ContextComparisonResult {
  const manifest = parseContextComparisonManifest(manifestInput)
  if (manifest === undefined) return blocked("context-comparison-manifest-invalid")
  const candidate = parseContextComparisonCandidate(candidateInput)
  if (candidate === undefined) return blocked("context-comparison-candidate-invalid")
  const manifestDigest = canonicalContextDigest(manifestInput)
  const records = manifest.fixtures.flatMap((fixture) => CONTEXT_COMPARISON_ARMS.map((arm) => evaluateArm(fixture, candidate, arm)))
  return {
    candidate,
    manifestDigest,
    productVerdict: "INCONCLUSIVE",
    protocolVersion: CONTEXT_COMPARISON_PROTOCOL,
    records,
    schemaVersion: CONTEXT_COMPARISON_RESULT_SCHEMA,
    status: "ready",
  }
}

function evaluateArm(
  fixture: ContextComparisonFixture,
  candidate: ContextComparisonCandidate,
  arm: ContextComparisonArm,
): ContextComparisonRecord {
  if (arm === "off") return offRecord(fixture, candidate)
  if (arm === "legacy-broad") return legacyBroadRecord(fixture, candidate)
  return targetedRecord(fixture, candidate)
}

function offRecord(fixture: ContextComparisonFixture, candidate: ContextComparisonCandidate): ContextComparisonRecord {
  return recordBase(fixture, candidate, "off", {
    capsules: { chars: 0, count: 0 },
    conflicts: [],
    context: { blockReason: null, digest: null, mode: "disabled", status: "disabled" },
    selected: [],
    shadowed: [],
    structural: { activeRuleCount: activeRules(fixture).length, applicableRuleCount: applicableRules(fixture).length, contradictionCount: 0, overreachCount: 0 },
    technicalVerdict: "TECHNICAL_PASS",
    warnings: ["context-disabled"],
  })
}

function legacyBroadRecord(fixture: ContextComparisonFixture, candidate: ContextComparisonCandidate): ContextComparisonRecord {
  const active = activeRules(fixture)
  const selected = active.map(toReference)
  const applicable = applicableRules(fixture)
  const chars = active.reduce((total, entry) => total + entry.rule.rule.length, 0)
  const contradictoryTopics = duplicateTopicCount(active)
  return recordBase(fixture, candidate, "legacy-broad", {
    capsules: { chars, count: active.length },
    conflicts: [],
    context: {
      blockReason: null,
      digest: canonicalContextDigest(active.map(({ layer, rule }) => ({ id: rule.id, layer, rule: rule.rule, topic: rule.topic }))),
      mode: "legacy-broad-compatibility",
      status: "resolved",
    },
    selected,
    shadowed: [],
    structural: {
      activeRuleCount: active.length,
      applicableRuleCount: applicable.length,
      contradictionCount: contradictoryTopics,
      overreachCount: active.length - applicable.length,
    },
    technicalVerdict: "TECHNICAL_PASS",
    warnings: ["legacy-broad-compatibility-only"],
  })
}

function targetedRecord(fixture: ContextComparisonFixture, candidate: ContextComparisonCandidate): ContextComparisonRecord {
  const resolution = resolveEffectiveContext(fixture.context)
  const envelope = buildContextEnvelope({
    budget: {
      maxCapsules: fixture.budget.maxCapsules,
      maxChars: fixture.budget.maxChars,
    },
    resolution,
    target: fixture.target,
  })
  const selected = envelope.selected.map((capsule) => ({ id: capsule.id, layer: capsule.layer }))
  const layerByRuleId = new Map(activeRules(fixture).map(({ layer, rule }) => [rule.id, layer]))
  const shadowed = envelope.shadowed.flatMap((entry) => {
    const layer = layerByRuleId.get(entry.id)
    return layer === undefined ? [] : [{ id: entry.id, layer }]
  })
  const conflicts: readonly ContextComparisonConflict[] = envelope.conflicts.map((conflict) => ({
    reason: "same-layer-conflict",
    ruleIds: conflict.ruleIds,
    topic: conflict.topic,
  }))
  const matchesExpectation = matchesTargetedExpectation(fixture, resolution.status, envelope.status, envelope.status === "blocked" ? envelope.blockReason : undefined, selected, shadowed, conflicts)
  return recordBase(fixture, candidate, "targeted-layered", {
    capsules: { chars: envelope.budget.usedChars, count: envelope.budget.usedCapsules },
    conflicts,
    context: {
      blockReason: envelope.status === "blocked" ? envelope.blockReason : null,
      digest: envelope.digest,
      mode: "targeted-layered",
      status: envelope.status,
    },
    selected,
    shadowed,
    structural: {
      activeRuleCount: activeRules(fixture).length,
      applicableRuleCount: applicableRules(fixture).length,
      contradictionCount: duplicateTopicCount(envelope.selected.map((capsule) => ({ layer: capsule.layer, rule: { ...capsule, rule: capsule.content } }))),
      overreachCount: 0,
    },
    technicalVerdict: matchesExpectation ? "TECHNICAL_PASS" : "TECHNICAL_FAIL",
    warnings: envelope.warnings.map((warning) => warning.code),
  })
}

function recordBase(
  fixture: ContextComparisonFixture,
  candidate: ContextComparisonCandidate,
  arm: ContextComparisonArm,
  values: Pick<ContextComparisonRecord, "capsules" | "conflicts" | "context" | "selected" | "shadowed" | "structural" | "technicalVerdict" | "warnings">,
): ContextComparisonRecord {
  const digest = values.context.digest
  return {
    arm,
    candidate,
    capsules: values.capsules,
    claimScope: fixture.claimScope,
    conflicts: values.conflicts,
    context: values.context,
    delivery: { attempts: fixture.deliveryAttempts, uniqueDigestCount: digest === null ? 0 : 1 },
    fixtureId: fixture.id,
    hostAdapter: null,
    measurements: unavailableMeasurements(),
    model: { provider: null, version: null },
    productVerdict: "INCONCLUSIVE",
    selected: values.selected,
    shadowed: values.shadowed,
    sourceDigest: canonicalContextDigest(fixture.target),
    structural: values.structural,
    taskDigest: canonicalContextDigest(fixture.task),
    technicalVerdict: values.technicalVerdict,
    warnings: values.warnings,
  }
}

function matchesTargetedExpectation(
  fixture: ContextComparisonFixture,
  resolutionStatus: "blocked" | "resolved",
  envelopeStatus: "blocked" | "resolved",
  blockReason: string | undefined,
  selected: readonly ContextComparisonRuleReference[],
  shadowed: readonly ContextComparisonRuleReference[],
  conflicts: readonly ContextComparisonConflict[],
): boolean {
  const expected = fixture.expectation
  return resolutionStatus === expected.resolutionStatus
    && envelopeStatus === expected.envelopeStatus
    && blockReason === expected.blockReason
    && equalJson(selected, expected.selected)
    && equalJson(shadowed, expected.shadowed)
    && equalJson(conflicts, expected.conflicts)
}

function activeRules(fixture: ContextComparisonFixture): readonly { readonly layer: ContextLayer; readonly rule: { readonly id: string; readonly rule: string; readonly status?: "active" | "pending" | "superseded"; readonly topic: string } }[] {
  return contextComparisonRules(fixture.context)
    .filter(({ rule }) => rule.status === undefined || rule.status === "active")
    .sort(compareLayeredRules)
}

function applicableRules(fixture: ContextComparisonFixture): readonly { readonly layer: ContextLayer; readonly rule: { readonly id: string; readonly rule: string; readonly status?: "active" | "pending" | "superseded"; readonly topic: string } }[] {
  return activeRules(fixture).filter(({ rule }) => matchesContextRelevance(rule, fixture.context.relevance))
}

function toReference(entry: { readonly layer: ContextLayer; readonly rule: { readonly id: string } }): ContextComparisonRuleReference {
  return { id: entry.rule.id, layer: entry.layer }
}

function compareLayeredRules(
  left: { readonly layer: ContextLayer; readonly rule: { readonly id: string; readonly topic: string } },
  right: { readonly layer: ContextLayer; readonly rule: { readonly id: string; readonly topic: string } },
): number {
  return layerPriority(right.layer) - layerPriority(left.layer)
    || left.rule.topic.localeCompare(right.rule.topic)
    || left.rule.id.localeCompare(right.rule.id)
}

function layerPriority(layer: ContextLayer): number {
  return ["common", "language", "personal", "team", "project", "task", "invariant"].indexOf(layer)
}

function duplicateTopicCount(entries: readonly { readonly rule: { readonly topic: string } }[]): number {
  const counts = new Map<string, number>()
  for (const { rule } of entries) counts.set(rule.topic, (counts.get(rule.topic) ?? 0) + 1)
  return [...counts.values()].reduce((total, count) => total + Math.max(0, count - 1), 0)
}

function unavailableMeasurements() {
  return {
    conflictResolutionAccuracy: null,
    correctionCount: null,
    correctionRate: null,
    latencyMs: null,
    maintainerIntervention: null,
    policySurvival: null,
    taskSuccess: null,
    tokenOverhead: null,
    toolCallCount: null,
  } as const
}

function blocked(code: "context-comparison-candidate-invalid" | "context-comparison-manifest-invalid"): ContextComparisonResult {
  return { code, schemaVersion: CONTEXT_COMPARISON_RESULT_SCHEMA, status: "blocked" }
}

function equalJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}
