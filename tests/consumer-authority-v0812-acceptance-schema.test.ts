import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0812AcceptanceManifestError,
  canonicalV0812AcceptanceManifest,
  parseV0812AcceptanceManifest,
  readV0812AcceptanceManifest,
} from "../scripts/consumer-authority-v0812-acceptance-schema.mjs"
import { parseV0810AcceptanceManifest } from "../scripts/consumer-authority-v0810-acceptance-schema.mjs"
import { parseV0811AcceptanceManifest } from "../scripts/consumer-authority-v0811-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.12 acceptance schema", () => {
  it("binds the current package to 0.8.12 while retaining 0.8.11 as history", () => {
    const manifest = readV0812AcceptanceManifest(repositoryRoot)
    const v0810 = parseV0810AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0810-acceptance.json"), "utf8")),
      "0.8.10",
    )
    const v0811 = parseV0811AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0811-acceptance.json"), "utf8")),
      "0.8.11",
    )

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.12" })
    expect(manifest.v0810HistoricalRelease).toMatchObject({ reusableForV0812: false, version: "0.8.10" })
    expect(v0810.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.10" })
    expect(manifest.v0811HistoricalRelease).toMatchObject({ reusableForV0812: false, version: "0.8.11" })
    expect(v0811.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.11" })
    expect(manifest.authority.fetchSelection).toMatchObject({
      repositoryOnly: "blocked-before-enrollment-or-fetch",
      requiredTuple: ["artifactId", "runId", "sourceHead", "artifactDigest"],
    })
  })

  it("rejects neighboring versions and reused historical records", () => {
    expect(() => parseV0812AcceptanceManifest(canonicalV0812AcceptanceManifest(), "0.8.10")).toThrow(V0812AcceptanceManifestError)
    expect(() => parseV0812AcceptanceManifest(canonicalV0812AcceptanceManifest(), "0.8.13")).toThrow(V0812AcceptanceManifestError)
    expect(() => parseV0811AcceptanceManifest(canonicalV0812AcceptanceManifest(), "0.8.12")).toThrow()
    expect(() => parseV0810AcceptanceManifest(canonicalV0812AcceptanceManifest(), "0.8.12")).toThrow()
  })

  it("routes current preflights through v0812 and off historical records", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0812-acceptance-schema.mjs"')
      expect(source).toContain("readV0812AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0810-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0810AcceptanceManifest(packageRoot)")
    }
  })
})
