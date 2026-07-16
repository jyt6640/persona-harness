import { readFileSync } from "node:fs"
import { join, resolve } from "node:path"

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
const repositoryRoot = resolve(process.cwd())

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
    ["prerelease staging", "0.7.0-rc.1", "staging", "staging-only"],
    ["prerelease next after promotion approval", "0.7.0-rc.1", "next", "next-promotion-approved"],
    ["stable latest after GA approval", "0.7.0", "latest", "ga-approved"],
  ])("accepts %s", (_label, version, distTag, approvalScope) => {
    expect(checkDistTagCompatibility({ approvalScope, distTag, version })).toEqual({ ok: true })
  })

  it.each([
    ["prerelease latest", "0.7.0-rc.1", "latest", "ga-approved"],
    ["stable next", "0.7.0", "next", "next-promotion-approved"],
    ["stable staging", "0.7.0", "staging", "staging-only"],
    ["next without a separate approval", "0.7.0-rc.1", "next", "staging-only"],
    ["latest without a separate GA approval", "0.7.0", "latest", "next-promotion-approved"],
    ["unsupported tag", "0.7.0", "beta", "staging-only"],
  ])("rejects %s", (_label, version, distTag, approvalScope) => {
    expect(checkDistTagCompatibility({ approvalScope, distTag, version })).toMatchObject({ ok: false })
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

  it("keeps package and repository test contracts explicit and sequential", () => {
    const scripts = readPackageScripts(join(repositoryRoot, "package.json"))

    expect(scripts["test"]).toBe("npm run test:package")
    expect(scripts["test:package"]).toBe("node dist/cli/index.js --help")
    expect(scripts["test:installed-package-contract"]).toBe("node scripts/test-installed-package-contract.mjs")
    expect(scripts["test:repository"]).toBe(
      "npm run check:scope && npm run check:docs && npm run check:release-workflows && vitest run --testTimeout=15000 && npm run test:installed-package-contract",
    )

    for (const workflow of ["ci.yml", "publish.yml", "release.yml"]) {
      const source = readFileSync(join(repositoryRoot, ".github", "workflows", workflow), "utf8")
      expect(source).toContain("npm run test:repository")
    }
  })
})

function readPackageScripts(packagePath: string): Readonly<Record<string, string>> {
  const parsed: unknown = JSON.parse(readFileSync(packagePath, "utf8"))
  if (!isRecord(parsed) || !isRecord(parsed["scripts"])) {
    throw new TypeError("package scripts are unavailable")
  }
  const scripts: Record<string, string> = {}
  for (const [name, value] of Object.entries(parsed["scripts"])) {
    if (typeof value !== "string") {
      throw new TypeError("package scripts must be strings")
    }
    scripts[name] = value
  }
  return scripts
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
