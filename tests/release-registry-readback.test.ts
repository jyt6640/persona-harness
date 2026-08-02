import { spawnSync } from "node:child_process"
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
  it("binds a workflow-verified source to the fixed staging beta tag, metadata, and downloaded tarball without registry gitHead", () => {
    const result = assessReleaseRegistryReadback(validInput())

    expect(result).toMatchObject({
      diagnostics: [],
      distTag: "staging",
      provenance: "requires-staged-artifact-attestation",
      registryMutation: "not-performed",
      sourceBinding: "workflow-verified-canonical-tar",
      sourceHead: HEAD,
      status: "passed",
      version: "0.8.0-beta.1",
    })
    expect(result.registry).toEqual({
      integrity: INTEGRITY,
      shasum: SHA1,
      tarballSha256: SHA256,
      contentIdentity: CONTENT_IDENTITY,
      version: "0.8.0-beta.1",
    })
  })

  it("accepts the observed beta18 registry route when the exact canonical tarball is present without registry gitHead", () => {
    const result = assessReleaseRegistryReadback({
      distTag: "staging",
      distTagsText: "latest: 0.7.0\nnext: 0.7.0-rc.3\nstaging: 0.8.0-beta.18\n",
      expectedContentIdentity: {
        contentSha256: "9e0502259713190878beac3c7e60e952bdc6891e85e282b93b76cc1474813354",
        entryCount: 1210,
        identitySha256: "bf3de031ae9ed6d9ab290291f151d0befc1fc4804465f55bddb5ad382399a150",
        modeCounts: { "0644": 1207, "0755": 3 },
        schemaVersion: "package-content-identity.1",
      },
      expectedHead: "02a127bb996b616b9c631b1d3f48798b79527b13",
      expectedTarballSha256: "66ef460552d03fd067baf412c1d4952e5bd42811b419c585092fc7a75b4c54e6",
      expectedVersion: "0.8.0-beta.18",
      metadata: {
        "dist.integrity": "sha512-7/wkh22rmxOGLOKRHkhLtukuclGh6ZJXUeS0RdhaxBcij8dImn1yNRhWssQslaaUL+Ii4g1qLU+TQBoLU8FF9w==",
        "dist.shasum": "37beae7c59ca0e2d73fec2bd8c0f98d32227a117",
        version: "0.8.0-beta.18",
      },
      tarball: {
        contentIdentity: {
          contentSha256: "9e0502259713190878beac3c7e60e952bdc6891e85e282b93b76cc1474813354",
          entryCount: 1210,
          identitySha256: "bf3de031ae9ed6d9ab290291f151d0befc1fc4804465f55bddb5ad382399a150",
          modeCounts: { "0644": 1207, "0755": 3 },
          schemaVersion: "package-content-identity.1",
        },
        integrity: "sha512-7/wkh22rmxOGLOKRHkhLtukuclGh6ZJXUeS0RdhaxBcij8dImn1yNRhWssQslaaUL+Ii4g1qLU+TQBoLU8FF9w==",
        sha1: "37beae7c59ca0e2d73fec2bd8c0f98d32227a117",
        sha256: "sha256:66ef460552d03fd067baf412c1d4952e5bd42811b419c585092fc7a75b4c54e6",
      },
    })

    expect(result).toMatchObject({
      diagnostics: [],
      sourceBinding: "workflow-verified-canonical-tar",
      sourceHead: "02a127bb996b616b9c631b1d3f48798b79527b13",
      status: "passed",
      version: "0.8.0-beta.18",
    })
  })

  it.each([
    ["wrong tag", { distTagsText: "staging: 0.8.0-beta.2\n" }, "release-registry-dist-tag"],
    ["malformed workflow source", { expectedHead: "not-a-commit" }, "release-registry-source-head"],
    ["missing registry version", { metadata: { "dist.integrity": INTEGRITY, "dist.shasum": SHA1 } }, "release-registry-metadata"],
    ["wrong tarball sha1", { tarball: { ...validInput().tarball, sha1: "f".repeat(40) } }, "release-registry-shasum"],
    ["wrong tarball integrity", { tarball: { ...validInput().tarball, integrity: `sha512-${"g".repeat(86)}` } }, "release-registry-integrity"],
    ["wrong tarball raw SHA-256", { tarball: { ...validInput().tarball, sha256: `sha256:${"0".repeat(64)}` } }, "release-registry-tarball-sha256"],
    ["wrong package content identity", { tarball: { ...validInput().tarball, contentIdentity: { ...CONTENT_IDENTITY, identitySha256: "0".repeat(64) } } }, "release-registry-content-identity"],
  ])("fails closed for %s", (_label, override, code) => {
    const result = assessReleaseRegistryReadback({ ...validInput(), ...override })

    expect(result.status).toBe("blocked")
    expect(result.diagnostics).toContain(code)
  })

  it("does not trust or reflect an unsupported registry gitHead field", () => {
    const secret = "sk-live-aaaaaaaaaaaaaaaaaaaaaaaa"
    const result = assessReleaseRegistryReadback({
      ...validInput(),
      metadata: { ...validInput().metadata, gitHead: `/private/tmp/${secret}` },
    })

    expect(result.status).toBe("passed")
    expect(result.diagnostics).toEqual([])
    expect(JSON.stringify(result)).not.toContain(secret)
    expect(JSON.stringify(result)).not.toContain("/private/tmp")
  })

  it("emits a bounded blocked record for an invalid direct entrypoint invocation", () => {
    const result = spawnSync(process.execPath, ["scripts/release-registry-readback.mjs", "--unexpected"], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { PATH: process.env.PATH ?? "" },
    })

    expect(result.status).toBe(1)
    expect(result.stderr).toBe("")
    const output = JSON.parse(result.stdout)
    expect(output).toMatchObject({
      diagnostics: expect.arrayContaining([
        "release-registry-content-identity",
        "release-registry-dist-tag",
        "release-registry-metadata",
        "release-registry-source-head",
        "release-registry-tarball",
        "release-registry-tarball-sha256",
        "release-registry-version",
      ]),
      sourceBinding: "unavailable",
      status: "blocked",
    })
    expect(result.stdout).not.toContain(process.cwd())
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
