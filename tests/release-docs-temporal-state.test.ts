import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

const root = process.cwd()
const publicReleaseDocs = [
  "README.md",
  "CHANGELOG.md",
  "docs/current/README.md",
  "docs/current/canonical-docs-index.md",
  "docs/current/release/README.md",
  "docs/current/release/v0.7.0-rc.7-release-notes.md",
  "docs/current/release/v0.7.0-rc.8-release-notes.md",
  "docs/current/release/v0.7.0-release-notes.md",
  "docs/current/release/v0.8.0-beta.1-release-notes.md",
]

describe("release docs temporal-state boundary", () => {
  it("keeps the consumer authority beta source candidate free of beta publication claims", () => {
    const text = publicReleaseDocs
      .map((path) => readFileSync(join(root, path), "utf8"))
      .join("\n")

    expect(text).not.toContain("No `v0.7.0-rc.7` tag")
    expect(text).not.toContain("is not published: no `v0.7.0-rc.7`")
    expect(text).not.toContain("RC7 npm package, Git tag, GitHub prerelease")
    expect(text).not.toContain("no `v0.7.0-rc.7` tag, GitHub prerelease, npm package")
    expect(text).not.toContain("persona-harness@0.8.0-beta.1 is published")
    expect(text).not.toContain("GitHub release `v0.8.0-beta.1` has been created")
    expect(text).not.toContain("staging=0.8.0-beta.1")
    expect(text).toContain("governed registry and audit records")
    expect(text).toContain("Consumer Authority Beta source-preparation candidate")
    expect(text).toContain("latest=0.7.0")
    expect(text).toContain("expected non-authoritative block")
  })
})
