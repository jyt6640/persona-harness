import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V088AcceptanceManifestError,
  canonicalV088AcceptanceManifest,
  parseV088AcceptanceManifest,
} from "../scripts/consumer-authority-v088-acceptance-schema.mjs"
import { parseV087AcceptanceManifest } from "../scripts/consumer-authority-v087-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.8 acceptance schema", () => {
  it("keeps the strict 0.8.8 record as published history", () => {
    const manifest = parseV088AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v088-acceptance.json"), "utf8")),
      "0.8.8",
    )
    const v087 = parseV087AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v087-acceptance.json"), "utf8")),
      "0.8.7",
    )

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.8" })
    expect(manifest.v087HistoricalRelease).toMatchObject({ reusableForV088: false, version: "0.8.7" })
    expect(v087.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.7" })
  })

  it("rejects neighboring package versions and a reused v0.8.7 record", () => {
    expect(() => parseV088AcceptanceManifest(canonicalV088AcceptanceManifest(), "0.8.7")).toThrow(V088AcceptanceManifestError)
    expect(() => parseV087AcceptanceManifest(canonicalV088AcceptanceManifest(), "0.8.8")).toThrow()
  })

  it("routes current preflights through v0811 rather than the historical v088 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0822-acceptance-schema.mjs"')
      expect(source).toContain("readV0822AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readV087AcceptanceManifest(packageRoot)")
    }
  })
})
