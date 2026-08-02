import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA20_ACCEPTANCE_SCHEMA_VERSION,
  Beta20AcceptanceManifestError,
  parseBeta20AcceptanceManifest,
  readBeta20AcceptanceManifest,
} from "../scripts/consumer-authority-beta20-acceptance-schema.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta20-acceptance.json")

describe("consumer authority beta.20 acceptance schema", () => {
  it("binds the fixed authenticated-fetch child envelope without changing the public missing state", () => {
    const manifest = record(readBeta20AcceptanceManifest(repositoryRoot))

    expect(manifest.schemaVersion).toBe(BETA20_ACCEPTANCE_SCHEMA_VERSION)
    expect(record(manifest.package).version).toBe("0.8.0-beta.20")
    expect(record(manifest.canonicalPackagePublisherPlan)).toMatchObject({
      canonicalPackerRuntime: { node: "20.19.0", npm: "10.8.2" },
      npmTrustedPublishingMinimum: { node: "22.14.0", npm: "11.5.1" },
      preflight: { mode: "node24-npm11-exact-canonical-tarball-dry-run" },
      publisherRuntime: { node: "24.18.0", npm: "11.16.0" },
      registryPut: { evidence: "hosted-only" },
    })
    expect(record(record(manifest.packageBoundary).authoritativeBundleContract).partialCloneSourceHydration)
      .toBe("only-a-blob-none-promisor-clone-with-the-exact-canonical-origin-may-no-filter-hydrate-the-retained-origin-main-sha-before-local-bundle-materialization-without-moving-refs")
    expect(record(record(manifest.packageBoundary).registryReadback)).toEqual({
      failureEvidence: "sanitized-readback-is-uploaded-even-when-postpublish-reconciliation-blocks",
      sourceBinding: "workflow-verified-canonical-tar",
      unsupportedMetadata: "registry-githead-is-neither-required-nor-reflected",
    })
    expect(record(manifest.beta18HistoricalPublish)).toMatchObject({
      reusableForBeta19: false,
      version: "0.8.0-beta.18",
    })
    expect(record(manifest.beta19HistoricalPublish)).toEqual({
      outcome: "published-immutable-staging-package-not-reusable-as-current-package-evidence",
      reusableForBeta20: false,
      version: "0.8.0-beta.19",
    })
    expect(record(record(manifest.authority).fetchDiagnostic)).toEqual({
      allowedCodes: [
        "authority-fetch-evidence",
        "authority-fetch-invalid",
        "authority-fetch-network",
        "authority-fetch-policy",
      ],
      childEnvelope: "only-exit-one-fixed-code-ok-false",
      persistence: "blocked-child-leaves-no-artifact-or-authority-state",
      privacy: "no-token-path-url-or-raw-child-output",
      publicState: "missing",
    })
  })

  it("rejects publisher runtime, argv, and historical registry-readback semantic drift", () => {
    const cases: Array<{ readonly apply: (manifest: Record<string, unknown>) => void; readonly name: string }> = [
      {
        name: "publisher runtime downgrade",
        apply: (manifest) => { record(manifest.canonicalPackagePublisherPlan).publisherRuntime = { node: "20.19.0", npm: "10.8.2" } },
      },
      {
        name: "workspace publish argv",
        apply: (manifest) => { record(record(manifest.canonicalPackagePublisherPlan).preflight).argv = ["npm", "publish", "."] },
      },
      {
        name: "beta18 registry gitHead requirement",
        apply: (manifest) => { record(record(manifest.packageBoundary).registryReadback).unsupportedMetadata = "registry-githead-required" },
      },
      {
        name: "unknown child diagnostic",
        apply: (manifest) => { record(record(manifest.authority).fetchDiagnostic).allowedCodes = ["authority-fetch-foreign"] },
      },
      {
        name: "unknown field",
        apply: (manifest) => { manifest.unexpected = "foreign" },
      },
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)
      expectSchemaBlock(() => parseBeta20AcceptanceManifest(manifest, "0.8.0-beta.20"), testCase.name)
    }
    expectSchemaBlock(
      () => parseBeta20AcceptanceManifest(canonicalManifest(), "0.8.0-beta.19"),
      "foreign package version",
    )
  })
})

function canonicalManifest(): Record<string, unknown> {
  return structuredClone(record(JSON.parse(readFileSync(manifestPath, "utf8"))))
}

function expectSchemaBlock(action: () => void, label: string): void {
  try {
    action()
  } catch (error) {
    if (error instanceof Beta20AcceptanceManifestError) {
      expect(error.code, label).toBe("beta20-acceptance-schema")
      return
    }
    throw error
  }
  throw new Error(`${label} unexpectedly passed`)
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError("expected record")
  return value as Record<string, unknown>
}
