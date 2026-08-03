import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  Beta29AcceptanceManifestError,
  canonicalBeta29AcceptanceManifest,
  parseBeta29AcceptanceManifest,
  readBeta29AcceptanceManifest,
} from "../scripts/consumer-authority-beta29-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority beta.29 acceptance schema", () => {
  it("ships the strict package-record selection policy with only bounded shapes", () => {
    const manifest = readBeta29AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ version: "0.8.0-beta.29" })
    expect(manifest.observerGhSelection).toMatchObject({
      dpkgOwnership: expect.stringContaining("installed-status-ii"),
      packageRecord: {
        primary: expect.stringContaining("/usr/bin/gh"),
        shapes: [
          "record-encoding",
          "record-path",
          "primary-missing",
          "primary-unsafe",
          "ancillary-missing-or-unsafe",
          "ancillary-unknown",
          "executable-ambiguous",
          "lstat-failed",
          "canonical",
        ],
      },
    })
    expect((manifest.closureCompleteness as { localProof: string }).localProof).toContain("byte-strict-package-record")
  })

  it("rejects acceptance drift rather than accepting a partial selector contract", () => {
    const fixture = canonicalBeta29AcceptanceManifest()
    const selection = fixture.observerGhSelection as { packageRecord: Record<string, unknown> }
    const packageRecord = selection.packageRecord
    packageRecord.shapes = ["canonical"]

    expect(() => parseBeta29AcceptanceManifest(fixture, "0.8.0-beta.29")).toThrow(Beta29AcceptanceManifestError)
    expect(JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta28-acceptance.json"), "utf8"))).toHaveProperty("schemaVersion", "consumer-authority-beta28-acceptance.1")
  })
})
