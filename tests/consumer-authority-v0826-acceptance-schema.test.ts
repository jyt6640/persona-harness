import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0826AcceptanceManifestError,
  canonicalV0826AcceptanceManifest,
  parseV0826AcceptanceManifest,
  readV0826AcceptanceManifest,
} from "../scripts/consumer-authority-v0826-acceptance-schema.mjs"
import { parseV0825AcceptanceManifest } from "../scripts/consumer-authority-v0825-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.26 acceptance schema", () => {
  it("binds the current package to live release lookup without a static channel snapshot", () => {
    const manifest = readV0826AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.26" })
    expect(manifest.v0825HistoricalRelease).toMatchObject({ reusableForV0826: false, version: "0.8.25" })
    expect(manifest.releaseTruth).toEqual({
      stableBody: "stable-release-source-candidate-language-rejected-before-render",
      publishedHistory: "v0825-published-release-remains-immutable-and-nonreusable",
      liveLookup: "package-visible-current-docs-use-live-npm-and-github-lookups-without-a-static-dist-tag-snapshot",
      verification: "public-docs-map-package-smoke-unit-repository-and-cooperative-demo-contracts",
    })
  })

  it("rejects neighboring versions, drift, and reused 0.8.25 authority", () => {
    expect(() => parseV0826AcceptanceManifest(canonicalV0826AcceptanceManifest(), "0.8.25")).toThrow(V0826AcceptanceManifestError)
    expect(() => parseV0826AcceptanceManifest(canonicalV0826AcceptanceManifest(), "0.8.27")).toThrow(V0826AcceptanceManifestError)
    expect(() => parseV0825AcceptanceManifest(canonicalV0826AcceptanceManifest(), "0.8.26")).toThrow()
    const manifest = canonicalV0826AcceptanceManifest() as {
      releaseTruth: { liveLookup: string }
    }
    manifest.releaseTruth.liveLookup = "static-snapshot"
    expect(() => parseV0826AcceptanceManifest(manifest, "0.8.26")).toThrow(V0826AcceptanceManifestError)
  })

  it("routes current external preflights through v0826 and keeps v0825 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0826-acceptance-schema.mjs"')
      expect(source).toContain("readV0826AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0825-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0825AcceptanceManifest(packageRoot)")
    }
  })
})
