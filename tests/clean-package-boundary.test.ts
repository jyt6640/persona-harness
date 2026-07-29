import { describe, expect, it } from "vitest"

import {
  assertBundleHeadBinding,
  assertPackRecordBinding,
  assertSourcePackageIdentity,
} from "../scripts/clean-package-boundary-core.mjs"

const BASE = "a".repeat(40)
const HEAD = "b".repeat(40)
const IDENTITY = {
  name: "persona-harness",
  version: "0.8.0-beta.10",
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

  it("rejects npm pack metadata that differs from the frozen source version", () => {
    expect(() => assertPackRecordBinding({
      filename: "persona-harness-0.8.0-beta.1.tgz",
      name: IDENTITY.name,
      version: "0.8.0-beta.1",
    }, IDENTITY)).toThrow("clean-package-pack-version")
  })

  it("accepts the explicit candidate HEAD, canonical main, and matching pack identity", () => {
    expect(assertSourcePackageIdentity(
      { name: IDENTITY.name, version: IDENTITY.version },
      { packages: { "": IDENTITY } },
    )).toEqual(IDENTITY)
    expect(assertBundleHeadBinding([
      { ref: "HEAD", sha: HEAD },
      { ref: "refs/remotes/origin/main", sha: BASE },
    ], { base: BASE, head: HEAD })).toEqual({ base: BASE, head: HEAD })
    expect(assertPackRecordBinding({
      filename: "persona-harness-0.8.0-beta.10.tgz",
      name: IDENTITY.name,
      version: IDENTITY.version,
    }, IDENTITY)).toEqual(IDENTITY)
  })
})
