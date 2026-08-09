import { describe, expect, it } from "vitest"

import { sourceIdentityDriftPath } from "../src/cli/project-finish-attestation-source.js"
import { SOURCE_IDENTITY_SCHEMA } from "../src/cli/source-identity-types.js"
import type { SourceIdentity } from "../src/cli/source-identity-types.js"

const SIGNED: SourceIdentity = {
  contentDigest: "sha256:aaaa",
  entryCount: 75,
  exclusions: [],
  gitStatusDigest: "sha256:status",
  repositoryHead: "0210a252d8c1e53457c7b16ec2f7a94c283f1b4b",
  schemaVersion: SOURCE_IDENTITY_SCHEMA,
  trackedEntryCount: 58,
  trackedIndexDigest: "sha256:index",
  untrackedEntryCount: 17,
}

function drifted(overrides: Partial<SourceIdentity>): SourceIdentity {
  return { ...SIGNED, ...overrides }
}

/**
 * `source-drift` on its own sends a reader looking for a change git insists is
 * not there. This happened during the #116 end-to-end audit: head matched, the
 * package version matched, entry counts matched, the git status digest matched,
 * `git status --porcelain --untracked-files=all` reported zero entries — and the
 * fetch was refused with nothing to act on. The cause was `gradlew.bat` holding
 * CRLF in the working copy against LF in the commit.
 */
describe("source drift diagnostic path", () => {
  it("names the working tree when the index still agrees with the signed identity", () => {
    // The distinguishing case: same commit, same file set, same git status, same
    // index — only the bytes on disk moved. That is what line-ending
    // normalization produces, and what git will not report.
    const actual = drifted({ contentDigest: "sha256:bbbb" })

    expect(sourceIdentityDriftPath(actual, SIGNED)).toBe("source.workingTreeBytesDifferFromMatchingGitIndex")
  })

  it("names the head when the commit differs", () => {
    const actual = drifted({ repositoryHead: "a8144c2dada31d9c2571ff139f488bc831eab907" })

    expect(sourceIdentityDriftPath(actual, SIGNED)).toBe("source.repositoryHead")
  })

  it("names the entry count when files were added or removed", () => {
    // Checked before content, because a changed file set explains a changed
    // content digest and is the more useful thing to say.
    const actual = drifted({ contentDigest: "sha256:bbbb", entryCount: 76 })

    expect(sourceIdentityDriftPath(actual, SIGNED)).toBe("source.entryCount")
  })

  it("names the git status when the working tree is visibly dirty", () => {
    const actual = drifted({ contentDigest: "sha256:bbbb", gitStatusDigest: "sha256:dirty" })

    expect(sourceIdentityDriftPath(actual, SIGNED)).toBe("source.gitStatusDigest")
  })

  it("names the index when the index itself moved", () => {
    // Index differs too, so this is not the invisible working-tree case and must
    // not be reported as one.
    const actual = drifted({ contentDigest: "sha256:bbbb", trackedIndexDigest: "sha256:other" })

    expect(sourceIdentityDriftPath(actual, SIGNED)).toBe("source.trackedIndexDigest")
  })

  it("falls back rather than claiming a specific cause it cannot see", () => {
    expect(sourceIdentityDriftPath(drifted({}), SIGNED)).toBe("source")
  })
})
