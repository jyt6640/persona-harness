import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0817AcceptanceManifestError,
  canonicalV0817AcceptanceManifest,
  parseV0817AcceptanceManifest,
  readV0817AcceptanceManifest,
} from "../scripts/consumer-authority-v0817-acceptance-schema.mjs"
import { parseV0816AcceptanceManifest } from "../scripts/consumer-authority-v0816-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.17 acceptance schema", () => {
  it("binds the historical package and Darwin system temporary archive boundary", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0817AcceptanceManifest(historicalPackageRoot)
      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.17" })
      expect(manifest.v0816HistoricalRelease).toMatchObject({ reusableForV0817: false, version: "0.8.16" })
      expect(manifest.authority.readOnlyVerify).toMatchObject({
        command: "ph authority verify",
        schemaVersion: "consumer-authority-verify.2",
        noCredentialFetchStoreConsumeFinishReplay: true,
        archiveInput: {
          arbitrarySymlinkAncestorOrLeaf: "blocked-before-verifier-or-store",
          darwinSystemTemporaryAlias: "only-root-owned-/tmp-symlink-to-private-tmp-is-canonicalized-before-no-follow-validation",
          nonDarwin: "uses-input-absolute-path-without-temporary-alias-canonicalization",
        },
      })
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions, drift, and reused 0.8.16 authority", () => {
    expect(() => parseV0817AcceptanceManifest(canonicalV0817AcceptanceManifest(), "0.8.16")).toThrow(V0817AcceptanceManifestError)
    expect(() => parseV0817AcceptanceManifest(canonicalV0817AcceptanceManifest(), "0.8.18")).toThrow(V0817AcceptanceManifestError)
    expect(() => parseV0816AcceptanceManifest(canonicalV0817AcceptanceManifest(), "0.8.17")).toThrow()
    const manifest = canonicalV0817AcceptanceManifest() as { authority: { readOnlyVerify: { archiveInput: { darwinSystemTemporaryAlias: string } } } }
    manifest.authority.readOnlyVerify.archiveInput.darwinSystemTemporaryAlias = "allow-any-symlink"
    expect(() => parseV0817AcceptanceManifest(manifest, "0.8.17")).toThrow(V0817AcceptanceManifestError)
  })

  it("keeps current preflights off the historical v0817 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0826-acceptance-schema.mjs"')
      expect(source).toContain("readV0826AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0817-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0817AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0817-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0817-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0817-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.17"}\n', "utf8")
  return packageRoot
}
