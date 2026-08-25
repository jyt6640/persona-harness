import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { renderReleaseBody } from "../scripts/generate-github-release-notes.mjs"

const repositoryRoot = process.cwd()

function readRepositoryFile(path: string) {
  return readFileSync(join(repositoryRoot, path), "utf8")
}

describe("public release truth", () => {
  it("keeps live release lookup out of package-visible current documents", () => {
    const releaseNotes = readRepositoryFile("docs/current/release/v0.8.32-release-notes.md")
    const releaseOperations = readRepositoryFile("docs/current/release/README.md")
    const releaseHistory = readRepositoryFile("docs/current/release/history.md")
    const changelog = readRepositoryFile("CHANGELOG.md")
    const packageIndex = readRepositoryFile("docs/releases/package-index.md")
    const releaseDocs = readRepositoryFile("docs/releases/README.md")

    expect(releaseNotes).not.toMatch(/\bunpublished\b/i)
    expect(releaseNotes).not.toMatch(/\bsource candidate\b/i)
    for (const document of [releaseOperations, releaseHistory, packageIndex]) {
      expect(document).toContain("https://www.npmjs.com/package/persona-harness?activeTab=versions")
      expect(document).toContain("https://github.com/jyt6640/persona-harness/releases")
    }
    expect(releaseOperations).not.toMatch(/\| npm `latest` \| `\d/)
    expect(releaseHistory).not.toMatch(/\| npm `latest` \| `\d/)
    expect(packageIndex.split("## Reading Rules", 1)[0]).not.toMatch(/npm `latest`: `\d/)
    expect(changelog).toMatch(/^## \[0\.8\.31\] - 2026-08-25$/m)
    expect(packageIndex).toContain("| `0.8.31` | 2026-08-25 | published stable release")
    expect(releaseDocs).toContain("live lookup links")
  })

  it("keeps the historical stable release notes renderable as a final GitHub Release body", () => {
    const releaseNotesPath = "docs/current/release/v0.8.24-release-notes.md"

    expect(() => renderReleaseBody({
      tagName: "v0.8.24",
      version: "0.8.24",
      distTag: "latest",
      releaseNotes: readRepositoryFile(releaseNotesPath),
      releaseNotesPath,
    })).not.toThrow()
  })

  it("documents the difference between the focused and repository-wide verification commands", () => {
    const readme = readRepositoryFile("README.md")
    const contributing = readRepositoryFile("CONTRIBUTING.md")

    for (const document of [readme, contributing]) {
      expect(document).toContain("npm run test:repository")
      expect(document).toContain("full repository contract")
    }
  })
})
