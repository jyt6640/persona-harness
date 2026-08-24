import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
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
  it("binds the historical package and concurrent ancestor archive boundary", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0823AcceptanceManifest(historicalPackageRoot)
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
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions, drift, and reused 0.8.22 authority", () => {
    expect(() => parseV0823AcceptanceManifest(canonicalV0823AcceptanceManifest(), "0.8.22")).toThrow(V0823AcceptanceManifestError)
    expect(() => parseV0823AcceptanceManifest(canonicalV0823AcceptanceManifest(), "0.8.24")).toThrow(V0823AcceptanceManifestError)
    expect(() => parseV0822AcceptanceManifest(canonicalV0823AcceptanceManifest(), "0.8.23")).toThrow()
    const manifest = canonicalV0823AcceptanceManifest() as { authority: { readOnlyVerify: { archiveInput: { directParentIntegrity: string } } } }
    manifest.authority.readOnlyVerify.archiveInput.directParentIntegrity = "allow-replacement"
    expect(() => parseV0823AcceptanceManifest(manifest, "0.8.23")).toThrow(V0823AcceptanceManifestError)
  })

  it("keeps current preflights off the historical v0823 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0831-acceptance-schema.mjs"')
      expect(source).toContain("readV0831AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0823-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0823AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0823-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0823-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0823-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.23"}\n', "utf8")
  return packageRoot
}
