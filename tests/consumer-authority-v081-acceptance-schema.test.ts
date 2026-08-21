import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V081AcceptanceManifestError,
  canonicalV081AcceptanceManifest,
  parseV081AcceptanceManifest,
} from "../scripts/consumer-authority-v081-acceptance-schema.mjs"
import { parseGaAcceptanceManifest } from "../scripts/consumer-authority-ga-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.1 acceptance schema", () => {
  it("keeps the known-completion policy in the strict historical record", () => {
    const manifest = parseV081AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v081-acceptance.json"), "utf8")),
      "0.8.1",
    )

    expect(manifest.package).toMatchObject({ version: "0.8.1" })
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
      // 0.8.0 is superseded only for what this patch changes, and stays the
      // accepted general-availability record for its own tree.
      gaHistoricalSupersededByPatch: {
        reusableForV081: false,
        version: "0.8.0",
      },
    })
    expect((manifest.gaHistoricalSupersededByPatch as { outcome: string }).outcome)
      .toContain("general-availability-record-for-its-own-tree")
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
    const fixture = canonicalV081AcceptanceManifest()
    const selection = fixture.observerGhSelection as { packageRecord: Record<string, unknown> }
    const packageRecord = selection.packageRecord
    packageRecord.shapes = ["canonical"]

    expect(() => parseV081AcceptanceManifest(fixture, "0.8.1")).toThrow(V081AcceptanceManifestError)
    // The predecessor stays strict at its own version rather than loosening as
    // the chain advances.
    const ga = JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-ga-acceptance.json"), "utf8"))
    expect(parseGaAcceptanceManifest(ga, "0.8.0")).toHaveProperty("schemaVersion", "consumer-authority-ga-acceptance.1")
  })

  it("refuses the record when the package version does not match it exactly", () => {
    // The publisher recomputes facts against the installed package, and a
    // record that accepted a neighbouring version would let one release's
    // acceptance stand in for another's. `0.8.0` failing here is the point.
    const fixture = canonicalV081AcceptanceManifest()

    expect(() => parseV081AcceptanceManifest(fixture, "0.8.0")).toThrow(V081AcceptanceManifestError)
    expect(() => parseV081AcceptanceManifest(fixture, "0.8.2")).toThrow(V081AcceptanceManifestError)
  })

  it("does not let current package preflights reuse the 0.8.1 acceptance record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0817-acceptance-schema.mjs"')
      expect(source).toContain("readV0817AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readV081AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readV082AcceptanceManifest(packageRoot)")
      expect(source).not.toContain("readGaAcceptanceManifest")
    }
  })
})
