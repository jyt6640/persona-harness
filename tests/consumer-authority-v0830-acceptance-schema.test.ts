import { readFileSync } from "node:fs"
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
  it("binds the current package to the owner dogfooding feedback boundary", () => {
    const manifest = readV0830AcceptanceManifest(repositoryRoot)

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
  })

  it("rejects neighboring versions, drift, and reused 0.8.29 authority", () => {
    expect(() => parseV0830AcceptanceManifest(canonicalV0830AcceptanceManifest(), "0.8.29")).toThrow(V0830AcceptanceManifestError)
    expect(() => parseV0830AcceptanceManifest(canonicalV0830AcceptanceManifest(), "0.8.31")).toThrow(V0830AcceptanceManifestError)
    expect(() => parseV0829AcceptanceManifest(canonicalV0830AcceptanceManifest(), "0.8.30")).toThrow()
  })

  it("routes current external preflights through v0830 and keeps v0829 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0830-acceptance-schema.mjs"')
      expect(source).toContain("readV0830AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0829-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0829AcceptanceManifest(packageRoot)")
    }
  })
})
