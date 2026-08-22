import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0823AcceptanceManifestError,
  canonicalV0823AcceptanceManifest,
  parseV0823AcceptanceManifest,
  readV0823AcceptanceManifest,
} from "../scripts/consumer-authority-v0823-acceptance-schema.mjs"
import { parseV0822AcceptanceManifest } from "../scripts/consumer-authority-v0822-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.23 acceptance schema", () => {
  it("binds the current package and concurrent ancestor archive boundary", () => {
    const manifest = readV0823AcceptanceManifest(repositoryRoot)
    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.23" })
    expect(manifest.v0822HistoricalRelease).toMatchObject({ reusableForV0823: false, version: "0.8.22" })
    expect(manifest.initialization).toEqual({
      packageTemplateIdentity: "canonical-package-template-digest-remains-separate-from-effective-bootstrap-overlay-file-digests",
      repairStaging: "manifest-less-recognized-portable-static-baseline-records-the-caller-realpath-before-staging-ownership-verification",
    })
    expect(manifest.projectFinishSourceIdentity).toEqual({
      adoptedInstructionPolicy: "remains-source-bound",
      repairInferenceObservations: "excludes-only-.persona/instructions/inferred.json-and-.persona/instructions/conflicts.json",
    })
    expect(manifest.authority.readOnlyVerify).toMatchObject({
      command: "ph authority verify",
      schemaVersion: "consumer-authority-verify.2",
      artifactDigestInput: "canonical-sha256-prefix-or-exact-64-hex-normalized-before-archive-verification",
      noCredentialFetchStoreConsumeFinishReplay: true,
      archiveInput: {
        ancestorDirectoryChurn: "same-no-follow-directory-location-and-mode-required-while-unrelated-entry-metadata-may-change",
        arbitrarySymlinkAncestorOrLeaf: "blocked-before-verifier-or-store",
        directParentIntegrity: "full-no-follow-identity-remains-required-before-read",
      },
    })
  })

  it("rejects neighboring versions, drift, and reused 0.8.22 authority", () => {
    expect(() => parseV0823AcceptanceManifest(canonicalV0823AcceptanceManifest(), "0.8.22")).toThrow(V0823AcceptanceManifestError)
    expect(() => parseV0823AcceptanceManifest(canonicalV0823AcceptanceManifest(), "0.8.24")).toThrow(V0823AcceptanceManifestError)
    expect(() => parseV0822AcceptanceManifest(canonicalV0823AcceptanceManifest(), "0.8.23")).toThrow()
    const manifest = canonicalV0823AcceptanceManifest() as { authority: { readOnlyVerify: { archiveInput: { directParentIntegrity: string } } } }
    manifest.authority.readOnlyVerify.archiveInput.directParentIntegrity = "allow-replacement"
    expect(() => parseV0823AcceptanceManifest(manifest, "0.8.23")).toThrow(V0823AcceptanceManifestError)
  })

  it("routes current preflights through v0823 and keeps v0822 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0823-acceptance-schema.mjs"')
      expect(source).toContain("readV0823AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0822-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0822AcceptanceManifest(packageRoot)")
    }
  })
})
