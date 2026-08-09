import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  Rc1AcceptanceManifestError,
  canonicalRc1AcceptanceManifest,
  parseRc1AcceptanceManifest,
  readRc1AcceptanceManifest,
} from "../scripts/consumer-authority-rc1-acceptance-schema.mjs"
import { parseBeta31AcceptanceManifest } from "../scripts/consumer-authority-beta31-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority rc.1 acceptance schema", () => {
  it("ships the known-completion policy with current package and root-bound contract authority", () => {
    const manifest = readRc1AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ version: "0.8.0-rc.1" })
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
      beta34HistoricalStagingOnly: {
        reusableForRc1: false,
        version: "0.8.0-beta.34",
      },
    })
    expect((manifest.beta34HistoricalStagingOnly as { outcome: string }).outcome)
      .toContain("staging-channel-only")
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
    const fixture = canonicalRc1AcceptanceManifest()
    const selection = fixture.observerGhSelection as { packageRecord: Record<string, unknown> }
    const packageRecord = selection.packageRecord
    packageRecord.shapes = ["canonical"]

    expect(() => parseRc1AcceptanceManifest(fixture, "0.8.0-rc.1")).toThrow(Rc1AcceptanceManifestError)
    const beta31 = JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta31-acceptance.json"), "utf8"))
    expect(parseBeta31AcceptanceManifest(beta31, "0.8.0-beta.31")).toHaveProperty("schemaVersion", "consumer-authority-beta31-acceptance.1")
  })

  it("routes current package preflights through the rc1 acceptance record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-rc1-acceptance-schema.mjs"')
      expect(source).toContain("readRc1AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readBeta31AcceptanceManifest")
    }
  })
})
