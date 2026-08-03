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
  "docs/current/release/v0.8.0-beta.2-release-notes.md",
  "docs/current/release/v0.8.0-beta.3-release-notes.md",
  "docs/current/release/v0.8.0-beta.7-release-notes.md",
  "docs/current/release/v0.8.0-beta.8-release-notes.md",
  "docs/current/release/v0.8.0-beta.9-release-notes.md",
  "docs/current/release/v0.8.0-beta.10-release-notes.md",
  "docs/current/release/v0.8.0-beta.11-release-notes.md",
  "docs/current/release/v0.8.0-beta.12-release-notes.md",
  "docs/current/release/v0.8.0-beta.13-release-notes.md",
  "docs/current/release/v0.8.0-beta.14-release-notes.md",
  "docs/current/release/v0.8.0-beta.15-release-notes.md",
  "docs/current/release/v0.8.0-beta.16-release-notes.md",
  "docs/current/release/v0.8.0-beta.18-release-notes.md",
  "docs/current/release/v0.8.0-beta.19-release-notes.md",
  "docs/current/release/v0.8.0-beta.20-release-notes.md",
  "docs/current/release/v0.8.0-beta.21-release-notes.md",
  "docs/current/release/v0.8.0-beta.22-release-notes.md",
  "docs/current/release/v0.8.0-beta.27-release-notes.md",
  "docs/current/release/v0.8.0-beta.28-release-notes.md",
  "docs/current/release/v0.8.0-beta.29-release-notes.md",
  "docs/current/release/v0.8.0-beta.30-release-notes.md",
]

describe("release docs temporal-state boundary", () => {
  it("keeps historical final-observer evidence distinct from the beta.29 strict package-record procedure candidate", () => {
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
    expect(text).toContain("immutable staging-only Consumer Authority Beta")
    expect(text).toContain("0.8.0-beta.18")
    expect(text).toContain("0.8.0-beta.19")
    expect(text).toContain("0.8.0-beta.20")
    expect(text).toContain("0.8.0-beta.21")
    expect(text).toContain("0.8.0-beta.22")
    expect(text).toContain("0.8.0-beta.23")
    expect(text).toContain("0.8.0-beta.25")
    expect(text).toContain("consumer-authority-beta22-acceptance.json")
    expect(text).toContain("consumer-authority-beta23-acceptance.json")
    expect(text).toContain("consumer-authority-beta27-acceptance.json")
    expect(text).toContain("consumer-authority-beta28-acceptance.json")
    expect(text).toContain("consumer-authority-beta29-acceptance.json")
    expect(text).toContain("consumer-authority-beta30-acceptance.json")
    expect(text).toContain("workflow-verified-canonical-tar")
    expect(text).toContain("registry gitHead")
    expect(text).toContain("no usable GitHub Actions read credential")
    expect(text).toContain("preflight-consumer-authority-observer.mjs")
    expect(text).toContain("preflight-consumer-authority-external-attestation.mjs")
    expect(text).toContain("preflight-consumer-authority-external-artifact-transport.mjs")
    expect(text).toContain("streaming 65536-byte ceiling before decoding")
    expect(text).toContain("assembled outside the caller workspace")
    expect(text).toContain("project-root transaction")
    expect(text).toContain("`.persona/workflow` paths with no-follow semantics")
    expect(text).toContain("expected non-authoritative block")
    expect(text).toContain("native descriptor traversal")
    expect(text).toContain("bootstrap-local `.persona/.ph-init-manifest.json`")
    expect(text).toContain("same consumer workflow state")
    expect(text).toContain("source-bound bootstrap before the final fixture commit")
    expect(text).toContain("same unpushed final fixture commit")
    expect(text).toContain("host-state isolation")
    expect(text).toContain("workflow-selected observer-gh")
    expect(text).toContain("stage-scoped residue")
  })
})
