import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  CurrentAcceptanceManifestError,
  parseCurrentAcceptanceManifest,
  readCurrentAcceptanceManifest,
} from "../scripts/consumer-authority-current-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("current consumer authority acceptance schema", () => {
  it("binds the current manifest to the package version while retaining the prior candidate and published history separately", () => {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      readonly version: string
    }
    const manifest = readCurrentAcceptanceManifest(repositoryRoot)

    expect(manifest.schemaVersion).toBe("consumer-authority-current-acceptance.1")
    expect(manifest.package).toEqual({ channel: "unpublished", scope: "source-candidate", version: packageJson.version })
    expect(manifest.authority.fixturePlan.registryInstall).toBe("requires-authorized-release-before-registry-install")
    expect(manifest.authority.hostedFixture.revision).toBe("current-source-candidate-head-before-authorized-release")
    expect(manifest.hostedResidual.id).toBe("current-package-acceptance-and-authorized-current-artifact-observation")
    expect(manifest.previousPublishedRelease).toEqual({
      outcome: "published-release-is-immutable-and-not-reusable-for-this-current-source-candidate-or-any-later-package",
      reusableForCurrent: false,
      version: "0.8.31",
    })
  })

  it("rejects a current record paired to a different package version", () => {
    const record = JSON.parse(
      readFileSync(join(repositoryRoot, "docs/current/release/consumer-authority-current-acceptance.json"), "utf8"),
    )

    expect(() => parseCurrentAcceptanceManifest(record, "0.8.32")).toThrow(CurrentAcceptanceManifestError)
  })

  it("routes current external preflights through the generic reader", () => {
    for (const script of [
      "preflight-consumer-authority-external-attestation.mjs",
      "preflight-consumer-authority-external-artifact-transport.mjs",
    ]) {
      const source = readFileSync(join(repositoryRoot, "scripts", script), "utf8")

      expect(source).toContain('from "./consumer-authority-current-acceptance-schema.mjs"')
      expect(source).toContain("readCurrentAcceptanceManifest(packageRoot)")
    }
  })
})
