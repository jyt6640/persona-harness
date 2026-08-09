import { readFileSync } from "node:fs"
import { join } from "node:path"
import process from "node:process"

import { describe, expect, it } from "vitest"

const VERIFIER = readFileSync(
  join(process.cwd(), "src", "cli", "project-finish-attestation-verifier.ts"),
  "utf8",
)

/**
 * Four unrelated conditions used to report the same `consumption` path: an
 * unsafe evidence directory, an unreadable record, a record dated in the
 * future, and a workspace that already consumed a different attestation.
 *
 * Only the last is an ordinary state — it is what a project hits after
 * finishing once and then doing more work — and `binding-mismatch @ consumption`
 * reads as corruption rather than as "this workspace has already taken its
 * finish". Measured on a real consumer in #225.
 *
 * Reporting only. Each condition still blocks, and no verdict changed.
 */
describe("consumption diagnostic paths", () => {
  it("distinguishes an unsafe evidence directory", () => {
    expect(VERIFIER).toContain('blocked("binding-mismatch", "consumption.directoryUnsafe")')
  })

  it("distinguishes an unreadable terminal record", () => {
    expect(VERIFIER).toContain('blocked("binding-mismatch", "consumption.recordUnreadable")')
  })

  it("distinguishes a record dated in the future", () => {
    // A clock or tamper signal, not the same thing as a mismatched binding.
    expect(VERIFIER).toContain('blocked("binding-mismatch", "consumption.consumedAtIsInTheFuture")')
  })

  it("names the workspace that already consumed a different attestation", () => {
    expect(VERIFIER).toContain(
      'blocked("binding-mismatch", "consumption.workspaceAlreadyConsumedADifferentAttestation")',
    )
  })

  it("keeps replay reporting the bare consumption path", () => {
    // Replay already had its own code, so it needs no further separation and
    // must not be folded into one of the paths above.
    expect(VERIFIER).toContain('blocked("replayed", "consumption")')
  })

  it("leaves no bare binding-mismatch consumption path behind", () => {
    // The point of the change: none of the four may still share the old path.
    expect(VERIFIER).not.toContain('blocked("binding-mismatch", "consumption")')
  })
})
