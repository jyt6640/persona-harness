import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0816AcceptanceManifestError,
  canonicalV0816AcceptanceManifest,
  parseV0816AcceptanceManifest,
  readV0816AcceptanceManifest,
} from "../scripts/consumer-authority-v0816-acceptance-schema.mjs"
import { parseV0815AcceptanceManifest } from "../scripts/consumer-authority-v0815-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.16 acceptance schema", () => {
  it("binds the current package and bounded authority verification source reasons", () => {
    const manifest = readV0816AcceptanceManifest(repositoryRoot)
    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.16" })
    expect(manifest.v0815HistoricalRelease).toMatchObject({ reusableForV0816: false, version: "0.8.15" })
    expect(manifest.authority.readOnlyVerify).toMatchObject({
      command: "ph authority verify",
      schemaVersion: "consumer-authority-verify.2",
      noCredentialFetchStoreConsumeFinishReplay: true,
      sourceReason: ["head", "inputs", "identity", "status", "index", "content", "working-tree", "workspace", "unknown"],
      sourceReasonWhen: "present-only-with-reason-source-mismatch",
      nonSourceReasons: "existing-verify-reasons-omit-sourceReason",
    })
  })

  it("rejects neighboring versions, drift, and reused 0.8.15 authority", () => {
    expect(() => parseV0816AcceptanceManifest(canonicalV0816AcceptanceManifest(), "0.8.15")).toThrow(V0816AcceptanceManifestError)
    expect(() => parseV0816AcceptanceManifest(canonicalV0816AcceptanceManifest(), "0.8.17")).toThrow(V0816AcceptanceManifestError)
    expect(() => parseV0815AcceptanceManifest(canonicalV0816AcceptanceManifest(), "0.8.16")).toThrow()
    const manifest = canonicalV0816AcceptanceManifest() as { authority: { readOnlyVerify: { command: string } } }
    manifest.authority.readOnlyVerify.command = "ph authority fetch"
    expect(() => parseV0816AcceptanceManifest(manifest, "0.8.16")).toThrow(V0816AcceptanceManifestError)
  })

  it("routes current preflights through v0816 and keeps v0815 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0816-acceptance-schema.mjs"')
      expect(source).toContain("readV0816AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0815-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0815AcceptanceManifest(packageRoot)")
    }
  })
})
