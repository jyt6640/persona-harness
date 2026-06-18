import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { FileRole } from "./types.js"

export type Phase0Scenario = "step1" | "step2-3"

export type LoadedRule = {
  path: string
  policies: string[]
}

const DEFAULT_SCENARIO: Phase0Scenario = "step1"
const STEP1_API_CONTRACT_RULE = "backend/step1-api-contract.md"
const STEP2_3_API_CONTRACT_RULE = "backend/step2-3-api-contract.md"
const CONTRACT_RULE_ROLES = new Set<FileRole>(["controller", "request-dto", "response-dto", "test"])

const COMMON_RULES = [
  "clean-code/common.md",
  "clean-code/method-design.md",
  "backend/java-common.md",
] as const

const ROLE_RULES: Record<FileRole, readonly string[]> = {
  controller: ["backend/spring-controller.md", "backend/spring-dto.md", STEP1_API_CONTRACT_RULE],
  service: ["backend/spring-service.md", "backend/validation-exception.md"],
  repository: ["backend/spring-repository.md"],
  entity: ["clean-code/oop.md", "backend/spring-entity.md"],
  domain: ["clean-code/oop.md", "backend/layered-architecture.md"],
  "request-dto": ["backend/spring-dto.md", STEP1_API_CONTRACT_RULE],
  "response-dto": ["backend/spring-dto.md", STEP1_API_CONTRACT_RULE],
  exception: ["backend/validation-exception.md"],
  test: ["clean-code/testability.md", "backend/spring-test.md", STEP1_API_CONTRACT_RULE],
  "java-common": ["clean-code/abstraction.md"],
}

function readScenario(projectDir: string): Phase0Scenario {
  const harnessPath = join(projectDir, ".persona", "harness.jsonc")
  if (!existsSync(harnessPath)) {
    return DEFAULT_SCENARIO
  }

  const match = readFileSync(harnessPath, "utf8").match(/"scenario"\s*:\s*"([^"]+)"/)
  return match?.[1] === "step2-3" ? "step2-3" : DEFAULT_SCENARIO
}

function extractBulletPolicies(markdown: string): string[] {
  const body = markdown.startsWith("---") ? markdown.split("---").slice(2).join("---") : markdown

  return body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).replace(/`/g, ""))
}

function takePoliciesForInjection(rulePath: string, policies: string[]): string[] {
  if (rulePath === STEP1_API_CONTRACT_RULE || rulePath === STEP2_3_API_CONTRACT_RULE) {
    return policies.slice(0, 3)
  }
  const limit = rulePath === "clean-code/method-design.md" ? 1 : 2
  return policies.slice(0, limit)
}

function contractRuleForScenario(scenario: Phase0Scenario): string {
  return scenario === "step2-3" ? STEP2_3_API_CONTRACT_RULE : STEP1_API_CONTRACT_RULE
}

function scenarioAwareRoleRules(fileRole: FileRole, scenario: Phase0Scenario): readonly string[] {
  const roleRules = ROLE_RULES[fileRole]
  if (!CONTRACT_RULE_ROLES.has(fileRole)) {
    return roleRules
  }

  const contractRule = contractRuleForScenario(scenario)
  return roleRules.map((rulePath) => (rulePath === STEP1_API_CONTRACT_RULE ? contractRule : rulePath))
}

export function selectRulePaths(fileRole: FileRole, scenario: Phase0Scenario = DEFAULT_SCENARIO): string[] {
  return Array.from(new Set([...COMMON_RULES, ...scenarioAwareRoleRules(fileRole, scenario)]))
}

export function loadRulesForRole(projectDir: string, fileRole: FileRole): LoadedRule[] {
  const scenario = readScenario(projectDir)
  return selectRulePaths(fileRole, scenario).map((rulePath) => {
    const absolutePath = join(projectDir, ".persona", "rules", rulePath)
    if (!existsSync(absolutePath)) {
      return { path: rulePath, policies: [] }
    }

    return {
      path: rulePath,
      policies: takePoliciesForInjection(rulePath, extractBulletPolicies(readFileSync(absolutePath, "utf8"))),
    }
  })
}
