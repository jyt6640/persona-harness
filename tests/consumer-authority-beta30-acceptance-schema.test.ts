import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  Beta30AcceptanceManifestError,
  canonicalBeta30AcceptanceManifest,
  parseBeta30AcceptanceManifest,
  readBeta30AcceptanceManifest,
} from "../scripts/consumer-authority-beta30-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority beta.30 historical acceptance schema", () => {
  it("keeps the historical primary-centric optional-secondary package-record policy strict", () => {
    const manifest = canonicalBeta30AcceptanceManifest()
    const shipped = JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta30-acceptance.json"), "utf8"))

    expect(parseBeta30AcceptanceManifest(shipped, "0.8.0-beta.30")).toEqual(manifest)

    expect(manifest.package).toMatchObject({ version: "0.8.0-beta.30" })
    expect(manifest.observerGhSelection).toMatchObject({
      dpkgOwnership: expect.stringContaining("installed-status-ii"),
      packageRecord: {
        ancillary: expect.stringContaining("allow-an-absent"),
        primary: expect.stringContaining("/usr/bin/gh"),
        shapes: [
          "record-encoding",
          "record-path",
          "primary-missing",
          "primary-unsafe",
          "ancillary-unsafe",
          "executable-ambiguous",
          "lstat-failed",
          "canonical",
        ],
      },
    })
    expect((manifest.closureCompleteness as { localProof: string }).localProof).toContain("primary-centric-optional")
  })

  it("rejects acceptance drift rather than accepting a partial selector contract", () => {
    const fixture = canonicalBeta30AcceptanceManifest()
    const selection = fixture.observerGhSelection as { packageRecord: Record<string, unknown> }
    const packageRecord = selection.packageRecord
    packageRecord.shapes = ["canonical"]

    expect(() => parseBeta30AcceptanceManifest(fixture, "0.8.0-beta.30")).toThrow(Beta30AcceptanceManifestError)
    expect(() => readBeta30AcceptanceManifest(repositoryRoot)).toThrow(Beta30AcceptanceManifestError)
    expect(JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta29-acceptance.json"), "utf8"))).toHaveProperty("schemaVersion", "consumer-authority-beta29-acceptance.1")
  })
})
