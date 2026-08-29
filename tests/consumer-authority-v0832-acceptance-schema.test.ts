import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V0832AcceptanceManifestError,
  canonicalV0832AcceptanceManifest,
  parseV0832AcceptanceManifest,
} from "../scripts/consumer-authority-v0832-acceptance-schema.mjs"
import { parseV0831AcceptanceManifest } from "../scripts/consumer-authority-v0831-acceptance-schema.mjs"
import { PACKAGE_EXERCISE_PHASES } from "../scripts/clean-package-exercise-phase.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.32 acceptance schema", () => {
  it("retains the legacy auto-update recovery boundary as historical data", () => {
    const manifest = parseV0832AcceptanceManifest(canonicalV0832AcceptanceManifest(), "0.8.32")

    expect(manifest.package).toMatchObject({ channel: "unpublished", scope: "source-candidate", version: "0.8.32" })
    expect(manifest.v0831HistoricalRelease).toMatchObject({ reusableForV0832: false, version: "0.8.31" })
    expect(manifest.legacyAutoUpdateRepair).toEqual({
      command: "ph update repair --yes",
      eligibility: "only-a-valid-legacy-attach-staging-manifest-with-one-regular-absolute-persona-plugin",
      preservation: "unrelated-opencode-settings-and-user-diverged-owned-files-remain-unchanged",
      rejection: "malformed-symlinked-foreign-or-nonlegacy-state-blocks-before-write",
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
  })

  it("rejects neighboring versions, drift, and reused 0.8.31 authority", () => {
    expect(() => parseV0832AcceptanceManifest(canonicalV0832AcceptanceManifest(), "0.8.31")).toThrow(V0832AcceptanceManifestError)
    expect(() => parseV0832AcceptanceManifest(canonicalV0832AcceptanceManifest(), "0.8.33")).toThrow(V0832AcceptanceManifestError)
    expect(() => parseV0831AcceptanceManifest(canonicalV0832AcceptanceManifest(), "0.8.32")).toThrow()
  })

  it("keeps the v0832 reader historical while current external preflights use the generic reader", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")
      expect(source).toContain('from "./consumer-authority-current-acceptance-schema.mjs"')
      expect(source).toContain("readCurrentAcceptanceManifest(packageRoot)")
      expect(source).not.toContain('from "./consumer-authority-v0831-acceptance-schema.mjs"')
      expect(source).not.toContain("readV0831AcceptanceManifest(packageRoot)")
    }
  })
})
