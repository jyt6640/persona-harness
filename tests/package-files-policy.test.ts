import { existsSync, readFileSync } from "node:fs"
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
      "docs/releases/README.md",
      "docs/releases/v0.6.0-rc.4/README.md",
      "docs/releases/package-index.md",
      "docs/current/release/README.md",
      "docs/current/release/v0.6.0-rc.4-release-notes.md",
      "docs/current/canonical-docs-index.md",
      "docs/current/external-review-adoption-status.md",
      "docs/current/ralph-loop-measurement-status.md",
      "docs/current/multiagent-relay-trial-status.md",
      "docs/current/rail-entry-measurement-status.md",
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
