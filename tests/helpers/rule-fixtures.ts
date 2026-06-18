import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"

import { isRuleEligibleForTarget, type Phase0Scenario, type RuleCatalogEntry } from "../../src/phase0/rule-catalog.js"
import type { FileRole } from "../../src/phase0/types.js"

let projectDirs: string[] = []

export function cleanupProjects(): void {
  for (const projectDir of projectDirs) {
    rmSync(projectDir, { recursive: true, force: true })
  }
  projectDirs = []
}

export function createProject(): string {
  const projectDir = mkdtempSync(join(tmpdir(), "persona-rule-catalog-"))
  projectDirs.push(projectDir)
  return projectDir
}

export function writeScenario(projectDir: string, scenario: Phase0Scenario): void {
  mkdirSync(join(projectDir, ".persona"), { recursive: true })
  writeFileSync(join(projectDir, ".persona", "harness.jsonc"), `${JSON.stringify({ scenario }, null, 2)}\n`)
}

export function writeRule(
  projectDir: string,
  rulePath: string,
  frontmatter: string,
  policies: readonly string[],
): void {
  const absolutePath = join(projectDir, ".persona", "rules", rulePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  const body = policies.map((policy) => `- ${policy}`).join("\n")
  writeFileSync(absolutePath, `---\n${frontmatter.trim()}\n---\n\n# Test Rule\n\n${body}\n`)
}

export function writeMalformedRule(projectDir: string, rulePath: string): void {
  const absolutePath = join(projectDir, ".persona", "rules", rulePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(
    absolutePath,
    [
      "---",
      "id: malformed.rule",
      "globs:",
      "  - \"**/*Controller.java\"",
      "scenario: step1",
      "",
      "# Missing Closing Marker",
      "",
      "- malformed policy",
      "",
    ].join("\n"),
  )
}

export function findEntry(catalog: readonly RuleCatalogEntry[], rulePath: string): RuleCatalogEntry {
  const entry = catalog.find((candidate) => candidate.path === rulePath)
  if (entry === undefined) {
    throw new Error(`Missing test rule: ${rulePath}`)
  }
  return entry
}

export function eligible(
  entry: RuleCatalogEntry,
  fileRole: FileRole,
  scenario: Phase0Scenario,
  targetPath: string,
): boolean {
  return isRuleEligibleForTarget(entry, fileRole, scenario, targetPath)
}
