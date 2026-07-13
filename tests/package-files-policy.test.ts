import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"

import { describe, expect, it } from "vitest"

type PackageJson = {
  readonly files: readonly string[]
}

type MarkdownLink = {
  readonly href: string
  readonly label: string
}

const packageRoot = process.cwd()

describe("package files policy", () => {
  it("packages public rules while retaining diff-rules only as repository source material", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const ruleFiles = listRuleMarkdownFiles(path.join(packageRoot, ".persona/rules")).map((filePath) =>
      toPackagePath(path.relative(packageRoot, filePath)),
    )
    const diffRuleFiles = ruleFiles.filter((filePath) => filePath.startsWith(".persona/rules/diff-rules/"))
    const packagedRuleFiles = ruleFiles.filter((filePath) => !filePath.startsWith(".persona/rules/diff-rules/"))

    expect(ruleFiles).toHaveLength(48)
    expect(diffRuleFiles).toHaveLength(28)
    expect(packagedRuleFiles).toHaveLength(20)
    expect(packageJson.files).not.toContain(".persona/rules/diff-rules")

    for (const ruleFile of packagedRuleFiles) {
      expect(isCoveredByPackageFiles(ruleFile, packageJson.files)).toBe(true)
    }
    for (const ruleFile of diffRuleFiles) {
      expect(isCoveredByPackageFiles(ruleFile, packageJson.files)).toBe(false)
    }
  })

  it("keeps all source convention yaml files covered by packaged files", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const conventionFiles = listConventionFiles(path.join(packageRoot, ".persona/conventions")).map((filePath) =>
      toPackagePath(path.relative(packageRoot, filePath)),
    )

    expect(conventionFiles).toHaveLength(8)

    for (const conventionFile of conventionFiles) {
      expect(isCoveredByPackageFiles(conventionFile, packageJson.files)).toBe(true)
    }
  })

  it("keeps the entry intent corpus and measurement scripts source-only", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))

    expect(existsSync(path.join(packageRoot, "experiments/entry-intent-corpus/corpus.json"))).toBe(true)
    expect(packageJson.files).not.toContain("experiments")
    expect(isCoveredByPackageFiles("experiments/entry-intent-corpus/corpus.json", packageJson.files)).toBe(false)
    expect(isCoveredByPackageFiles("experiments/entry-intent-corpus/measure.mjs", packageJson.files)).toBe(false)
  })

  it("keeps P3 adversarial closure fixtures source-only", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))

    expect(existsSync(path.join(packageRoot, "experiments/p3-adversarial-closure-fixtures/corpus.json"))).toBe(true)
    expect(packageJson.files).not.toContain("experiments")
    expect(isCoveredByPackageFiles("experiments/p3-adversarial-closure-fixtures/corpus.json", packageJson.files)).toBe(false)
    expect(isCoveredByPackageFiles("experiments/p3-adversarial-closure-fixtures/validate.mjs", packageJson.files)).toBe(false)
  })

  it("keeps direct current README links covered by packaged files", () => {
    const packageJson = readPackageJson(path.join(packageRoot, "package.json"))
    const currentReadmePath = path.join(packageRoot, "docs/current/README.md")
    const currentReadme = readFileSync(currentReadmePath, "utf8")
    const links = extractDirectRelativeMarkdownLinks(currentReadme)

    const linkedFiles = links.map((link) => {
      const resolved = path.relative(packageRoot, path.resolve(path.dirname(currentReadmePath), link.href))
      return toPackagePath(resolved)
    })

    expect(linkedFiles).toEqual([
      "README.md",
      "docs/START-HERE.md",
      "docs/QUICK-DEMO.md",
      "docs/MEASURED-CLAIMS.md",
      "docs/releases/README.md",
      "docs/releases/v0.7.0-rc.2/README.md",
      "docs/releases/v0.7.0-rc.1/README.md",
      "docs/releases/v0.6.0/README.md",
      "docs/releases/package-index.md",
      "docs/current/release/README.md",
      "docs/current/release/v0.7.0-rc.2-release-notes.md",
      "docs/current/p3-integrity-roadmap.md",
      "docs/current/canonical-docs-index.md",
      "docs/current/external-review-adoption-status.md",
      "docs/current/diff-rules-classification.md",
      "docs/current/role-rules-dogfooding-readiness.md",
      "docs/current/workflow-string-gate-parsing-audit.md",
      "docs/current/workflow-state-concurrency.md",
      "docs/current/role-scoped-rule-delivery.md",
      "docs/current/ralph-loop-measurement-status.md",
      "docs/current/multiagent-relay-trial-status.md",
      "docs/current/rail-entry-measurement-status.md",
      "docs/current/entry-steering-status.md",
      "docs/current/rail-entry-prompt-regression-gate.md",
      "docs/current/measurement-scorecard.md",
      "docs/current/injection-value-status.json",
      "docs/current/docs-inventory.md",
    ])

    for (const linkedFile of linkedFiles) {
      expect(existsSync(path.join(packageRoot, linkedFile))).toBe(true)
      expect(isCoveredByPackageFiles(linkedFile, packageJson.files)).toBe(true)
    }
  })
})

function listRuleMarkdownFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        return listRuleMarkdownFiles(entryPath)
      }
      return entry.isFile() && entry.name.endsWith(".md") ? [entryPath] : []
    })
    .sort()
}

function listConventionFiles(directory: string): readonly string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name)
      if (entry.isDirectory()) {
        return listConventionFiles(entryPath)
      }
      return entry.isFile() && /\.(ya?ml)$/iu.test(entry.name) ? [entryPath] : []
    })
    .sort()
}

function readPackageJson(filePath: string): PackageJson {
  const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"))
  if (!isPackageJson(parsed)) {
    throw new TypeError(`Invalid package metadata: ${filePath}`)
  }
  return parsed
}

function extractDirectRelativeMarkdownLinks(markdown: string): readonly MarkdownLink[] {
  const links: MarkdownLink[] = []
  const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g

  for (const match of markdown.matchAll(linkPattern)) {
    const label = match[1]
    const href = match[2]
    if (label === undefined || href === undefined) continue
    if (href.startsWith("#") || href.includes("://")) continue
    links.push({ href, label })
  }

  return links
}

function isCoveredByPackageFiles(filePath: string, files: readonly string[]): boolean {
  return files.some((entry) => packageFileEntryCoversPath(entry, filePath))
}

function packageFileEntryCoversPath(entry: string, filePath: string): boolean {
  const normalizedEntry = toPackagePath(entry)
  const normalizedFilePath = toPackagePath(filePath)
  return normalizedFilePath === normalizedEntry || normalizedFilePath.startsWith(`${normalizedEntry}/`)
}

function toPackagePath(filePath: string): string {
  return filePath.split(path.sep).join("/")
}

function isPackageJson(value: unknown): value is PackageJson {
  return isRecord(value) && isStringArray(value["files"])
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
