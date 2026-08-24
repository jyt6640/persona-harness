import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it } from "vitest"

import {
  V0824AcceptanceManifestError,
  canonicalV0824AcceptanceManifest,
  parseV0824AcceptanceManifest,
  readV0824AcceptanceManifest,
} from "../scripts/consumer-authority-v0824-acceptance-schema.mjs"
import { parseV0823AcceptanceManifest } from "../scripts/consumer-authority-v0823-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.24 acceptance schema", () => {
  it("binds the historical package to the exact cooperative Gradle/JUnit demo contract", () => {
    const historicalPackageRoot = createHistoricalPackageRoot()
    try {
      const manifest = readV0824AcceptanceManifest(historicalPackageRoot)

      expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.24" })
      expect(manifest.v0823HistoricalRelease).toMatchObject({ reusableForV0824: false, version: "0.8.23" })
      expect(manifest.workflowDemonstration).toEqual({
        cooperativeFinish: "exact-packed-package-java21-gradle94-junit-block-to-cooperative-pass",
        protectedCi: "verify-repository-runs-demo-cooperative-finish",
        runtimeInjection: "legacy-hook-demos-explicit-preview-opt-in-default-off",
      })
    } finally {
      rmSync(historicalPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects neighboring versions, drift, and reused 0.8.23 authority", () => {
    expect(() => parseV0824AcceptanceManifest(canonicalV0824AcceptanceManifest(), "0.8.23")).toThrow(V0824AcceptanceManifestError)
    expect(() => parseV0824AcceptanceManifest(canonicalV0824AcceptanceManifest(), "0.8.25")).toThrow(V0824AcceptanceManifestError)
    expect(() => parseV0823AcceptanceManifest(canonicalV0824AcceptanceManifest(), "0.8.24")).toThrow()
    const manifest = canonicalV0824AcceptanceManifest() as {
      workflowDemonstration: { cooperativeFinish: string }
    }
    manifest.workflowDemonstration.cooperativeFinish = "skip-gradle"
    expect(() => parseV0824AcceptanceManifest(manifest, "0.8.24")).toThrow(V0824AcceptanceManifestError)
  })

  it("keeps current external preflights off the historical v0824 record", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0828-acceptance-schema.mjs"')
      expect(source).toContain("readV0828AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0824-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0824AcceptanceManifest(packageRoot)")
    }
  })
})

function createHistoricalPackageRoot() {
  const packageRoot = mkdtempSync(join(tmpdir(), "persona-harness-v0824-history-"))
  const releaseRoot = join(packageRoot, "docs", "current", "release")
  mkdirSync(releaseRoot, { recursive: true })
  copyFileSync(
    join(repositoryRoot, "docs", "current", "release", "consumer-authority-v0824-acceptance.json"),
    join(releaseRoot, "consumer-authority-v0824-acceptance.json"),
  )
  writeFileSync(join(packageRoot, "package.json"), '{"version":"0.8.24"}\n', "utf8")
  return packageRoot
}
