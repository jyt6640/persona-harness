import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V085AcceptanceManifestError,
  canonicalV085AcceptanceManifest,
  parseV085AcceptanceManifest,
} from "../scripts/consumer-authority-v085-acceptance-schema.mjs"
import { parseV082AcceptanceManifest } from "../scripts/consumer-authority-v082-acceptance-schema.mjs"
import { parseV084AcceptanceManifest } from "../scripts/consumer-authority-v084-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("historical consumer authority 0.8.5 acceptance schema", () => {
  it("keeps the immutable v0.8.5 record strict without treating it as current", () => {
    const manifest = parseV085AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v085-acceptance.json"), "utf8")),
      "0.8.5",
    )
    const v082 = parseV082AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v082-acceptance.json"), "utf8")),
      "0.8.2",
    )
    const v084 = parseV084AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v084-acceptance.json"), "utf8")),
      "0.8.4",
    )

    expect(manifest.package).toMatchObject({ scope: "source-candidate", version: "0.8.5" })
    expect(manifest.v082HistoricalRelease).toMatchObject({ reusableForV085: false, version: "0.8.2" })
    expect(manifest.v083HistoricalRelease).toMatchObject({ reusableForV085: false, version: "0.8.3" })
    expect(manifest.v084HistoricalRelease).toMatchObject({ reusableForV085: false, version: "0.8.4" })
    expect(v082.package).toMatchObject({ channel: "latest", scope: "ga-approved", version: "0.8.2" })
    expect(v084.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.4" })
  })

  it("rejects neighboring versions and records that attempt to reuse v0.8.2 as current", () => {
    const fixture = canonicalV085AcceptanceManifest()
    const packageRecord = fixture.package as Record<string, unknown>
    packageRecord.version = "0.8.2"

    expect(() => parseV085AcceptanceManifest(fixture, "0.8.5")).toThrow(V085AcceptanceManifestError)
    expect(() => parseV085AcceptanceManifest(canonicalV085AcceptanceManifest(), "0.8.6")).toThrow(V085AcceptanceManifestError)
    expect(() => parseV082AcceptanceManifest(canonicalV085AcceptanceManifest(), "0.8.5")).toThrow()
  })
})
