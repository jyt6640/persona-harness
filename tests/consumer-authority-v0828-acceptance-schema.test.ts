import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0828AcceptanceManifestError,
  canonicalV0828AcceptanceManifest,
  parseV0828AcceptanceManifest,
  readV0828AcceptanceManifest,
} from "../scripts/consumer-authority-v0828-acceptance-schema.mjs"
import { parseV0827AcceptanceManifest } from "../scripts/consumer-authority-v0827-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.28 acceptance schema", () => {
  it("binds the current package to the opt-in project update boundary", () => {
    const manifest = readV0828AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.28" })
    expect(manifest.v0827HistoricalRelease).toMatchObject({ reusableForV0828: false, version: "0.8.27" })
  })

  it("rejects neighboring versions, drift, and reused 0.8.27 authority", () => {
    expect(() => parseV0828AcceptanceManifest(canonicalV0828AcceptanceManifest(), "0.8.27")).toThrow(V0828AcceptanceManifestError)
    expect(() => parseV0828AcceptanceManifest(canonicalV0828AcceptanceManifest(), "0.8.29")).toThrow(V0828AcceptanceManifestError)
    expect(() => parseV0827AcceptanceManifest(canonicalV0828AcceptanceManifest(), "0.8.28")).toThrow()
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
