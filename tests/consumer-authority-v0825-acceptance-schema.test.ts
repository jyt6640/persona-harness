import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0825AcceptanceManifestError,
  canonicalV0825AcceptanceManifest,
  parseV0825AcceptanceManifest,
  readV0825AcceptanceManifest,
} from "../scripts/consumer-authority-v0825-acceptance-schema.mjs"
import { parseV0824AcceptanceManifest } from "../scripts/consumer-authority-v0824-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.25 acceptance schema", () => {
  it("binds the current package to the exact cooperative Gradle/JUnit demo contract", () => {
    const manifest = readV0825AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.25" })
    expect(manifest.v0824HistoricalRelease).toMatchObject({ reusableForV0825: false, version: "0.8.24" })
    expect(manifest.workflowDemonstration).toEqual({
      cooperativeFinish: "exact-packed-package-java21-gradle94-junit-block-to-cooperative-pass",
      protectedCi: "verify-repository-runs-demo-cooperative-finish",
      runtimeInjection: "legacy-hook-demos-explicit-preview-opt-in-default-off",
    })
    expect(manifest.releaseTruth).toEqual({
      stableBody: "stable-release-source-candidate-language-rejected-before-render",
      publishedHistory: "v0824-published-release-remains-immutable-and-nonreusable",
      verification: "public-docs-map-package-smoke-unit-repository-and-cooperative-demo-contracts",
    })
  })

  it("rejects neighboring versions, drift, and reused 0.8.24 authority", () => {
    expect(() => parseV0825AcceptanceManifest(canonicalV0825AcceptanceManifest(), "0.8.24")).toThrow(V0825AcceptanceManifestError)
    expect(() => parseV0825AcceptanceManifest(canonicalV0825AcceptanceManifest(), "0.8.26")).toThrow(V0825AcceptanceManifestError)
    expect(() => parseV0824AcceptanceManifest(canonicalV0825AcceptanceManifest(), "0.8.25")).toThrow()
    const manifest = canonicalV0825AcceptanceManifest() as {
      workflowDemonstration: { cooperativeFinish: string }
    }
    manifest.workflowDemonstration.cooperativeFinish = "skip-gradle"
    expect(() => parseV0825AcceptanceManifest(manifest, "0.8.25")).toThrow(V0825AcceptanceManifestError)
  })

  it("routes current external preflights through v0825 and keeps v0824 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0825-acceptance-schema.mjs"')
      expect(source).toContain("readV0825AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0824-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0824AcceptanceManifest(packageRoot)")
    }
  })
})
