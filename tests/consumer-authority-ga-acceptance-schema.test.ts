import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  GaAcceptanceManifestError,
  canonicalGaAcceptanceManifest,
  parseGaAcceptanceManifest,
  readGaAcceptanceManifest,
} from "../scripts/consumer-authority-ga-acceptance-schema.mjs"
import { parseBeta31AcceptanceManifest } from "../scripts/consumer-authority-beta31-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0 acceptance schema", () => {
  it("ships the known-completion policy with current package and root-bound contract authority", () => {
    const manifest = readGaAcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ version: "0.8.0" })
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
      // beta32's own record about beta33 carries forward unchanged.
      beta32HistoricalParserPreflight: {
        reusableForBeta33: false,
        version: "0.8.0-beta.32",
      },
      // beta.34 is superseded because it was accepted for staging only.
      rc1HistoricalNextChannelOnly: {
        reusableForGa: false,
        version: "0.8.0-rc.1",
      },
    })
    expect((manifest.rc1HistoricalNextChannelOnly as { outcome: string }).outcome)
      .toContain("release-candidate-cycle")
    expect(manifest.package).toMatchObject({ channel: "latest", scope: "ga-approved" })
    expect(manifest.packageBoundary).toMatchObject({
      currentVersionAuthority: expect.stringContaining("package-lock"),
      authoritativeBundleContract: {
        exercisePhaseProtocol: {
          authorityDiscoveryResult: {
            marker: "authority-discovery-exercise-result",
            result: "trusted-unconsumed-persisted",
            schemaVersion: "consumer-authority-discovery-exercise.1",
          },
          schemaVersion: "clean-package-exercise-phase.1",
          sourceBuilt: expect.arrayContaining(["cli-binding", "attestation-parser", "bootstrap-workspace-intake"]),
          freshTar: expect.arrayContaining(["tarball-materialization", "attestation-parser", "installed-package-test"]),
        },
        rootPolicy: expect.stringContaining("fresh-installed-contracts"),
      },
    })
  })

  it("rejects acceptance drift rather than accepting a partial selector contract", () => {
    const fixture = canonicalGaAcceptanceManifest()
    const selection = fixture.observerGhSelection as { packageRecord: Record<string, unknown> }
    const packageRecord = selection.packageRecord
    packageRecord.shapes = ["canonical"]

    expect(() => parseGaAcceptanceManifest(fixture, "0.8.0")).toThrow(GaAcceptanceManifestError)
    const beta31 = JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta31-acceptance.json"), "utf8"))
    expect(parseBeta31AcceptanceManifest(beta31, "0.8.0-beta.31")).toHaveProperty("schemaVersion", "consumer-authority-beta31-acceptance.1")
  })

  it("routes current package preflights through the ga acceptance record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-ga-acceptance-schema.mjs"')
      expect(source).toContain("readGaAcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readBeta31AcceptanceManifest")
    }
  })
})
