import { describe, expect, it } from "vitest"

import { assessReleaseRegistryReadback } from "../scripts/release-registry-readback.mjs"

const HEAD = "a".repeat(40)
const SHA1 = "b".repeat(40)
const SHA256 = `sha256:${"c".repeat(64)}`
const INTEGRITY = `sha512-${"d".repeat(86)}`

describe("release registry readback", () => {
  it("binds the fixed staging beta tag, source, metadata, and downloaded tarball", () => {
    const result = assessReleaseRegistryReadback(validInput())

    expect(result).toMatchObject({
      diagnostics: [],
      distTag: "staging",
      provenance: "requires-staged-artifact-attestation",
      registryMutation: "not-performed",
      sourceHead: HEAD,
      status: "passed",
      version: "0.8.0-beta.1",
    })
    expect(result.registry).toEqual({
      gitHead: HEAD,
      integrity: INTEGRITY,
      shasum: SHA1,
      tarballSha256: SHA256,
      version: "0.8.0-beta.1",
    })
  })

  it.each([
    ["wrong tag", { distTagsText: "staging: 0.8.0-beta.2\n" }, "release-registry-dist-tag"],
    ["wrong source", { metadata: { ...validInput().metadata, gitHead: "e".repeat(40) } }, "release-registry-git-head"],
    ["wrong tarball sha1", { tarball: { ...validInput().tarball, sha1: "f".repeat(40) } }, "release-registry-shasum"],
    ["wrong tarball integrity", { tarball: { ...validInput().tarball, integrity: `sha512-${"g".repeat(86)}` } }, "release-registry-integrity"],
  ])("fails closed for %s", (_label, override, code) => {
    const result = assessReleaseRegistryReadback({ ...validInput(), ...override })

    expect(result.status).toBe("blocked")
    expect(result.diagnostics).toContain(code)
  })

  it("bounds malformed registry values without reflecting them", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const result = assessReleaseRegistryReadback({
      ...validInput(),
      metadata: { ...validInput().metadata, gitHead: `/private/tmp/${secret}` },
    })

    expect(result.status).toBe("blocked")
    expect(result.diagnostics).toContain("release-registry-metadata")
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain("/private/tmp")
  })
})

function validInput() {
  return {
    distTag: "staging",
    distTagsText: "latest: 0.7.0\nnext: 0.7.0-rc.3\nstaging: 0.8.0-beta.1\n",
    expectedHead: HEAD,
    expectedVersion: "0.8.0-beta.1",
    metadata: {
      "dist.integrity": INTEGRITY,
      "dist.shasum": SHA1,
      gitHead: HEAD,
      version: "0.8.0-beta.1",
    },
    tarball: {
      integrity: INTEGRITY,
      sha1: SHA1,
      sha256: SHA256,
    },
  }
}
