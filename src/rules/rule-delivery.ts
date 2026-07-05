import { createHash } from "node:crypto"

import { loadHarnessConfig } from "../config/harness-config.js"
import type { FileRole } from "../runtime/types.js"
import {
  isRuleEligibleForTarget,
  loadRuleCatalog,
  targetPathForMatching,
  type Phase0Scenario,
  type RuleCatalogEntry,
} from "./rule-catalog.js"
import type { RuleDeliveryRole } from "./rule-frontmatter.js"
import type { RuleFrontmatterDiagnostic } from "./rule-frontmatter-diagnostics.js"

export type DeliveredRule = {
  readonly id: string
  readonly path: string
  readonly policies: readonly string[]
}

export type RuleDeliverySummary = {
  readonly budget: number
  readonly diagnostics: readonly RuleFrontmatterDiagnostic[]
  readonly estimatedTokens: number
  readonly policyCount: number
  readonly role: RuleDeliveryRole
  readonly ruleCount: number
  readonly rulePackHash: string
  readonly rules: readonly DeliveredRule[]
}

export type RederivedRuleDelivery =
  | {
      readonly kind: "hash-mismatch"
      readonly actualRulePackHash: string
      readonly expectedRulePackHash: string
      readonly role: RuleDeliveryRole
    }
  | {
      readonly kind: "matched"
      readonly role: RuleDeliveryRole
      readonly rulePackHash: string
      readonly rulePaths: readonly string[]
    }

const STEP1_API_CONTRACT_RULE = "backend/step1-api-contract.md"
const STEP2_3_API_CONTRACT_RULE = "backend/step2-3-api-contract.md"

function matchesScenario(entry: RuleCatalogEntry, scenario: Phase0Scenario): boolean {
  return entry.metadata.scenario === "all" || entry.metadata.scenario === scenario
}

function supportsRole(entry: RuleCatalogEntry, role: RuleDeliveryRole): boolean {
  return entry.metadata.roles.includes(role)
}

export function takePoliciesForDelivery(rulePath: string, policies: readonly string[], maxBullets?: number): string[] {
  if (maxBullets !== undefined) {
    return policies.slice(0, maxBullets)
  }
  if (rulePath === STEP1_API_CONTRACT_RULE || rulePath === STEP2_3_API_CONTRACT_RULE) {
    return policies.slice(0, 3)
  }
  if (rulePath === "backend/layered-architecture.md") {
    return policies.slice(0, 4)
  }
  if (rulePath === "backend/java-common.md") {
    return policies.slice(0, 3)
  }
  if (rulePath === "backend/java-backend-bootstrap.md") {
    return policies.slice(0, 8)
  }
  if (rulePath === "backend/gradle-bootstrap.md") {
    return policies.slice(0, 4)
  }
  const limit = rulePath === "clean-code/method-design.md" ? 1 : 2
  return policies.slice(0, limit)
}

export function rulePackContentHash(projectDir: string): string {
  const catalog = loadRuleCatalog(projectDir)
  const payload = catalog.map((entry) => ({
    metadata: entry.metadata,
    path: entry.path,
    policies: entry.policies,
  }))
  return `sha256:${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`
}

function estimatedTokensForLines(lines: readonly string[]): number {
  return Math.ceil(lines.join("\n").length / 4)
}

function deliveredRule(entry: RuleCatalogEntry): DeliveredRule {
  return {
    id: entry.metadata.id,
    path: entry.path,
    policies: takePoliciesForDelivery(entry.path, entry.policies, entry.metadata.maxBullets),
  }
}

export function selectRulesForDelivery(
  projectDir: string,
  role: RuleDeliveryRole,
  options: {
    readonly fileRole?: FileRole
    readonly targetFile?: string
  } = {},
): RuleDeliverySummary {
  const config = loadHarnessConfig(projectDir)
  const targetPath =
    options.fileRole === undefined ? undefined : targetPathForMatching(projectDir, options.fileRole, options.targetFile)
  const catalog = loadRuleCatalog(projectDir)
  const diagnostics = catalog.flatMap((entry) => entry.diagnostics)
  const eligibleRules = catalog
    .filter((entry) => supportsRole(entry, role))
    .filter((entry) => matchesScenario(entry, config.scenario))
    .filter((entry) =>
      options.fileRole === undefined || targetPath === undefined
        ? true
        : isRuleEligibleForTarget(entry, options.fileRole, config.scenario, targetPath),
    )
    .slice(0, config.maxRulesPerInjection)
    .map(deliveredRule)
  const lines = eligibleRules.flatMap((rule) => [rule.path, ...rule.policies])
  return {
    budget: config.maxRulesPerInjection,
    diagnostics,
    estimatedTokens: estimatedTokensForLines(lines),
    policyCount: eligibleRules.reduce((count, rule) => count + rule.policies.length, 0),
    role,
    ruleCount: eligibleRules.length,
    rulePackHash: rulePackContentHash(projectDir),
    rules: eligibleRules,
  }
}

export function formatRuleDeliveryPromptLines(delivery: RuleDeliverySummary): readonly string[] {
  const lines = [
    `Scoped PH rules (role: ${delivery.role}, budget: ${delivery.ruleCount}/${delivery.budget}, estimated tokens: ${delivery.estimatedTokens})`,
    `Rule pack hash: ${delivery.rulePackHash}`,
    "Rule delivery is narrow by role scope; PH closure/check/finish gates remain broad and authoritative.",
  ]
  if (delivery.rules.length === 0) {
    return [...lines, "- No scoped PH rules matched this role/stage."]
  }
  return [
    ...lines,
    ...delivery.rules.flatMap((rule) => [
      `- ${rule.path}`,
      ...rule.policies.map((policy) => `  - ${policy}`),
    ]),
  ]
}

export function rederiveDeliveredRulePaths(
  projectDir: string,
  role: RuleDeliveryRole,
  expectedRulePackHash: string,
): RederivedRuleDelivery {
  const delivery = selectRulesForDelivery(projectDir, role)
  if (delivery.rulePackHash !== expectedRulePackHash) {
    return {
      actualRulePackHash: delivery.rulePackHash,
      expectedRulePackHash,
      kind: "hash-mismatch",
      role,
    }
  }
  return {
    kind: "matched",
    role,
    rulePackHash: delivery.rulePackHash,
    rulePaths: delivery.rules.map((rule) => rule.path),
  }
}

export function ruleDeliveryRoleForBlocker(blockerId: string): RuleDeliveryRole {
  if (/\breview|review-/iu.test(blockerId)) {
    return "reviewer"
  }
  if (/\b(?:test|verification|tdd|command-discipline)\b|verification-|test-/iu.test(blockerId)) {
    return "test-writer"
  }
  return "implementer"
}

export function ruleDeliveryRoleForWorkText(text: string): RuleDeliveryRole {
  if (/\b(?:tests?|verification|verify|검증|테스트)\b/iu.test(text)) {
    return "test-writer"
  }
  if (/\b(?:review|qa|리뷰|검토)\b/iu.test(text)) {
    return "reviewer"
  }
  return "implementer"
}
