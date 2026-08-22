import { describe, expect, it } from "vitest"

import {
  inferDistTag,
  renderReleaseBody,
} from "../scripts/generate-github-release-notes.mjs"

describe("GitHub release note metadata", () => {
  it("describes a Consumer Authority beta as staging-first rather than an arbitrary beta channel", () => {
    expect(inferDistTag("0.8.0-beta.1")).toBe("staging")
  })

  it("rejects source-candidate language from a stable GitHub release body", () => {
    expect(() => renderStableBody("`0.8.25` is the current unpublished package authority.")).toThrow(
      "stable-release-source-candidate-language",
    )
    expect(() => renderStableBody("This immutable source candidate is ready for review.")).toThrow(
      "stable-release-source-candidate-language",
    )
  })

  it("keeps the stable release body final-safe while retaining narrow claim boundaries", () => {
    const body = renderStableBody("This release keeps the public contract factual and bounded.")

    expect(body).toContain("## Release Status")
    expect(body).toContain("This GitHub Release records `v0.8.25` for the `latest` npm release")
    expect(body).toContain("The governed workflows, not this prose, verify source/tag/package identity")
    expect(body).not.toContain("does not select a current workflow lifecycle state")
    expect(body).not.toContain("release creation, or release completion")
  })

  it("allows source-candidate language for prerelease channels", () => {
    expect(() => renderReleaseBody({
      tagName: "v0.8.25-beta.1",
      version: "0.8.25-beta.1",
      distTag: "staging",
      releaseNotes: "# v0.8.25-beta.1 Release Notes\\n\\nThis source candidate is unpublished.",
      releaseNotesPath: "docs/current/release/v0.8.25-beta.1-release-notes.md",
    })).not.toThrow()
  })
})

function renderStableBody(releaseContent: string) {
  return renderReleaseBody({
    tagName: "v0.8.25",
    version: "0.8.25",
    distTag: "latest",
    releaseNotes: `# v0.8.25 Release Notes\\n\\n${releaseContent}`,
    releaseNotesPath: "docs/current/release/v0.8.25-release-notes.md",
  })
}
