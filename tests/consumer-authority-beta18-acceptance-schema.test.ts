import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA18_ACCEPTANCE_SCHEMA_VERSION,
  Beta18AcceptanceManifestError,
  parseBeta18AcceptanceManifest,
  readBeta18AcceptanceManifest,
} from "../scripts/consumer-authority-beta18-acceptance-schema.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta18-acceptance.json")

describe("consumer authority beta.18 acceptance schema", () => {
  it("binds the Node20 canonical tar to the isolated Node24 publisher dry run", () => {
    const manifest = record(readBeta18AcceptanceManifest(repositoryRoot))

    expect(manifest.schemaVersion).toBe(BETA18_ACCEPTANCE_SCHEMA_VERSION)
    expect(record(manifest.package).version).toBe("0.8.0-beta.18")
    expect(record(manifest.canonicalPackagePublisherPlan)).toMatchObject({
      canonicalPackerRuntime: { node: "20.19.0", npm: "10.8.2" },
      npmTrustedPublishingMinimum: { node: "22.14.0", npm: "11.5.1" },
      preflight: { mode: "node24-npm11-exact-canonical-tarball-dry-run" },
      publisherRuntime: { node: "24.18.0", npm: "11.16.0" },
      registryPut: { evidence: "hosted-only" },
    })
    expect(record(record(manifest.packageBoundary).authoritativeBundleContract).partialCloneSourceHydration)
      .toBe("only-a-blob-none-promisor-clone-with-the-exact-canonical-origin-may-no-filter-hydrate-the-retained-origin-main-sha-before-local-bundle-materialization-without-moving-refs")
  })

  it("rejects publisher runtime, argv, and historical E404 semantic drift", () => {
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
        name: "beta17 package absence claim",
        apply: (manifest) => { record(manifest.beta17HistoricalPublish).outcome = "package-not-found" },
      },
      {
        name: "unknown field",
        apply: (manifest) => { manifest.unexpected = "foreign" },
      },
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)
      expectSchemaBlock(() => parseBeta18AcceptanceManifest(manifest, "0.8.0-beta.18"), testCase.name)
    }
    expectSchemaBlock(
      () => parseBeta18AcceptanceManifest(canonicalManifest(), "0.8.0-beta.17"),
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
    if (error instanceof Beta18AcceptanceManifestError) {
      expect(error.code, label).toBe("beta18-acceptance-schema")
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
