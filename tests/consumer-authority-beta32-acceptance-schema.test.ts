import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  Beta32AcceptanceManifestError,
  canonicalBeta32AcceptanceManifest,
  parseBeta32AcceptanceManifest,
  readBeta32AcceptanceManifest,
} from "../scripts/consumer-authority-beta32-acceptance-schema.mjs"
import { parseBeta31AcceptanceManifest } from "../scripts/consumer-authority-beta31-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority beta.32 acceptance schema", () => {
  it("ships the known-completion policy with current package and root-bound contract authority", () => {
    const manifest = readBeta32AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ version: "0.8.0-beta.32" })
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
      beta31HistoricalPackageContract: {
        reusableForBeta32: false,
        version: "0.8.0-beta.31",
      },
    })
    expect(manifest.packageBoundary).toMatchObject({
      currentVersionAuthority: expect.stringContaining("package-lock"),
      authoritativeBundleContract: {
        rootPolicy: expect.stringContaining("fresh-installed-contracts"),
      },
    })
  })

  it("rejects acceptance drift rather than accepting a partial selector contract", () => {
    const fixture = canonicalBeta32AcceptanceManifest()
    const selection = fixture.observerGhSelection as { packageRecord: Record<string, unknown> }
    const packageRecord = selection.packageRecord
    packageRecord.shapes = ["canonical"]

    expect(() => parseBeta32AcceptanceManifest(fixture, "0.8.0-beta.32")).toThrow(Beta32AcceptanceManifestError)
    const beta31 = JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta31-acceptance.json"), "utf8"))
    expect(parseBeta31AcceptanceManifest(beta31, "0.8.0-beta.31")).toHaveProperty("schemaVersion", "consumer-authority-beta31-acceptance.1")
  })

  it("routes current package preflights through the beta32 acceptance record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-beta32-acceptance-schema.mjs"')
      expect(source).toContain("readBeta32AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readBeta31AcceptanceManifest")
    }
  })
})
