import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0830AcceptanceManifestError,
  canonicalV0830AcceptanceManifest,
  parseV0830AcceptanceManifest,
  readV0830AcceptanceManifest,
} from "../scripts/consumer-authority-v0830-acceptance-schema.mjs"
import { parseV0829AcceptanceManifest } from "../scripts/consumer-authority-v0829-acceptance-schema.mjs"
import { PACKAGE_EXERCISE_PHASES } from "../scripts/clean-package-exercise-phase.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.30 acceptance schema", () => {
  it("binds its historical package root to the owner dogfooding feedback boundary", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0830AcceptanceManifest(historicalPackageRoot)

      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.30" })
      expect(manifest.v0829HistoricalRelease).toMatchObject({ reusableForV0830: false, version: "0.8.29" })
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

  it("rejects neighboring versions, drift, and reused 0.8.29 authority", () => {
    expect(() => parseV0830AcceptanceManifest(canonicalV0830AcceptanceManifest(), "0.8.29")).toThrow(V0830AcceptanceManifestError)
    expect(() => parseV0830AcceptanceManifest(canonicalV0830AcceptanceManifest(), "0.8.31")).toThrow(V0830AcceptanceManifestError)
    expect(() => readV0830AcceptanceManifest(repositoryRoot)).toThrow(V0830AcceptanceManifestError)
    expect(() => parseV0829AcceptanceManifest(canonicalV0830AcceptanceManifest(), "0.8.30")).toThrow()
  })

  it("keeps current external preflights off the historical v0830 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-current-acceptance-schema.mjs"')
      expect(source).toContain("readCurrentAcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0830-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0830AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0829-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0829AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0830-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0830-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0830-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.30"}\n', "utf8")
  return packageRoot
}
