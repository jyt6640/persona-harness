import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0811AcceptanceManifestError,
  canonicalV0811AcceptanceManifest,
  parseV0811AcceptanceManifest,
} from "../scripts/consumer-authority-v0811-acceptance-schema.mjs"
import { parseV0810AcceptanceManifest } from "../scripts/consumer-authority-v0810-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.11 acceptance schema", () => {
  it("binds the current package to 0.8.11 while retaining 0.8.10 as history", () => {
    const manifest = parseV0811AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0811-acceptance.json"), "utf8")),
      "0.8.11",
    )
    const v0810 = parseV0810AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0810-acceptance.json"), "utf8")),
      "0.8.10",
    )

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.11" })
    expect(manifest.v0810HistoricalRelease).toMatchObject({ reusableForV0811: false, version: "0.8.10" })
    expect(v0810.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.10" })
  })

  it("rejects neighboring versions and a reused historical v0.8.10 record", () => {
    expect(() => parseV0811AcceptanceManifest(canonicalV0811AcceptanceManifest(), "0.8.10")).toThrow(V0811AcceptanceManifestError)
    expect(() => parseV0811AcceptanceManifest(canonicalV0811AcceptanceManifest(), "0.8.12")).toThrow(V0811AcceptanceManifestError)
    expect(() => parseV0810AcceptanceManifest(canonicalV0811AcceptanceManifest(), "0.8.11")).toThrow()
  })

  it("keeps current preflights off the historical v0811 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0823-acceptance-schema.mjs"')
      expect(source).toContain("readV0823AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0810-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0810AcceptanceManifest(packageRoot)")
    }
  })
})
