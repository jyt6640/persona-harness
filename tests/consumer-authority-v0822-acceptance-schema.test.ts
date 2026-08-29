import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0822AcceptanceManifestError,
  canonicalV0822AcceptanceManifest,
  parseV0822AcceptanceManifest,
  readV0822AcceptanceManifest,
} from "../scripts/consumer-authority-v0822-acceptance-schema.mjs"
import { parseV0821AcceptanceManifest } from "../scripts/consumer-authority-v0821-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.22 acceptance schema", () => {
  it("binds the historical package and concurrent ancestor archive boundary", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0822AcceptanceManifest(historicalPackageRoot)
      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.22" })
      expect(manifest.v0821HistoricalRelease).toMatchObject({ reusableForV0822: false, version: "0.8.21" })
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
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions, drift, and reused 0.8.21 authority", () => {
    expect(() => parseV0822AcceptanceManifest(canonicalV0822AcceptanceManifest(), "0.8.21")).toThrow(V0822AcceptanceManifestError)
    expect(() => parseV0822AcceptanceManifest(canonicalV0822AcceptanceManifest(), "0.8.23")).toThrow(V0822AcceptanceManifestError)
    expect(() => parseV0821AcceptanceManifest(canonicalV0822AcceptanceManifest(), "0.8.22")).toThrow()
    const manifest = canonicalV0822AcceptanceManifest() as { authority: { readOnlyVerify: { archiveInput: { directParentIntegrity: string } } } }
    manifest.authority.readOnlyVerify.archiveInput.directParentIntegrity = "allow-replacement"
    expect(() => parseV0822AcceptanceManifest(manifest, "0.8.22")).toThrow(V0822AcceptanceManifestError)
  })

  it("keeps current preflights off the historical v0822 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-current-acceptance-schema.mjs"')
      expect(source).toContain("readCurrentAcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0822-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0822AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0822-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0822-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0822-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.22"}\n', "utf8")
  return packageRoot
}
