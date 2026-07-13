import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { FileRole } from "../runtime/types.js"
import { loadHarnessConfigResult, resolveConfiguredPath } from "../config/harness-config.js"
import {
  isRuleEligibleForTarget,
  inspectRuleCatalogPaths,
  loadRuleCatalog,
  targetPathForMatching,
  type Phase0Scenario,
} from "./rule-catalog.js"
import {
  extractBulletPolicies,
  fallbackRuleMetadata,
  type RuleDeliveryRole,
  type RuleMetadata,
} from "./rule-frontmatter.js"
import { takePoliciesForDelivery } from "./rule-delivery.js"
import type { RuleFrontmatterDiagnostic } from "./rule-frontmatter-diagnostics.js"

export type { Phase0Scenario } from "./rule-catalog.js"

export type LoadedRule = {
  readonly path: string
  readonly metadata: RuleMetadata
  readonly diagnostics: readonly RuleFrontmatterDiagnostic[]
  readonly policies: readonly string[]
}

const DEFAULT_SCENARIO: Phase0Scenario = "step1"
const STEP1_API_CONTRACT_RULE = "backend/step1-api-contract.md"
const STEP2_3_API_CONTRACT_RULE = "backend/step2-3-api-contract.md"

type RuleFileRole =
  | "controller"
  | "service"
  | "repository"
  | "entity"
  | "domain"
  | "request-dto"
  | "response-dto"
  | "exception"
  | "test"
  | "java-common"
  | "project-bootstrap"
  | "requirements-bootstrap"
  | "gradle-bootstrap"

const CONTRACT_RULE_ROLES = new Set<RuleFileRole>(["controller", "request-dto", "response-dto", "test"])

const COMMON_RULES = [
  "clean-code/common.md",
  "clean-code/method-design.md",
  "backend/java-common.md",
] as const

const RULE_PATHS_BY_FILE_ROLE: Record<RuleFileRole, readonly string[]> = {
  controller: ["backend/spring-controller.md", "backend/spring-dto.md", STEP1_API_CONTRACT_RULE],
  service: ["backend/spring-service.md", "backend/validation-exception.md"],
  repository: ["backend/spring-repository.md"],
  entity: ["clean-code/oop.md", "backend/spring-entity.md"],
  domain: ["clean-code/oop.md", "backend/layered-architecture.md"],
  "request-dto": ["backend/spring-dto.md", STEP1_API_CONTRACT_RULE],
  "response-dto": ["backend/spring-dto.md", STEP1_API_CONTRACT_RULE],
  exception: ["backend/validation-exception.md"],
  test: ["clean-code/testability.md", "backend/spring-test.md", STEP1_API_CONTRACT_RULE],
  "java-common": ["clean-code/abstraction.md", "backend/layered-architecture.md"],
  "project-bootstrap": ["backend/java-backend-bootstrap.md"],
  "requirements-bootstrap": ["backend/java-backend-bootstrap.md"],
  "gradle-bootstrap": ["backend/gradle-bootstrap.md", "backend/java-backend-bootstrap.md"],
}

function isRuleFileRole(fileRole: FileRole): fileRole is RuleFileRole {
  switch (fileRole) {
    case "controller":
    case "service":
    case "repository":
    case "entity":
    case "domain":
    case "request-dto":
    case "response-dto":
    case "exception":
    case "test":
    case "java-common":
    case "project-bootstrap":
    case "requirements-bootstrap":
    case "gradle-bootstrap":
      return true
    case "typescript":
    case "frontend":
    case "infra":
    case "shared-skill":
      return false
  }
}

function contractRuleForScenario(scenario: Phase0Scenario): string {
  return scenario === "step2-3" ? STEP2_3_API_CONTRACT_RULE : STEP1_API_CONTRACT_RULE
}

function isStepContractRule(rulePath: string): boolean {
  return rulePath === STEP1_API_CONTRACT_RULE || rulePath === STEP2_3_API_CONTRACT_RULE
}

function isLegacyStepFixtureTarget(targetPath: string): boolean {
  const normalizedTargetPath = targetPath.replace(/\\/g, "/")
  const match = normalizedTargetPath.match(/(?:^|\/)src\/(?:main|test)\/java\/([^/]+)\/([^/]+\.java)$/)
  return match?.[1] !== undefined && isContractFixtureFile(match[2])
}

function isContractFixtureFile(fileName: string | undefined): boolean {
  return fileName !== undefined && /(?:Controller|Test|Request|Response)\.java$/.test(fileName)
}

function scenarioAwareRoleRules(fileRole: FileRole, scenario: Phase0Scenario): readonly string[] {
  if (!isRuleFileRole(fileRole)) {
    return []
  }

  const roleRules = RULE_PATHS_BY_FILE_ROLE[fileRole]
  if (!CONTRACT_RULE_ROLES.has(fileRole)) {
    return roleRules
  }

  const contractRule = contractRuleForScenario(scenario)
  return roleRules.map((rulePath) => (rulePath === STEP1_API_CONTRACT_RULE ? contractRule : rulePath))
}

export function selectRulePaths(fileRole: FileRole, scenario: Phase0Scenario = DEFAULT_SCENARIO): string[] {
  if (!isRuleFileRole(fileRole)) {
    return []
  }

  return Array.from(new Set([...COMMON_RULES, ...scenarioAwareRoleRules(fileRole, scenario)]))
}

function supportsDeliveryRole(metadata: RuleMetadata, deliveryRole: RuleDeliveryRole): boolean {
  return metadata.roles.includes(deliveryRole)
}

export function loadRulesForRole(
  projectDir: string,
  fileRole: FileRole,
  targetFile?: string,
  deliveryRole: RuleDeliveryRole = "main",
): LoadedRule[] {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return []
  }
  const config = configResult.config
  if (!inspectRuleCatalogPaths(projectDir).safe) {
    return []
  }
  const scenario = config.scenario
  const catalog = new Map(loadRuleCatalog(projectDir).map((entry) => [entry.path, entry]))
  const rulesDir = resolveConfiguredPath(projectDir, config.rulesDir)
  const targetPath = targetPathForMatching(projectDir, fileRole, targetFile)

  return selectRulePaths(fileRole, scenario).flatMap((rulePath) => {
    if (isStepContractRule(rulePath) && !isLegacyStepFixtureTarget(targetPath)) {
      return []
    }

    const catalogEntry = catalog.get(rulePath)
    if (catalogEntry !== undefined) {
      if (!supportsDeliveryRole(catalogEntry.metadata, deliveryRole)) {
        return []
      }

      if (
        !isRuleEligibleForTarget(catalogEntry, fileRole, scenario, targetPath)
      ) {
        return []
      }

      return {
        path: rulePath,
        metadata: catalogEntry.metadata,
        diagnostics: catalogEntry.diagnostics,
        policies: takePoliciesForDelivery(rulePath, catalogEntry.policies, catalogEntry.metadata.maxBullets),
      }
    }

    if (deliveryRole !== "main") {
      return []
    }

    const absolutePath = join(rulesDir, rulePath)
    const metadata = fallbackRuleMetadata(rulePath)
    if (!existsSync(absolutePath)) {
      return { path: rulePath, metadata, diagnostics: [], policies: [] }
    }

    return {
      path: rulePath,
      metadata,
      diagnostics: [],
      policies: takePoliciesForDelivery(rulePath, extractBulletPolicies(readFileSync(absolutePath, "utf8"))),
    }
  })
}
