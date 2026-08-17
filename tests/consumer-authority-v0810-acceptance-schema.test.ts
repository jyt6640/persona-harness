import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0810AcceptanceManifestError,
  canonicalV0810AcceptanceManifest,
  parseV0810AcceptanceManifest,
  readV0810AcceptanceManifest,
} from "../scripts/consumer-authority-v0810-acceptance-schema.mjs"
import { parseV089AcceptanceManifest } from "../scripts/consumer-authority-v089-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.10 acceptance schema", () => {
  it("binds the current package to 0.8.10 while retaining the published v0.8.9 record as history", () => {
    const manifest = readV0810AcceptanceManifest(repositoryRoot)
    const packageLock = JSON.parse(readFileSync(join(repositoryRoot, "package-lock.json"), "utf8"))
    const v089 = parseV089AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v089-acceptance.json"), "utf8")),
      "0.8.9",
    )

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.10" })
    expect(packageLock).toMatchObject({ version: manifest.package.version })
    expect(packageLock.packages[""]).toMatchObject({ version: manifest.package.version })
    expect(manifest.v089HistoricalRelease).toMatchObject({ reusableForV0810: false, version: "0.8.9" })
    expect(v089.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.9" })
  })

  it("rejects neighboring package versions and a reused v0.8.9 record", () => {
    expect(() => parseV0810AcceptanceManifest(canonicalV0810AcceptanceManifest(), "0.8.9")).toThrow(V0810AcceptanceManifestError)
    expect(() => parseV089AcceptanceManifest(canonicalV0810AcceptanceManifest(), "0.8.10")).toThrow()
  })

  it("routes current preflights through v0810 rather than the historical v089 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0810-acceptance-schema.mjs"')
      expect(source).toContain("readV0810AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readV089AcceptanceManifest(packageRoot)")
    }
  })
})
