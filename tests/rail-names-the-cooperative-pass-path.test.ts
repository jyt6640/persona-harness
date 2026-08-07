import { describe, expect, it } from "vitest"

import { passedImplementOutput } from "../src/cli/workflow-output.js"

function rail(): string {
  return passedImplementOutput("/tmp/persona-rail-fixture", { full: true }).stdout
}

/**
 * A cooperative PASS is reachable from a plain npm install with no agent host,
 * but the rail used to name none of the steps that reach it — it pointed at a
 * `bearshell` listing for read coverage, which records only a hash of its own
 * output and so can never satisfy that check, and it never mentioned the
 * assurance flag at all. A reader following it exactly ran out of instructions
 * while still blocked.
 */
describe("the implementation rail names the path that actually passes", () => {
  it("tells the reader to record reads with `ph evidence read`", () => {
    expect(rail()).toContain("npx ph evidence read")
  })

  it("says that listing files is not a recorded read", () => {
    // Without this, `bearshell … find` reads as the way to satisfy coverage.
    expect(rail()).toContain("Listing files does not record a read")
  })

  it("names the assurance flag a cooperative PASS requires", () => {
    expect(rail()).toContain("--assurance cooperative")
  })

  it("names the two preconditions the build check imposes", () => {
    const text = rail()

    // Both surfaced as bare blocker codes with no recovery step:
    // `git-worktree-root-mismatch` and `build-task-nonfresh`.
    expect(text).toContain("git init")
    expect(text).toContain("gradlew clean")
  })

  it("frames a blocked plain finish as the gate working", () => {
    // The previous wording implied `workflow finish implement` should pass on
    // its own, so a correct block read as an unresolved defect.
    expect(rail()).toContain("that is the gate working")
  })
})
