import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0829AcceptanceManifestError,
  canonicalV0829AcceptanceManifest,
  parseV0829AcceptanceManifest,
  readV0829AcceptanceManifest,
} from "../scripts/consumer-authority-v0829-acceptance-schema.mjs"
import { parseV0828AcceptanceManifest } from "../scripts/consumer-authority-v0828-acceptance-schema.mjs"
import { PACKAGE_EXERCISE_PHASES } from "../scripts/clean-package-exercise-phase.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.29 acceptance schema", () => {
  it("binds the current package to the automatic philosophy and OpenCode skills boundary", () => {
    const manifest = readV0829AcceptanceManifest(repositoryRoot)

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.29" })
    expect(manifest.v0828HistoricalRelease).toMatchObject({ reusableForV0829: false, version: "0.8.28" })
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

  it("rejects neighboring versions, drift, and reused 0.8.28 authority", () => {
    expect(() => parseV0829AcceptanceManifest(canonicalV0829AcceptanceManifest(), "0.8.28")).toThrow(V0829AcceptanceManifestError)
    expect(() => parseV0829AcceptanceManifest(canonicalV0829AcceptanceManifest(), "0.8.30")).toThrow(V0829AcceptanceManifestError)
    expect(() => parseV0828AcceptanceManifest(canonicalV0829AcceptanceManifest(), "0.8.29")).toThrow()
  })

  it("routes current external preflights through v0829 and keeps v0828 historical", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-v0829-acceptance-schema.mjs"')
      expect(source).toContain("readV0829AcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0828-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0828AcceptanceManifest(packageRoot)")
    }
  })
})
