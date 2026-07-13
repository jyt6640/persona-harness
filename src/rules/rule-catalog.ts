import { isAbsolute, relative } from "node:path"

import type { FileRole } from "../runtime/types.js"
import { loadHarnessConfigResult, resolveConfiguredPath } from "../config/harness-config.js"
import {
  walkBoundedFiles,
  type BoundedWalkResult,
} from "../io/bounded-path-walker.js"
import { matchesAnyGlob, normalizePath } from "./rule-glob.js"
import {
  extractBulletPolicies,
  parseRuleFrontmatter,
  type Phase0Scenario,
  type RuleMetadata,
} from "./rule-frontmatter.js"
import { duplicateRuleId, type RuleFrontmatterDiagnostic } from "./rule-frontmatter-diagnostics.js"

export type { Phase0Scenario } from "./rule-frontmatter.js"

export type RuleCatalogEntry = {
  readonly path: string
  readonly absolutePath: string
  readonly metadata: RuleMetadata
  readonly diagnostics: readonly RuleFrontmatterDiagnostic[]
  readonly policies: readonly string[]
}

function addDuplicateRuleIdDiagnostics(entries: readonly RuleCatalogEntry[]): RuleCatalogEntry[] {
  const pathsById = new Map<string, string[]>()
  for (const entry of entries) {
    const paths = pathsById.get(entry.metadata.id) ?? []
    paths.push(entry.path)
    pathsById.set(entry.metadata.id, paths)
  }

  return entries.map((entry) => {
    const duplicatePaths = (pathsById.get(entry.metadata.id) ?? []).filter((path) => path !== entry.path)
    if (duplicatePaths.length === 0) {
      return entry
    }
    return {
      ...entry,
      diagnostics: [
        ...entry.diagnostics,
        ...duplicatePaths.map((duplicatePath) => duplicateRuleId(entry.metadata.id, duplicatePath)),
      ],
    }
  })
}

function unsafeRuleCatalogResult(): BoundedWalkResult {
  return {
    diagnostics: [{
      code: "config.path_invalid",
      message: "Harness configuration is invalid; rule traversal is blocked until read-only recovery.",
      path: ".persona/harness.jsonc",
    }],
    files: [],
    present: false,
    safe: false,
  }
}

export function inspectRuleCatalogPaths(projectDir: string): BoundedWalkResult {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return unsafeRuleCatalogResult()
  }
  const rulesDir = resolveConfiguredPath(projectDir, configResult.config.rulesDir)
  return walkBoundedFiles(rulesDir, projectDir, {
    displayRoot: configResult.config.rulesDir,
    extensions: [".md"],
    includeText: true,
  })
}

export function loadRuleCatalog(projectDir: string): RuleCatalogEntry[] {
  const configResult = loadHarnessConfigResult(projectDir)
  if (!configResult.safe) {
    return []
  }
  const config = configResult.config
  const rulesDir = resolveConfiguredPath(projectDir, config.rulesDir)
  const walked = inspectRuleCatalogPaths(projectDir)
  if (!walked.safe) {
    return []
  }

  const entries = walked.files
    .map((file): RuleCatalogEntry | undefined => {
      if (file.text === undefined) {
        return undefined
      }
      const rulePath = normalizePath(relative(rulesDir, file.absolutePath))
      const markdown = file.text
      const frontmatter = parseRuleFrontmatter(rulePath, markdown)
      return {
        path: rulePath,
        absolutePath: file.absolutePath,
        metadata: frontmatter.metadata,
        diagnostics: frontmatter.diagnostics,
        policies: extractBulletPolicies(markdown),
      }
    })
    .filter((entry): entry is RuleCatalogEntry => entry !== undefined)
    .sort((left, right) => left.path.localeCompare(right.path))
  return addDuplicateRuleIdDiagnostics(entries)
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
