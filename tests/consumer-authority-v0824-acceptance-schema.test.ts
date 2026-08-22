import { readFileSync } from "node:fs"
import { join } from "node:path"

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
  it("binds the current package to the exact cooperative Gradle/JUnit demo contract", () => {
    const manifest = readV0824AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.24" })
    expect(manifest.v0823HistoricalRelease).toMatchObject({ reusableForV0824: false, version: "0.8.23" })
    expect(manifest.workflowDemonstration).toEqual({
      cooperativeFinish: "exact-packed-package-java21-gradle94-junit-block-to-cooperative-pass",
      protectedCi: "verify-repository-runs-demo-cooperative-finish",
      runtimeInjection: "legacy-hook-demos-explicit-preview-opt-in-default-off",
    })
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

  it("routes current external preflights through v0824 and keeps v0823 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0824-acceptance-schema.mjs"')
      expect(source).toContain("readV0824AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0823-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0823AcceptanceManifest(packageRoot)")
    }
  })
})
