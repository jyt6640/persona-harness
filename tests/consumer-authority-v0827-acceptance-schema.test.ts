import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0827AcceptanceManifestError,
  canonicalV0827AcceptanceManifest,
  parseV0827AcceptanceManifest,
  readV0827AcceptanceManifest,
} from "../scripts/consumer-authority-v0827-acceptance-schema.mjs"
import { parseV0826AcceptanceManifest } from "../scripts/consumer-authority-v0826-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.27 acceptance schema", () => {
  it("binds its historical package root to source provenance remediation without a static channel snapshot", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0827AcceptanceManifest(historicalPackageRoot)

      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.27" })
      expect(manifest.v0826HistoricalRelease).toMatchObject({ reusableForV0827: false, version: "0.8.26" })
      expect(manifest.releaseTruth).toEqual({
        stableBody: "stable-release-source-candidate-language-rejected-before-render",
        publishedHistory: "v0826-published-release-remains-immutable-and-nonreusable",
        liveLookup: "package-visible-current-docs-use-live-npm-and-github-lookups-without-a-static-dist-tag-snapshot",
        verification: "source-provenance-audit-package-smoke-unit-repository-and-cooperative-demo-contracts",
      })
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions, drift, and reused 0.8.26 authority", () => {
    expect(() => parseV0827AcceptanceManifest(canonicalV0827AcceptanceManifest(), "0.8.26")).toThrow(V0827AcceptanceManifestError)
    expect(() => parseV0827AcceptanceManifest(canonicalV0827AcceptanceManifest(), "0.8.28")).toThrow(V0827AcceptanceManifestError)
    expect(() => parseV0826AcceptanceManifest(canonicalV0827AcceptanceManifest(), "0.8.27")).toThrow()
    const manifest = canonicalV0827AcceptanceManifest() as {
      releaseTruth: { verification: string }
    }
    manifest.releaseTruth.verification = "static-snapshot"
    expect(() => parseV0827AcceptanceManifest(manifest, "0.8.27")).toThrow(V0827AcceptanceManifestError)
  })

  it("routes current external preflights through v0828 and keeps v0827 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0828-acceptance-schema.mjs"')
      expect(source).toContain("readV0828AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0827-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0827AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot(): string {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0827-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0827-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0827-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.27"}\n', "utf8")
  return packageRoot
}
