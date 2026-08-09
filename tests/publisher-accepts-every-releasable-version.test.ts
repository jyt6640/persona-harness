import { describe, expect, it } from "vitest"

import { isSafeVersion } from "../scripts/canonical-package-publisher.mjs"

/**
 * This predicate used to be `/^0\.8\.0-beta\.(?:1[89]|[2-9]\d+)$/`, which made
 * the publisher structurally unable to release anything but a beta of one line.
 * Publishing `0.8.0-rc.1` failed as `canonical-package-publisher-facts` with
 * nothing indicating that the version *format* was the reason — the facts
 * recomputation itself was fine, and reproduced clean locally under the pinned
 * toolchain.
 *
 * Which version may go to which channel is not this predicate's job.
 * `release-workflow-policy.mjs` owns that and already refuses a prerelease on
 * `latest` and a non-prerelease on `next` or `staging`.
 */
describe("the publisher accepts every version the release policy can authorize", () => {
  it("accepts the shapes the 0.8.0 line needs", () => {
    // The beta that shipped, the candidate that could not, and the stable that
    // the roadmap gates behind an RC cycle.
    expect(isSafeVersion("0.8.0-beta.34")).toBe(true)
    expect(isSafeVersion("0.8.0-rc.1")).toBe(true)
    expect(isSafeVersion("0.8.0")).toBe(true)
  })

  it("accepts versions outside the 0.8.0 line", () => {
    // A predicate pinned to one line is a release that cannot move on.
    expect(isSafeVersion("0.7.0-rc.3")).toBe(true)
    expect(isSafeVersion("1.0.0")).toBe(true)
    expect(isSafeVersion("10.20.30-alpha.1+build.5")).toBe(true)
  })

  it("refuses anything that is not strict SemVer", () => {
    expect(isSafeVersion("bad")).toBe(false)
    expect(isSafeVersion("1.0")).toBe(false)
    expect(isSafeVersion("01.0.0")).toBe(false)
    expect(isSafeVersion("1.0.0-")).toBe(false)
    expect(isSafeVersion("")).toBe(false)
    expect(isSafeVersion(undefined)).toBe(false)
    expect(isSafeVersion(123)).toBe(false)
  })

  it("refuses a version carrying anything executable or unbounded", () => {
    // It reaches an npm command line, so shape and length both matter.
    expect(isSafeVersion("0.8.0-rc.1;rm -rf /")).toBe(false)
    expect(isSafeVersion("0.8.0-rc.1 --tag latest")).toBe(false)
    expect(isSafeVersion(`1.0.0-${"a".repeat(300)}`)).toBe(false)
  })
})
