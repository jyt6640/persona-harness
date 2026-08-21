import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0815AcceptanceManifestError,
  canonicalV0815AcceptanceManifest,
  parseV0815AcceptanceManifest,
  readV0815AcceptanceManifest,
} from "../scripts/consumer-authority-v0815-acceptance-schema.mjs"
import { parseV0814AcceptanceManifest } from "../scripts/consumer-authority-v0814-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.15 acceptance schema", () => {
  it("binds the historical package and read-only authority verification boundary", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0815AcceptanceManifest(historicalPackageRoot)
      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.15" })
      expect(manifest.v0814HistoricalRelease).toMatchObject({ reusableForV0815: false, version: "0.8.14" })
      expect(manifest.authority.readOnlyVerify).toMatchObject({
        command: "ph authority verify",
        schemaVersion: "consumer-authority-verify.1",
        noCredentialFetchStoreConsumeFinishReplay: true,
      })
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions, drift, and reused 0.8.14 authority", () => {
    expect(() => parseV0815AcceptanceManifest(canonicalV0815AcceptanceManifest(), "0.8.14")).toThrow(V0815AcceptanceManifestError)
    expect(() => parseV0815AcceptanceManifest(canonicalV0815AcceptanceManifest(), "0.8.16")).toThrow(V0815AcceptanceManifestError)
    expect(() => parseV0814AcceptanceManifest(canonicalV0815AcceptanceManifest(), "0.8.15")).toThrow()
    const manifest = canonicalV0815AcceptanceManifest() as { authority: { readOnlyVerify: { command: string } } }
    manifest.authority.readOnlyVerify.command = "ph authority fetch"
    expect(() => parseV0815AcceptanceManifest(manifest, "0.8.15")).toThrow(V0815AcceptanceManifestError)
  })

  it("keeps current preflights off the historical v0815 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0820-acceptance-schema.mjs"')
      expect(source).toContain("readV0820AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0815-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0815AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0815-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0815-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0815-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.15"}\n', "utf8")
  return packageRoot
}
