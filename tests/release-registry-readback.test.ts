import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  assessReleaseRegistryReadback,
  parseReleaseRegistryReadbackArguments,
} from "../scripts/release-registry-readback.mjs"

const HEAD = "a".repeat(40)
const SHA1 = "b".repeat(40)
const TARBALL_SHA256 = "c".repeat(64)
const SHA256 = `sha256:${TARBALL_SHA256}`
const INTEGRITY = `sha512-${"d".repeat(86)}`
const CONTENT_IDENTITY = {
  contentSha256: "e".repeat(64),
  entryCount: 1,
  identitySha256: "f".repeat(64),
  modeCounts: { "0644": 1 },
  schemaVersion: "package-content-identity.1",
}

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
      contentIdentity: CONTENT_IDENTITY,
      version: "0.8.0-beta.1",
    })
  })

  it.each([
    ["wrong tag", { distTagsText: "staging: 0.8.0-beta.2\n" }, "release-registry-dist-tag"],
    ["wrong source", { metadata: { ...validInput().metadata, gitHead: "e".repeat(40) } }, "release-registry-git-head"],
    ["wrong tarball sha1", { tarball: { ...validInput().tarball, sha1: "f".repeat(40) } }, "release-registry-shasum"],
    ["wrong tarball integrity", { tarball: { ...validInput().tarball, integrity: `sha512-${"g".repeat(86)}` } }, "release-registry-integrity"],
    ["wrong tarball raw SHA-256", { tarball: { ...validInput().tarball, sha256: `sha256:${"0".repeat(64)}` } }, "release-registry-tarball-sha256"],
    ["wrong package content identity", { tarball: { ...validInput().tarball, contentIdentity: { ...CONTENT_IDENTITY, identitySha256: "0".repeat(64) } } }, "release-registry-content-identity"],
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

  it("accepts only a regular canonical package-facts record for CLI readback", () => {
    // Given
    const root = mkdtempSync(join(tmpdir(), "persona-registry-facts-"))
    const factsPath = join(root, "package-facts.json")
    try {
      writeFileSync(factsPath, `${JSON.stringify(canonicalFacts())}\n`)

      // When
      const parsed = parseReleaseRegistryReadbackArguments([
        "--dist-tag", "staging",
        "--package-facts", factsPath,
        "--source-head", HEAD,
        "--version", "0.8.0-beta.1",
      ])

      // Then
      expect(parsed).toMatchObject({
        expectedContentIdentity: CONTENT_IDENTITY,
        expectedTarballSha256: TARBALL_SHA256,
      })
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })

  it("rejects a symlinked, unknown, or mismatched package-facts record before registry access", () => {
    // Given
    const root = mkdtempSync(join(tmpdir(), "persona-registry-facts-"))
    const safePath = join(root, "safe.json")
    const aliasPath = join(root, "alias.json")
    try {
      writeFileSync(safePath, `${JSON.stringify(canonicalFacts())}\n`)
      symlinkSync(safePath, aliasPath)
      const badPath = join(root, "bad.json")
      writeFileSync(badPath, `${JSON.stringify({ ...canonicalFacts(), unexpected: true })}\n`)
      const args = (path: string) => [
        "--dist-tag", "staging",
        "--package-facts", path,
        "--source-head", HEAD,
        "--version", "0.8.0-beta.1",
      ]

      // When / Then
      expect(parseReleaseRegistryReadbackArguments(args(aliasPath))).toBeUndefined()
      expect(parseReleaseRegistryReadbackArguments(args(badPath))).toBeUndefined()
      const wrongVersion = args(safePath)
      wrongVersion[7] = "0.8.0-beta.2"
      expect(parseReleaseRegistryReadbackArguments(wrongVersion)).toBeUndefined()
    } finally {
      rmSync(root, { force: true, recursive: true })
    }
  })
})

function canonicalFacts() {
  return {
    package: { name: "persona-harness", version: "0.8.0-beta.1" },
    schemaVersion: "canonical-package-packer.1",
    tarball: { contentIdentity: CONTENT_IDENTITY, sha256: TARBALL_SHA256, size: 1 },
    toolchain: { locale: "C", node: "20.19.0", npm: "10.8.2", timezone: "UTC", umask: "0022" },
  }
}

function validInput() {
  return {
    distTag: "staging",
    distTagsText: "latest: 0.7.0\nnext: 0.7.0-rc.3\nstaging: 0.8.0-beta.1\n",
    expectedHead: HEAD,
    expectedContentIdentity: CONTENT_IDENTITY,
    expectedTarballSha256: TARBALL_SHA256,
    expectedVersion: "0.8.0-beta.1",
    metadata: {
      "dist.integrity": INTEGRITY,
      "dist.shasum": SHA1,
      gitHead: HEAD,
      version: "0.8.0-beta.1",
    },
    tarball: {
      contentIdentity: CONTENT_IDENTITY,
      integrity: INTEGRITY,
      sha1: SHA1,
      sha256: SHA256,
    },
  }
}
