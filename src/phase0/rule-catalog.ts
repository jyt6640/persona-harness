import { existsSync, readdirSync, readFileSync } from "node:fs"
import { isAbsolute, join, relative, sep } from "node:path"

import type { FileRole } from "./types.js"
import { loadHarnessConfig, resolveConfiguredPath } from "./harness-config.js"
import { matchesAnyGlob, normalizePath } from "./rule-glob.js"
import {
  extractBulletPolicies,
  parseRuleFrontmatter,
  type Phase0Scenario,
  type RuleMetadata,
} from "./rule-frontmatter.js"
import type { RuleFrontmatterDiagnostic } from "./rule-frontmatter-diagnostics.js"

export type { Phase0Scenario } from "./rule-frontmatter.js"

export type RuleCatalogEntry = {
  readonly path: string
  readonly absolutePath: string
  readonly metadata: RuleMetadata
  readonly diagnostics: readonly RuleFrontmatterDiagnostic[]
  readonly policies: readonly string[]
}

function listMarkdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return listMarkdownFiles(path)
    }
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : []
  })
}

export function loadRuleCatalog(projectDir: string): RuleCatalogEntry[] {
  const config = loadHarnessConfig(projectDir)
  const rulesDir = resolveConfiguredPath(projectDir, config.rulesDir)
  if (!existsSync(rulesDir)) {
    return []
  }

  return listMarkdownFiles(rulesDir)
    .sort()
    .map((absolutePath) => {
      const rulePath = normalizePath(relative(rulesDir, absolutePath).split(sep).join("/"))
      const markdown = readFileSync(absolutePath, "utf8")
      const frontmatter = parseRuleFrontmatter(rulePath, markdown)
      return {
        path: rulePath,
        absolutePath,
        metadata: frontmatter.metadata,
        diagnostics: frontmatter.diagnostics,
        policies: extractBulletPolicies(markdown),
      }
    })
}

function syntheticTargetForRole(fileRole: FileRole): string {
  if (fileRole === "controller") return "src/main/java/com/example/ReservationController.java"
  if (fileRole === "service") return "src/main/java/com/example/ReservationService.java"
  if (fileRole === "repository") return "src/main/java/com/example/ReservationRepository.java"
  if (fileRole === "entity") return "src/main/java/com/example/ReservationEntity.java"
  if (fileRole === "domain") return "src/main/java/com/example/domain/Reservation.java"
  if (fileRole === "request-dto") return "src/main/java/com/example/ReservationRequest.java"
  if (fileRole === "response-dto") return "src/main/java/com/example/ReservationResponse.java"
  if (fileRole === "exception") return "src/main/java/com/example/ReservationException.java"
  if (fileRole === "test") return "src/test/java/com/example/ReservationTest.java"
  return "src/main/java/com/example/Reservation.java"
}

export function targetPathForMatching(projectDir: string, fileRole: FileRole, targetFile?: string): string {
  if (targetFile === undefined) {
    return syntheticTargetForRole(fileRole)
  }
  const normalizedTarget = normalizePath(targetFile)
  if (!isAbsolute(targetFile)) {
    return normalizedTarget
  }
  const relativeTarget = normalizePath(relative(projectDir, targetFile))
  return relativeTarget.startsWith("..") ? normalizedTarget : relativeTarget
}

function matchesRuleGlob(entry: RuleCatalogEntry, targetPath: string): boolean {
  return matchesAnyGlob(entry.metadata.globs, targetPath)
}

function matchesRuleScenario(entry: RuleCatalogEntry, scenario: Phase0Scenario): boolean {
  return entry.metadata.scenario === "all" || entry.metadata.scenario === scenario
}

export function isRuleEligibleForTarget(
  entry: RuleCatalogEntry,
  fileRole: FileRole,
  scenario: Phase0Scenario,
  targetPath: string,
): boolean {
  return matchesRuleGlob(entry, targetPath) && matchesRuleScenario(entry, scenario)
}
