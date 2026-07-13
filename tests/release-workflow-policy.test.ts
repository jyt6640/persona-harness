import { describe, expect, it } from "vitest"

import {
  checkCanonicalMainSource,
  checkDistTagCompatibility,
  checkRegistryMetadata,
  checkReleaseState,
  checkTagSource,
} from "../scripts/release-workflow-policy.mjs"

const MAIN_SHA = "a".repeat(40)
const TAG_SHA = "b".repeat(40)
const INTEGRITY = "sha512-" + "c".repeat(86)

describe("release workflow policy", () => {
  it("accepts an exact canonical main source", () => {
    expect(checkCanonicalMainSource({
      canonicalMainSha: MAIN_SHA,
      isAncestor: true,
      ref: "refs/heads/main",
      sha: MAIN_SHA,
    })).toEqual({ ok: true })
  })

  it.each([
    ["a non-main ref", { ref: "refs/heads/feature/test", sha: MAIN_SHA, canonicalMainSha: MAIN_SHA, isAncestor: true }, "canonical-main-ref"],
    ["a stale main commit", { ref: "refs/heads/main", sha: TAG_SHA, canonicalMainSha: MAIN_SHA, isAncestor: true }, "canonical-main-sha"],
    ["a non-ancestor source", { ref: "refs/heads/main", sha: MAIN_SHA, canonicalMainSha: MAIN_SHA, isAncestor: false }, "canonical-main-ancestry"],
  ])("rejects %s", (_label, input, code) => {
    expect(checkCanonicalMainSource(input)).toMatchObject({ ok: false, code })
  })

  it("accepts a matching tag on canonical main", () => {
    expect(checkTagSource({
      canonicalMainSha: MAIN_SHA,
      isAncestor: true,
      packageVersion: "0.7.0-rc.1",
      sha: TAG_SHA,
      tagCommit: TAG_SHA,
      tagName: "v0.7.0-rc.1",
    })).toEqual({ ok: true })
  })

  it("rejects a tag that is not the package version or main ancestry", () => {
    expect(checkTagSource({
      canonicalMainSha: MAIN_SHA,
      isAncestor: false,
      packageVersion: "0.7.0-rc.1",
      sha: TAG_SHA,
      tagCommit: TAG_SHA,
      tagName: "v0.7.0",
    })).toMatchObject({ ok: false, code: "release-tag-version" })
    expect(checkTagSource({
      canonicalMainSha: MAIN_SHA,
      isAncestor: false,
      packageVersion: "0.7.0-rc.1",
      sha: TAG_SHA,
      tagCommit: TAG_SHA,
      tagName: "v0.7.0-rc.1",
    })).toMatchObject({ ok: false, code: "release-tag-ancestry" })
  })

  it.each([
    ["prerelease next", "0.7.0-rc.1", "next"],
    ["stable latest", "0.7.0", "latest"],
  ])("accepts %s", (_label, version, distTag) => {
    expect(checkDistTagCompatibility({ distTag, version })).toEqual({ ok: true })
  })

  it.each([
    ["prerelease latest", "0.7.0-rc.1", "latest"],
    ["stable next", "0.7.0", "next"],
    ["unsupported tag", "0.7.0", "beta"],
  ])("rejects %s", (_label, version, distTag) => {
    expect(checkDistTagCompatibility({ distTag, version })).toMatchObject({ ok: false })
  })

  it("requires registry version, gitHead, shasum, integrity, and dist-tag", () => {
    const metadata = {
      version: "0.7.0-rc.1",
      gitHead: TAG_SHA,
      "dist.shasum": "d".repeat(40),
      "dist.integrity": INTEGRITY,
    }
    expect(checkRegistryMetadata({
      distTag: "next",
      distTagsText: "latest: 0.6.0\nnext: 0.7.0-rc.1\n",
      expectedHead: TAG_SHA,
      expectedVersion: "0.7.0-rc.1",
      metadata,
    })).toEqual({ ok: true })
    expect(checkRegistryMetadata({
      distTag: "next",
      distTagsText: "next: 0.7.0-rc.1\n",
      expectedHead: TAG_SHA,
      expectedVersion: "0.7.0-rc.1",
      metadata: { ...metadata, "dist.integrity": "" },
    })).toMatchObject({ ok: false, code: "registry-integrity" })
  })

  it("creates an absent release and accepts an already matching release", () => {
    expect(checkReleaseState({
      expectedCommit: TAG_SHA,
      expectedPrerelease: true,
      expectedTag: "v0.7.0-rc.1",
      release: null,
      tagCommit: TAG_SHA,
    })).toEqual({ action: "create", ok: true })
    expect(checkReleaseState({
      expectedCommit: TAG_SHA,
      expectedPrerelease: true,
      expectedTag: "v0.7.0-rc.1",
      release: {
        isPrerelease: true,
        name: "v0.7.0-rc.1",
        tagName: "v0.7.0-rc.1",
        targetCommitish: "main",
      },
      tagCommit: TAG_SHA,
    })).toEqual({ action: "already-valid", ok: true })
  })

  it.each([
    ["release title", { name: "wrong-title" }, "release-title"],
    ["release prerelease state", { isPrerelease: false }, "release-prerelease"],
    ["release tag commit", { tagCommit: MAIN_SHA }, "release-tag-commit"],
    ["release target", { targetCommitish: "release/old" }, "release-target"],
  ])("fails closed for mismatched existing %s", (_label, override, code) => {
    const release = {
      isPrerelease: true,
      name: "v0.7.0-rc.1",
      tagName: "v0.7.0-rc.1",
      targetCommitish: "main",
      ...override,
    }
    expect(checkReleaseState({
      expectedCommit: TAG_SHA,
      expectedPrerelease: true,
      expectedTag: "v0.7.0-rc.1",
      release,
      tagCommit: "tagCommit" in override ? override.tagCommit : TAG_SHA,
    })).toMatchObject({ ok: false, code })
  })
})
