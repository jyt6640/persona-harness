import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import { renderReleaseBody } from "../scripts/generate-github-release-notes.mjs"

const repositoryRoot = process.cwd()

function readRepositoryFile(path: string) {
  return readFileSync(join(repositoryRoot, path), "utf8")
}

describe("public release truth", () => {
  it("separates the current source authority from the published 0.8.24 stable record", () => {
    const releaseNotes = readRepositoryFile("docs/current/release/v0.8.25-release-notes.md")
    const releaseHistory = readRepositoryFile("docs/current/release/history.md")
    const changelog = readRepositoryFile("CHANGELOG.md")
    const packageIndex = readRepositoryFile("docs/releases/package-index.md")

    expect(releaseNotes).not.toMatch(/\\bunpublished\\b/i)
    expect(releaseNotes).not.toMatch(/\\bsource candidate\\b/i)
    expect(releaseHistory).toContain("| npm `latest` | `0.8.24` |")
    expect(releaseHistory).toContain("| GitHub latest release | `v0.8.24` |")
    expect(changelog).toMatch(/^## \[0\.8\.24\] - 2026-08-22$/m)
    expect(packageIndex).toContain("| `0.8.24` | 2026-08-22 | published stable `latest`")
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
