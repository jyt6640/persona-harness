import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA22_ACCEPTANCE_SCHEMA_VERSION,
  Beta22AcceptanceManifestError,
  parseBeta22AcceptanceManifest,
  readBeta22AcceptanceManifest,
} from "../scripts/consumer-authority-beta22-acceptance-schema.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta22-acceptance.json")
const beta21ManifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta21-acceptance.json")
const PROCEDURE_RECORD_SHA256 = "8b2537fa1ca4e8209790a3c9539666abbb0a5ffda13d6a82cb9e5c7e2635b863"

describe("consumer authority beta.22 acceptance schema", () => {
  it("reads the historical pre-push source identity procedure only from an explicit matching package root", () => {
    const legacyPackageRoot = mkdtempSync(join(tmpdir(), "persona-harness-beta22-acceptance-"))
    try {
      const legacyManifestPath = join(legacyPackageRoot, "docs", "current", "release", "consumer-authority-beta22-acceptance.json")
      mkdirSync(join(legacyPackageRoot, "docs", "current", "release"), { recursive: true })
      writeFileSync(join(legacyPackageRoot, "package.json"), JSON.stringify({ version: "0.8.0-beta.22" }))
      writeFileSync(legacyManifestPath, readFileSync(manifestPath))

      const manifest = record(readBeta22AcceptanceManifest(legacyPackageRoot))
      const handoff = record(manifest.prearmedExternalHandoff)
      const procedure = record(handoff.finalObserverProcedure)
      const prePush = record(procedure.prePushCommit)

      expect(manifest.schemaVersion).toBe(BETA22_ACCEPTANCE_SCHEMA_VERSION)
      expect(record(manifest.package).version).toBe("0.8.0-beta.22")
      expect(record(manifest.beta21HistoricalFinalObserver)).toEqual({
        outcome: "online-crypto-and-bindings-passed-after-leaf-window-expired-before-authority-fetch-not-reusable-as-closure-evidence",
        reusableForBeta22: false,
        version: "0.8.0-beta.21",
      })
      expect(procedure.procedureRecord).toEqual({
        location: "coordinator-governed-immutable-external-procedure-record-no-local-path",
        sha256: PROCEDURE_RECORD_SHA256,
      })
      expect(prePush).toMatchObject({
        finalCommit: "one-final-commit-contains-only-allowed-source-bound-bootstrap-outputs-and-reusable-pin",
        remoteParent: "must-remain-unchanged-immediately-before-normal-push",
        sourceBoundBootstrap: "must-complete-before-final-commit",
      })
      expect(record(procedure.postCommitPreparation).allowedMutations).toEqual(expect.arrayContaining([
        ".persona/.ph-init-manifest.json",
        ".persona/evidence/**",
        ".persona/workflow/**",
        ".gradle/**",
        "build/**",
      ]))
      expect(record(procedure.postCommitPreparation).forbiddenSourceBoundMutations).toContain(".persona/project-profile.jsonc")
      expect(record(handoff.trigger).steps).toEqual(expect.arrayContaining([
        "pre-push-fixture-parent-cwd-head-and-source-identity-ready",
        "normal-push-of-the-same-final-fixture-commit-to-main",
        "verify-online-before-leaf-certificate-notAfter",
      ]))
      expectSchemaBlock(() => readBeta22AcceptanceManifest(repositoryRoot), "active beta23 package root")
    } finally {
      rmSync(legacyPackageRoot, { force: true, recursive: true })
    }
  })

  it("rejects source-bound ordering, pre-push, and schema drift", () => {
    const cases: readonly { readonly apply: (manifest: Record<string, unknown>) => void; readonly name: string }[] = [
      {
        name: "foreign procedure record",
        apply: (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).procedureRecord = { location: "coordinator-governed-immutable-external-procedure-record-no-local-path", sha256: "0".repeat(64) } },
      },
      {
        name: "bootstrap after commit",
        apply: (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).prePushCommit = { sourceBoundBootstrap: "after-final-commit" } },
      },
      {
        name: "profile allowed after commit",
        apply: (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).postCommitPreparation = { allowedMutations: [".persona/project-profile.jsonc"] } },
      },
      {
        name: "missing remote parent assertion",
        apply: (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).prePushCommit = { finalCommit: "one-final-commit-contains-only-allowed-source-bound-bootstrap-outputs-and-reusable-pin" } },
      },
      {
        name: "unknown field",
        apply: (manifest) => { manifest.unexpected = "foreign" },
      },
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)
      expectSchemaBlock(() => parseBeta22AcceptanceManifest(manifest, "0.8.0-beta.22"), testCase.name)
    }
    expectSchemaBlock(
      () => parseBeta22AcceptanceManifest(canonicalManifest(), "0.8.0-beta.21"),
      "foreign package version",
    )
    expectSchemaBlock(
      () => parseBeta22AcceptanceManifest(record(JSON.parse(readFileSync(beta21ManifestPath, "utf8"))), "0.8.0-beta.21"),
      "beta21 record",
    )
  })
})

function canonicalManifest(): Record<string, unknown> {
  return record(JSON.parse(readFileSync(manifestPath, "utf8")))
}

function expectSchemaBlock(action: () => void, label: string): void {
  try {
    action()
  } catch (error) {
    if (error instanceof Beta22AcceptanceManifestError) {
      expect(error.code, label).toBe("beta22-acceptance-schema")
      return
    }
    throw error
  }
  throw new Error(`${label} unexpectedly passed`)
}

function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new TypeError("expected record")
  return value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
