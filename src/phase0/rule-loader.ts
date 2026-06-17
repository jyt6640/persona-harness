import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

import type { FileRole } from "./types.js"

export type LoadedRule = {
  path: string
  policies: string[]
}

const COMMON_RULES = [
  "clean-code/common.md",
  "clean-code/method-design.md",
  "backend/java-common.md",
] as const

const ROLE_RULES: Record<FileRole, readonly string[]> = {
  controller: ["backend/spring-controller.md", "backend/spring-dto.md", "backend/step1-api-contract.md"],
  service: ["backend/spring-service.md", "backend/validation-exception.md"],
  repository: ["backend/spring-repository.md"],
  entity: ["clean-code/oop.md", "backend/spring-entity.md"],
  domain: ["clean-code/oop.md", "backend/layered-architecture.md"],
  "request-dto": ["backend/spring-dto.md", "backend/step1-api-contract.md"],
  "response-dto": ["backend/spring-dto.md", "backend/step1-api-contract.md"],
  exception: ["backend/validation-exception.md"],
  test: ["clean-code/testability.md", "backend/spring-test.md", "backend/step1-api-contract.md"],
  "java-common": ["clean-code/abstraction.md"],
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
  if (rulePath === "backend/step1-api-contract.md") {
    return policies.slice(0, 3)
  }
  const limit = rulePath === "clean-code/method-design.md" ? 1 : 2
  return policies.slice(0, limit)
}

export function selectRulePaths(fileRole: FileRole): string[] {
  return Array.from(new Set([...COMMON_RULES, ...ROLE_RULES[fileRole]]))
}

export function loadRulesForRole(projectDir: string, fileRole: FileRole): LoadedRule[] {
  return selectRulePaths(fileRole).map((rulePath) => {
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
