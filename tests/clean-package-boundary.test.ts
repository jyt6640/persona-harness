import { describe, expect, it } from "vitest"

import {
  assertBundleHeadBinding,
  assertCheckoutPackageBinding,
  assertNpmExecutionPolicy,
  assertPackRecordBinding,
  assertSourcePackageIdentity,
} from "../scripts/clean-package-boundary-core.mjs"

const BASE = "a".repeat(40)
const HEAD = "b".repeat(40)
const SHA = "c".repeat(64)
const IDENTITY = {
  name: "persona-harness",
  version: "0.8.0-beta.13",
}

describe("clean package boundary", () => {
  it("rejects a complete bundle that omits the exact candidate HEAD ref", () => {
    expect(() => assertBundleHeadBinding([
      { ref: "refs/bundle-freeze/issue122/main", sha: BASE },
      { ref: "refs/bundle-freeze/issue122/candidate", sha: HEAD },
    ], { base: BASE, head: HEAD })).toThrow("clean-package-bundle-head")
  })

  it("rejects package and lock version drift before packing", () => {
    expect(() => assertSourcePackageIdentity(
      { name: IDENTITY.name, version: IDENTITY.version },
      { packages: { "": { name: IDENTITY.name, version: "0.8.0-beta.1" } } },
    )).toThrow("clean-package-lock-version")
  })

  it("rejects an npm pack record from an old package version", () => {
    expect(() => assertPackRecordBinding({
      filename: "persona-harness-0.8.0-beta.1.tgz",
      name: IDENTITY.name,
      version: "0.8.0-beta.1",
    }, IDENTITY)).toThrow("clean-package-pack-version")
  })

  it("rejects a stale package root even when its manifest shape is valid", () => {
    expect(() => assertCheckoutPackageBinding({
      gitRoot: "/fresh/bundle-checkout",
      headLockSha256: SHA,
      headPackageSha256: SHA,
      lockSha256: SHA,
      npmPrefix: "/stale/beta1-checkout",
      packageSha256: SHA,
      root: "/fresh/bundle-checkout",
    })).toThrow("clean-package-root-npm")
  })

  it("rejects a package manifest changed after checkout before npm can pack it", () => {
    expect(() => assertCheckoutPackageBinding({
      gitRoot: "/fresh/bundle-checkout",
      headLockSha256: SHA,
      headPackageSha256: SHA,
      lockSha256: SHA,
      npmPrefix: "/fresh/bundle-checkout",
      packageSha256: "d".repeat(64),
      root: "/fresh/bundle-checkout",
    })).toThrow("clean-package-package-drift")
  })

  it("rejects inherited workspace or ignore-scripts mode", () => {
    expect(() => assertNpmExecutionPolicy({
      global: "false",
      ignoreScripts: "true",
      workspaces: "false",
    })).toThrow("clean-package-npm-ignore-scripts")
    expect(() => assertNpmExecutionPolicy({
      global: "false",
      ignoreScripts: "false",
      workspaces: "true",
    })).toThrow("clean-package-npm-workspaces")
  })

  it("accepts the exact bundle, checkout root, immutable manifests, and fixed npm policy", () => {
    expect(assertSourcePackageIdentity(
      { name: IDENTITY.name, version: IDENTITY.version },
      { packages: { "": IDENTITY } },
    )).toEqual(IDENTITY)
    expect(assertBundleHeadBinding([
      { ref: "HEAD", sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], { base: BASE, head: HEAD })).toEqual({ base: BASE, head: HEAD })
    expect(assertCheckoutPackageBinding({
      gitRoot: "/fresh/bundle-checkout",
      headLockSha256: SHA,
      headPackageSha256: SHA,
      lockSha256: SHA,
      npmPrefix: "/fresh/bundle-checkout",
      packageSha256: SHA,
      root: "/fresh/bundle-checkout",
    })).toEqual({ root: "/fresh/bundle-checkout" })
    expect(assertNpmExecutionPolicy({
      global: "false",
      ignoreScripts: "false",
      workspaces: "false",
    })).toEqual({ global: "false", ignoreScripts: "false", workspaces: "false" })
    expect(assertPackRecordBinding({
      filename: "persona-harness-0.8.0-beta.13.tgz",
      name: IDENTITY.name,
      version: IDENTITY.version,
    }, IDENTITY)).toEqual(IDENTITY)
  })
})
