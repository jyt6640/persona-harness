import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0819AcceptanceManifestError,
  canonicalV0819AcceptanceManifest,
  parseV0819AcceptanceManifest,
  readV0819AcceptanceManifest,
} from "../scripts/consumer-authority-v0819-acceptance-schema.mjs"
import { parseV0818AcceptanceManifest } from "../scripts/consumer-authority-v0818-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.19 acceptance schema", () => {
  it("binds the historical package and concurrent ancestor archive boundary", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0819AcceptanceManifest(historicalPackageRoot)
      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.19" })
      expect(manifest.v0818HistoricalRelease).toMatchObject({ reusableForV0819: false, version: "0.8.18" })
      expect(manifest.authority.readOnlyVerify).toMatchObject({
        command: "ph authority verify",
        schemaVersion: "consumer-authority-verify.2",
        noCredentialFetchStoreConsumeFinishReplay: true,
        archiveInput: {
          ancestorDirectoryChurn: "same-no-follow-directory-location-and-mode-required-while-unrelated-entry-metadata-may-change",
          arbitrarySymlinkAncestorOrLeaf: "blocked-before-verifier-or-store",
          directParentIntegrity: "full-no-follow-identity-remains-required-before-read",
        },
      })
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions, drift, and reused 0.8.18 authority", () => {
    expect(() => parseV0819AcceptanceManifest(canonicalV0819AcceptanceManifest(), "0.8.18")).toThrow(V0819AcceptanceManifestError)
    expect(() => parseV0819AcceptanceManifest(canonicalV0819AcceptanceManifest(), "0.8.20")).toThrow(V0819AcceptanceManifestError)
    expect(() => parseV0818AcceptanceManifest(canonicalV0819AcceptanceManifest(), "0.8.19")).toThrow()
    const manifest = canonicalV0819AcceptanceManifest() as { authority: { readOnlyVerify: { archiveInput: { directParentIntegrity: string } } } }
    manifest.authority.readOnlyVerify.archiveInput.directParentIntegrity = "allow-replacement"
    expect(() => parseV0819AcceptanceManifest(manifest, "0.8.19")).toThrow(V0819AcceptanceManifestError)
  })

  it("keeps current preflights off the historical v0819 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0827-acceptance-schema.mjs"')
      expect(source).toContain("readV0827AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0818-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0818AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0819-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0819-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0819-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.19"}\n', "utf8")
  return packageRoot
}
