import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0820AcceptanceManifestError,
  canonicalV0820AcceptanceManifest,
  parseV0820AcceptanceManifest,
  readV0820AcceptanceManifest,
} from "../scripts/consumer-authority-v0820-acceptance-schema.mjs"
import { parseV0819AcceptanceManifest } from "../scripts/consumer-authority-v0819-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.20 acceptance schema", () => {
  it("binds the current package and concurrent ancestor archive boundary", () => {
    const manifest = readV0820AcceptanceManifest(repositoryRoot)
    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.20" })
    expect(manifest.v0819HistoricalRelease).toMatchObject({ reusableForV0820: false, version: "0.8.19" })
    expect(manifest.initialization).toEqual({
      packageTemplateIdentity: "canonical-package-template-digest-remains-separate-from-effective-bootstrap-overlay-file-digests",
      repairStaging: "manifest-less-recognized-portable-static-baseline-records-the-caller-realpath-before-staging-ownership-verification",
    })
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
  })

  it("rejects neighboring versions, drift, and reused 0.8.19 authority", () => {
    expect(() => parseV0820AcceptanceManifest(canonicalV0820AcceptanceManifest(), "0.8.19")).toThrow(V0820AcceptanceManifestError)
    expect(() => parseV0820AcceptanceManifest(canonicalV0820AcceptanceManifest(), "0.8.21")).toThrow(V0820AcceptanceManifestError)
    expect(() => parseV0819AcceptanceManifest(canonicalV0820AcceptanceManifest(), "0.8.20")).toThrow()
    const manifest = canonicalV0820AcceptanceManifest() as { authority: { readOnlyVerify: { archiveInput: { directParentIntegrity: string } } } }
    manifest.authority.readOnlyVerify.archiveInput.directParentIntegrity = "allow-replacement"
    expect(() => parseV0820AcceptanceManifest(manifest, "0.8.20")).toThrow(V0820AcceptanceManifestError)
  })

  it("routes current preflights through v0820 and keeps v0819 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0820-acceptance-schema.mjs"')
      expect(source).toContain("readV0820AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0819-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0819AcceptanceManifest(packageRoot)")
    }
  })
})
