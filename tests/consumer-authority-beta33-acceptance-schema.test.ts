import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  Beta33AcceptanceManifestError,
  canonicalBeta33AcceptanceManifest,
  parseBeta33AcceptanceManifest,
  readBeta33AcceptanceManifest,
} from "../scripts/consumer-authority-beta33-acceptance-schema.mjs"
import { parseBeta31AcceptanceManifest } from "../scripts/consumer-authority-beta31-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority beta.33 acceptance schema", () => {
  it("ships the known-completion policy with current package and root-bound contract authority", () => {
    const manifest = readBeta33AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ version: "0.8.0-beta.33" })
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
      beta32HistoricalParserPreflight: {
        reusableForBeta33: false,
        version: "0.8.0-beta.32",
      },
    })
    expect(manifest.packageBoundary).toMatchObject({
      currentVersionAuthority: expect.stringContaining("package-lock"),
      authoritativeBundleContract: {
        exercisePhaseProtocol: {
          schemaVersion: "clean-package-exercise-phase.1",
          sourceBuilt: expect.arrayContaining(["cli-binding", "attestation-parser", "bootstrap-workspace-intake"]),
          freshTar: expect.arrayContaining(["tarball-materialization", "attestation-parser", "installed-package-test"]),
        },
        rootPolicy: expect.stringContaining("fresh-installed-contracts"),
      },
    })
  })

  it("rejects acceptance drift rather than accepting a partial selector contract", () => {
    const fixture = canonicalBeta33AcceptanceManifest()
    const selection = fixture.observerGhSelection as { packageRecord: Record<string, unknown> }
    const packageRecord = selection.packageRecord
    packageRecord.shapes = ["canonical"]

    expect(() => parseBeta33AcceptanceManifest(fixture, "0.8.0-beta.33")).toThrow(Beta33AcceptanceManifestError)
    const beta31 = JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta31-acceptance.json"), "utf8"))
    expect(parseBeta31AcceptanceManifest(beta31, "0.8.0-beta.31")).toHaveProperty("schemaVersion", "consumer-authority-beta31-acceptance.1")
  })

  it("routes current package preflights through the beta33 acceptance record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-beta33-acceptance-schema.mjs"')
      expect(source).toContain("readBeta33AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readBeta31AcceptanceManifest")
    }
  })
})
