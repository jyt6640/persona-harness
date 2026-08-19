import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0810AcceptanceManifestError,
  canonicalV0810AcceptanceManifest,
  parseV0810AcceptanceManifest,
} from "../scripts/consumer-authority-v0810-acceptance-schema.mjs"
import { parseV089AcceptanceManifest } from "../scripts/consumer-authority-v089-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("historical consumer authority 0.8.10 acceptance schema", () => {
  it("keeps the immutable 0.8.10 record strict after current authority advances", () => {
    const manifest = parseV0810AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0810-acceptance.json"), "utf8")),
      "0.8.10",
    )
    const v089 = parseV089AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v089-acceptance.json"), "utf8")),
      "0.8.9",
    )

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.10" })
    expect(manifest.v089HistoricalRelease).toMatchObject({ reusableForV0810: false, version: "0.8.9" })
    expect(v089.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.9" })
  })

  it("rejects neighboring package versions and a reused v0.8.9 record", () => {
    expect(() => parseV0810AcceptanceManifest(canonicalV0810AcceptanceManifest(), "0.8.9")).toThrow(V0810AcceptanceManifestError)
    expect(() => parseV089AcceptanceManifest(canonicalV0810AcceptanceManifest(), "0.8.10")).toThrow()
  })

  it("does not let current preflights reuse the historical v0810 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).not.toContain('from "./consumer-authority-v0810-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0810AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readV089AcceptanceManifest(packageRoot)")
    }
  })
})
