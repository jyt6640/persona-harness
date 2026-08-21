import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0818AcceptanceManifestError,
  canonicalV0818AcceptanceManifest,
  parseV0818AcceptanceManifest,
  readV0818AcceptanceManifest,
} from "../scripts/consumer-authority-v0818-acceptance-schema.mjs"
import { parseV0817AcceptanceManifest } from "../scripts/consumer-authority-v0817-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.18 acceptance schema", () => {
  it("binds the current package and Darwin system temporary archive boundary", () => {
    const manifest = readV0818AcceptanceManifest(repositoryRoot)
    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.18" })
    expect(manifest.v0817HistoricalRelease).toMatchObject({ reusableForV0818: false, version: "0.8.17" })
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
  })

  it("rejects neighboring versions, drift, and reused 0.8.17 authority", () => {
    expect(() => parseV0818AcceptanceManifest(canonicalV0818AcceptanceManifest(), "0.8.17")).toThrow(V0818AcceptanceManifestError)
    expect(() => parseV0818AcceptanceManifest(canonicalV0818AcceptanceManifest(), "0.8.19")).toThrow(V0818AcceptanceManifestError)
    expect(() => parseV0817AcceptanceManifest(canonicalV0818AcceptanceManifest(), "0.8.18")).toThrow()
    const manifest = canonicalV0818AcceptanceManifest() as { authority: { readOnlyVerify: { archiveInput: { darwinSystemTemporaryAlias: string } } } }
    manifest.authority.readOnlyVerify.archiveInput.darwinSystemTemporaryAlias = "allow-any-symlink"
    expect(() => parseV0818AcceptanceManifest(manifest, "0.8.18")).toThrow(V0818AcceptanceManifestError)
  })

  it("routes current preflights through v0818 and keeps v0817 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0818-acceptance-schema.mjs"')
      expect(source).toContain("readV0818AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0817-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0817AcceptanceManifest(packageRoot)")
    }
  })
})
