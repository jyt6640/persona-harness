import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, expect, it } from "vitest"

import {
  BETA23_ACCEPTANCE_SCHEMA_VERSION,
  Beta23AcceptanceManifestError,
  parseBeta23AcceptanceManifest,
  readBeta23AcceptanceManifest,
} from "../scripts/consumer-authority-beta23-acceptance-schema.mjs"

const repositoryRoot = process.cwd()
const manifestPath = join(repositoryRoot, "docs", "current", "release", "consumer-authority-beta23-acceptance.json")
const PROCEDURE_RECORD_SHA256 = "24eeeb198a683cdbdade04142aa2dca2479f94fb06bc4f39c1633d16c5286c8b"
const EXTERNAL_STATE_ROOTS = [
  "HOME",
  "GH_CONFIG_DIR",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
  "XDG_CACHE_HOME",
  "XDG_RUNTIME_DIR",
  "TMPDIR",
  "APPDATA",
  "LOCALAPPDATA",
  "USERPROFILE",
  "GIT_CONFIG_GLOBAL",
  "GIT_CONFIG_SYSTEM",
  "NPM_CONFIG_USERCONFIG",
  "NPM_CONFIG_CACHE",
]

describe("consumer authority beta.23 acceptance schema", () => {
  it("binds the v3 host-state-isolated final observer procedure", () => {
    const manifest = record(parseBeta23AcceptanceManifest(canonicalManifest(), "0.8.0-beta.23"))
    const procedure = record(record(manifest.prearmedExternalHandoff).finalObserverProcedure)
    const execution = record(procedure.execution)
    const hostStateIsolation = record(procedure.hostStateIsolation)
    const timeBounds = record(procedure.timeBounds)

    expect(manifest.schemaVersion).toBe(BETA23_ACCEPTANCE_SCHEMA_VERSION)
    expect(record(manifest.package).version).toBe("0.8.0-beta.23")
    expect(record(manifest.beta22HistoricalFinalObserver)).toEqual({
      outcome: "host-gh-xdg-state-created-untracked-local-device-id-after-final-commit-not-reusable-as-closure-evidence",
      reusableForBeta23: false,
      version: "0.8.0-beta.22",
    })
    expect(procedure.procedureRecord).toEqual({
      location: "coordinator-governed-immutable-external-procedure-record-no-local-path",
      sha256: PROCEDURE_RECORD_SHA256,
    })
    expect(execution).toEqual({
      environment: "env-i-with-only-fixed-allowlisted-variables",
      toolPaths: ["absolute-gh", "absolute-git", "absolute-node", "absolute-npm"],
    })
    expect(procedure.credentialHandoff).toBe("retrieve-host-gh-credential-silently-outside-the-consumer-and-pass-it-only-to-one-fixed-read-only-observer-child")
    expect(hostStateIsolation.externalStateRoots).toEqual(EXTERNAL_STATE_ROOTS)
    expect(hostStateIsolation.forbiddenConsumerPaths).toEqual([".local/**", ".config/**", ".cache/**"])
    expect(hostStateIsolation.rootBinding).toBe("all-fifteen-absolute-state-roots-must-remain-outside-the-consumer-realpath")
    expect(procedure.stageCleanliness).toEqual([
      "baseline",
      "source-bound-preparation",
      "credential-handoff",
      "observer-child",
      "immediately-pre-push",
    ])
    expect(procedure.prefetchSteps).toEqual(expect.arrayContaining([
      "baseline-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
      "source-bound-preparation-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
      "credential-handoff-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
      "observer-child-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
      "immediately-pre-push-cwd-git-toplevel-head-source-identity-empty-porcelain-and-empty-git-clean-ndx",
    ]))
    expect(timeBounds).toEqual({
      certificateValidity: "non-relaxable-verify-online-before-leaf-certificate-notAfter",
      outerTimeout: "forbidden-no-arbitrary-outer-timeout",
      slowPreparation: "complete-before-one-normal-push",
    })
    expect(record(procedure.postCommitPreparation).allowedMutations).not.toEqual(expect.arrayContaining([
      ".local/**",
      ".config/**",
      ".cache/**",
    ]))
  })

  it("rejects host-state, cleanliness, and temporal-policy drift", () => {
    const cases: readonly { readonly apply: (manifest: Record<string, unknown>) => void; readonly name: string }[] = [
      {
        name: "foreign procedure record",
        apply: (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).procedureRecord = { location: "coordinator-governed-immutable-external-procedure-record-no-local-path", sha256: "0".repeat(64) } },
      },
      {
        name: "missing host state root",
        apply: (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).hostStateIsolation = { externalStateRoots: EXTERNAL_STATE_ROOTS.slice(1) } },
      },
      {
        name: "credential handed to an arbitrary process",
        apply: (manifest) => { record(manifest.prearmedExternalHandoff).finalObserverProcedure = { credentialHandoff: "arbitrary-child" } },
      },
      {
        name: "local state allowlist",
        apply: (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).postCommitPreparation = { allowedMutations: [".local/**"] } },
      },
      {
        name: "missing cleanliness stage",
        apply: (manifest) => { record(manifest.prearmedExternalHandoff).finalObserverProcedure = { stageCleanliness: ["baseline"] } },
      },
      {
        name: "relaxed certificate window",
        apply: (manifest) => { record(record(manifest.prearmedExternalHandoff).finalObserverProcedure).timeBounds = { certificateValidity: "optional" } },
      },
      {
        name: "unknown field",
        apply: (manifest) => { manifest.unexpected = "foreign" },
      },
    ]

    for (const testCase of cases) {
      const manifest = canonicalManifest()
      testCase.apply(manifest)
      expectSchemaBlock(() => parseBeta23AcceptanceManifest(manifest, "0.8.0-beta.23"), testCase.name)
    }
    expectSchemaBlock(
      () => parseBeta23AcceptanceManifest(canonicalManifest(), "0.8.0-beta.22"),
      "foreign package version",
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
    if (error instanceof Beta23AcceptanceManifestError) {
      expect(error.code, label).toBe("beta23-acceptance-schema")
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
