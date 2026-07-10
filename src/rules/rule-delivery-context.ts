import type { RuleCatalogEntry } from "./rule-catalog.js"

export type RuleDeliveryStage = "implementation" | "report" | "review" | "verification"

type StageRelevance = {
  readonly description: string
  readonly topicPatterns: readonly RegExp[]
}

export const RULE_DELIVERY_STAGE_RELEVANCE: Readonly<Record<RuleDeliveryStage, StageRelevance>> = {
  implementation: {
    description: "Implementation, architecture, stack-alignment, and convention blockers keep broad role-scoped rules.",
    topicPatterns: [],
  },
  report: {
    description: "Procedural report/read-coverage blockers get workflow/report-oriented rules only.",
    topicPatterns: [/\b(?:feature-workflow|workflow|report|read-coverage|git-convention)\b/iu],
  },
  review: {
    description: "Review blockers get review/refactoring/object-responsibility guidance.",
    topicPatterns: [/\b(?:review|legacy-review|refactoring|object-responsibility|method-design)\b/iu],
  },
  verification: {
    description: "Verification/test/command blockers get test, Gradle, and verification guidance.",
    topicPatterns: [/\b(?:test|testability|verification|gradle|fake|tdd|command-discipline)\b/iu],
  },
} as const

function metadataText(entry: RuleCatalogEntry): string {
  return [
    entry.path,
    entry.metadata.id,
    entry.metadata.source,
    entry.metadata.domain,
    entry.metadata.topic,
  ]
    .filter((value): value is string => value !== undefined)
    .join(" ")
}

export function ruleDeliveryStageForBlocker(blockerId: string): RuleDeliveryStage {
  if (/\breview|review-/iu.test(blockerId)) {
    return "review"
  }
  if (/\b(?:implementation-report|report-read|role-read|profile-read)\b|report-/iu.test(blockerId)) {
    return "report"
  }
  if (/\b(?:test|verification|tdd|command-discipline|bearshell)\b|verification-|test-/iu.test(blockerId)) {
    return "verification"
  }
  return "implementation"
}

export function isRuleRelevantForStage(entry: RuleCatalogEntry, stage: RuleDeliveryStage): boolean {
  const relevance = RULE_DELIVERY_STAGE_RELEVANCE[stage]
  if (relevance.topicPatterns.length === 0) {
    return true
  }
  const text = metadataText(entry)
  return relevance.topicPatterns.some((pattern) => pattern.test(text))
}
