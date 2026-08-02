import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA21_ACCEPTANCE_SCHEMA_VERSION,
  Beta21AcceptanceManifestError,
  parseBeta21AcceptanceManifest,
  readBeta21AcceptanceManifest,
} from "../scripts/consumer-authority-beta21-acceptance-schema.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta21-acceptance.json")

describe("consumer authority beta.21 acceptance schema", () => {
  it("binds the immutable same-consumer final observer procedure", () => {
    const manifest = record(readBeta21AcceptanceManifest(repositoryRoot))

    expect(manifest.schemaVersion).toBe(BETA21_ACCEPTANCE_SCHEMA_VERSION)
    expect(record(manifest.package).version).toBe("0.8.0-beta.21")
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
    expect(record(manifest.beta20HistoricalFinalObserver)).toEqual({
      outcome: "trusted-unconsumed-live-fetch-followed-by-intentional-workflow-state-uninitialized-block-not-reusable-as-closure-evidence",
      procedureRecordSha256: "1d370a4e4cdd55b20e27c016073246b78c373548c84c89c3499b3838e27980a7",
      reusableForBeta21: false,
      version: "0.8.0-beta.20",
    })
    const procedure = record(record(manifest.prearmedExternalHandoff).finalObserverProcedure)
    expect(procedure.procedureRecord).toEqual({
      location: "coordinator-governed-immutable-external-procedure-record-no-local-path",
      sha256: "1d370a4e4cdd55b20e27c016073246b78c373548c84c89c3499b3838e27980a7",
    })
    expect(procedure.prefetchSteps).toContain("default-Finish-blocked-only-trusted-authority-required")
    expect(procedure.liveSteps).toEqual(expect.arrayContaining([
      "authenticated-fetch-once",
      "same-consumer-status-and-explain-trusted-unconsumed-with-no-readiness-blocker",
      "Finish-consume-once",
      "immediate-Finish-replay-blocked",
    ]))
    expect(procedure.noReinitializationAfterFetch).toContain("bootstrap-plan-report-evidence-or-loop-state-reset")
    const handoff = record(manifest.prearmedExternalHandoff)
    expect(record(handoff.prepare).allowedBeforeFixture).toEqual(expect.arrayContaining([
      "prepare-one-exact-git-backed-consumer-cwd-head-and-isolated-home-store",
      "enroll-after-prefetch-readiness",
    ]))
    expect(record(handoff.trigger).steps).toEqual(expect.arrayContaining([
      "final-observer-procedure-prefetch-ready",
      "same-consumer-trusted-unconsumed-no-readiness-blocker",
    ]))
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
        name: "foreign procedure record",
        apply: (manifest) => { record(record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).procedureRecord).sha256 = "0".repeat(64) },
      },
      {
        name: "post-fetch lifecycle reset allowed",
        apply: (manifest) => { record(manifest.prearmedExternalHandoff).finalObserverProcedure = { schemaVersion: "consumer-authority-final-observer-procedure.1" } },
      },
      {
        name: "unknown field",
        apply: (manifest) => { manifest.unexpected = "foreign" },
      },
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)
      expectSchemaBlock(() => parseBeta21AcceptanceManifest(manifest, "0.8.0-beta.21"), testCase.name)
    }
    expectSchemaBlock(
      () => parseBeta21AcceptanceManifest(canonicalManifest(), "0.8.0-beta.19"),
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
    if (error instanceof Beta21AcceptanceManifestError) {
      expect(error.code, label).toBe("beta21-acceptance-schema")
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
