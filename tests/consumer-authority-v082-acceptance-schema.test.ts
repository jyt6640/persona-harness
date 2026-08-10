import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  V082AcceptanceManifestError,
  canonicalV082AcceptanceManifest,
  parseV082AcceptanceManifest,
} from "../scripts/consumer-authority-v082-acceptance-schema.mjs"

const repositoryRoot = process.cwd()

describe("consumer authority 0.8.2 acceptance schema", () => {
  it("keeps the published 0.8.2 record strict without defining the current package", () => {
    const manifest = parseV082AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v082-acceptance.json"), "utf8")),
      "0.8.2",
    )

    expect(manifest.package).toMatchObject({ channel: "latest", scope: "ga-approved", version: "0.8.2" })
    expect(manifest.v081HistoricalRelease).toMatchObject({ reusableForV082: false, version: "0.8.1" })
  })

  it("assigns Package consumer evidence separately from CI-owned observer tool evidence", () => {
    const manifest = parseV082AcceptanceManifest(
      JSON.parse(readFileSync(join(repositoryRoot, "docs", "current", "release", "consumer-authority-v082-acceptance.json"), "utf8")),
      "0.8.2",
    )

    expect(manifest.acceptanceResponsibilities).toEqual({
      package: {
        excludes: ["attestation-parser", "observer-gh-selector"],
        requires: [
          "exact-tar-provenance",
          "normal-install",
          "installed-only-no-source-fallback",
          "cli-and-approval-before-mutation",
        ],
      },
      sourceAndProtectedUbuntuCi: {
        requires: [
          "workflow-owned-dpkg-observer-gh-selection",
          "private-regular-nonsymlink-observer-gh-copy",
          "path-free-attestation-parser-preflight",
        ],
      },
    })
    expect(manifest.prearmedExternalHandoff.finalObserverProcedure.observerGhSelection).toContain(
      "source-and-protected-ubuntu-ci-only",
    )
    expect(manifest.hostedResidual.whyLocalCannotClose).toContain(
      "Source and CI-shaped packed exercise prove",
    )
    expect(manifest.hostedResidual.whyLocalCannotClose).toContain(
      "Package acceptance separately proves",
    )
  })

  it("rejects a neighboring package version and acceptance drift", () => {
    const fixture = canonicalV082AcceptanceManifest()
    const packageRecord = fixture.package as Record<string, unknown>
    packageRecord.version = "0.8.1"

    expect(() => parseV082AcceptanceManifest(fixture, "0.8.2")).toThrow(V082AcceptanceManifestError)
    expect(() => parseV082AcceptanceManifest(canonicalV082AcceptanceManifest(), "0.8.1")).toThrow(V082AcceptanceManifestError)
  })

  it("rejects a current package version rather than letting the published record be reused", () => {
    expect(() => parseV082AcceptanceManifest(canonicalV082AcceptanceManifest(), "0.8.3")).toThrow(V082AcceptanceManifestError)
  })
})
