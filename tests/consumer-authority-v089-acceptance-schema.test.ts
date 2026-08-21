import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V089AcceptanceManifestError,
  canonicalV089AcceptanceManifest,
  parseV089AcceptanceManifest,
} from "../scripts/consumer-authority-v089-acceptance-schema.mjs"
import { parseV088AcceptanceManifest } from "../scripts/consumer-authority-v088-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.9 acceptance schema", () => {
  it("keeps the strict 0.8.9 record as published history", () => {
    const manifest = parseV089AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v089-acceptance.json"), "utf8")),
      "0.8.9",
    )
    const v088 = parseV088AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v088-acceptance.json"), "utf8")),
      "0.8.8",
    )

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.9" })
    expect(manifest.v088HistoricalRelease).toMatchObject({ reusableForV089: false, version: "0.8.8" })
    expect(v088.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.8" })
  })

  it("rejects neighboring package versions and a reused v0.8.8 record", () => {
    expect(() => parseV089AcceptanceManifest(canonicalV089AcceptanceManifest(), "0.8.8")).toThrow(V089AcceptanceManifestError)
    expect(() => parseV088AcceptanceManifest(canonicalV089AcceptanceManifest(), "0.8.9")).toThrow()
  })

  it("routes current preflights through v0811 rather than the historical v089 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0821-acceptance-schema.mjs"')
      expect(source).toContain("readV0821AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readV089AcceptanceManifest(packageRoot)")
    }
  })
})
