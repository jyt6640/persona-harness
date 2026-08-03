import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  Beta31AcceptanceManifestError,
  canonicalBeta31AcceptanceManifest,
  parseBeta31AcceptanceManifest,
  readBeta31AcceptanceManifest,
} from "../scripts/consumer-authority-beta31-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority beta.31 acceptance schema", () => {
  it("ships the known-completion mode-independent package-record policy with only bounded shapes", () => {
    const manifest = readBeta31AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ version: "0.8.0-beta.31" })
    expect(manifest.observerGhSelection).toMatchObject({
      dpkgOwnership: expect.stringContaining("installed-status-ii"),
      packageRecord: {
        ancillary: expect.stringContaining("known-completion"),
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
    expect((manifest.closureCompleteness as { localProof: string }).localProof).toContain("known-completion-mode-independent")
    expect(manifest).toMatchObject({
      beta30HistoricalObserverTool: {
        reusableForBeta31: false,
        version: "0.8.0-beta.30",
      },
    })
  })

  it("rejects acceptance drift rather than accepting a partial selector contract", () => {
    const fixture = canonicalBeta31AcceptanceManifest()
    const selection = fixture.observerGhSelection as { packageRecord: Record<string, unknown> }
    const packageRecord = selection.packageRecord
    packageRecord.shapes = ["canonical"]

    expect(() => parseBeta31AcceptanceManifest(fixture, "0.8.0-beta.31")).toThrow(Beta31AcceptanceManifestError)
    expect(JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta29-acceptance.json"), "utf8"))).toHaveProperty("schemaVersion", "consumer-authority-beta29-acceptance.1")
  })
})
