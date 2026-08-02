import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA19_ACCEPTANCE_SCHEMA_VERSION,
  Beta19AcceptanceManifestError,
  parseBeta19AcceptanceManifest,
  readBeta19AcceptanceManifest,
} from "../scripts/consumer-authority-beta19-acceptance-schema.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta19-acceptance.json")

describe("consumer authority beta.19 acceptance schema", () => {
  it("binds workflow-verified canonical source facts to the isolated Node24 publisher and registry reconciliation", () => {
    const manifest = record(readBeta19AcceptanceManifest(repositoryRoot))

    expect(manifest.schemaVersion).toBe(BETA19_ACCEPTANCE_SCHEMA_VERSION)
    expect(record(manifest.package).version).toBe("0.8.0-beta.19")
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
        name: "unknown field",
        apply: (manifest) => { manifest.unexpected = "foreign" },
      },
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)
      expectSchemaBlock(() => parseBeta19AcceptanceManifest(manifest, "0.8.0-beta.19"), testCase.name)
    }
    expectSchemaBlock(
      () => parseBeta19AcceptanceManifest(canonicalManifest(), "0.8.0-beta.18"),
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
    if (error instanceof Beta19AcceptanceManifestError) {
      expect(error.code, label).toBe("beta19-acceptance-schema")
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
