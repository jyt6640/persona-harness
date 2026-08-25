import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import {
  V0831AcceptanceManifestError,
  canonicalV0831AcceptanceManifest,
  parseV0831AcceptanceManifest,
  readV0831AcceptanceManifest,
} from "../scripts/consumer-authority-v0831-acceptance-schema.mjs"
import { parseV0830AcceptanceManifest } from "../scripts/consumer-authority-v0830-acceptance-schema.mjs"
import { PACKAGE_EXERCISE_PHASES } from "../scripts/clean-package-exercise-phase.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.31 acceptance schema", () => {
  it("binds the historical package to the source-read workflow diagnosis boundary", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0831AcceptanceManifest(historicalPackageRoot)

      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.31" })
      expect(manifest.v0830HistoricalRelease).toMatchObject({ reusableForV0831: false, version: "0.8.30" })
      expect(manifest.workflowFinishSourceReadDiagnostic).toEqual({
        blockerId: "source-read-runtime-unavailable",
        recordedArtifacts: "diagnostic-only-and-never-finish-authority",
        retry: "restore-source-read-environment-before-retrying-finish",
      })
      expect(manifest).toMatchObject({
        packageBoundary: {
          authoritativeBundleContract: {
            exercisePhaseProtocol: {
              freshTar: PACKAGE_EXERCISE_PHASES["fresh-tar"],
            },
          },
        },
      })
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions, drift, and reused 0.8.30 authority", () => {
    expect(() => parseV0831AcceptanceManifest(canonicalV0831AcceptanceManifest(), "0.8.30")).toThrow(V0831AcceptanceManifestError)
    expect(() => parseV0831AcceptanceManifest(canonicalV0831AcceptanceManifest(), "0.8.32")).toThrow(V0831AcceptanceManifestError)
    expect(() => parseV0830AcceptanceManifest(canonicalV0831AcceptanceManifest(), "0.8.31")).toThrow()
  })

  it("keeps current external preflights off the historical v0831 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0832-acceptance-schema.mjs"')
      expect(source).toContain("readV0832AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0831-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0831AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0831-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0831-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0831-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.31"}\n', "utf8")
  return packageRoot
}
